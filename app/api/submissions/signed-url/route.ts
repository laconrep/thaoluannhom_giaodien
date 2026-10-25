import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateStoragePath } from "@/lib/route-guards"
import { checkApiRateLimit } from "@/lib/rate-limit"
import { isB2Configured, presignB2Download, B2_VIEW_EXPIRES_SECONDS } from "@/lib/b2"

const SUBMISSIONS_BUCKET = "submissions"
// Bucket logic được phép ký URL qua API này (allowlist — không ký bừa bucket
// khác). Cả 2 đều nằm trong cùng 1 bucket B2; tham số này chỉ để
// validateStoragePath chọn đúng quy tắc (xem lib/route-guards.ts).
// submission-media KHÔNG có ở đây: ảnh nhúng dùng public URL, không qua route.
const ALLOWED_BUCKETS = ["submissions", "presentations"] as const

export async function POST(request: NextRequest) {
  // Bảo mật 24/10/2026 (GĐ4): chặn spam route ký URL.
  if (!checkApiRateLimit(request)) {
    return NextResponse.json(
      { error: "Gửi quá nhiều yêu cầu, thử lại sau." },
      { status: 429 },
    )
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      path?: string
      bucket?: string
    }
    const path = typeof body.path === "string" && body.path ? body.path : ""

    if (!path) {
      return NextResponse.json({ error: "Thiếu đường dẫn tệp." }, { status: 400 })
    }

    const bucket: string = ALLOWED_BUCKETS.includes(body.bucket as (typeof ALLOWED_BUCKETS)[number])
      ? (body.bucket as string)
      : SUBMISSIONS_BUCKET

    // Bảo mật 24/10/2026 (GĐ2): trước đây route ký URL cho bất kỳ path nào.
    // Giờ path phải gắn với phiên thật (và GV thì phải là phiên của mình).
    // DB vẫn ở Supabase nên bước validate này không đổi.
    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()
    const pathError = await validateStoragePath(userClient, bucket, path, user?.id ?? null)
    if (pathError) {
      return NextResponse.json({ error: pathError }, { status: 403 })
    }

    // CẦU NỐI TẠM NGÀY 25/10/2026: B2 đã vượt mức tải miễn phí trong ngày
    // (mọi GET đều 403 "download bandwidth or transaction cap exceeded")
    // nên app không xem được ảnh cũ và không trình chiếu được PPT trong
    // ngày — trong khi kho Supabase cũ vẫn còn đủ file và vẫn tải được
    // (chưa bị siết, hạn siết là 15/11/2026). Vì vậy route ký ưu tiên
    // Supabase trước; file nào không còn trên Supabase (chỉ mới tải lên
    // B2 sau đợt chuyển kho) thì rơi về ký B2 như cũ. Khi B2 được nâng
    // mức hoặc code tái dùng link ký xong thì đảo lại thứ tự này.
    const admin = createAdminClient()
    if (admin) {
      const { data, error } = await admin.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 24 * 7)
      if (!error && data?.signedUrl) {
        return NextResponse.json({ ok: true, signedUrl: data.signedUrl })
      }
      // File không còn trên Supabase → rơi xuống ký B2 bên dưới.
      console.warn("[signed-url] supabase sign failed, fallback b2:", error?.message)
    }

    // Ký B2 (từ 24/10/2026): GET 7 ngày, khớp hạn signed URL cũ.
    // URL Supabase cũ trong DB tự chữa được: client tách path từ URL cũ rồi
    // gọi route này, nhận về URL B2 cho cùng object key.
    if (!isB2Configured()) {
      return NextResponse.json({ error: "Kho lưu trữ chưa được cấu hình." }, { status: 500 })
    }
    const signedUrl = await presignB2Download(path, B2_VIEW_EXPIRES_SECONDS)
    if (!signedUrl) {
      console.error("[signed-url] b2 presign failed")
      return NextResponse.json(
        { error: "Không tạo được link tệp." },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true, signedUrl })
  } catch (e: any) {
    console.error("[signed-url]", e)
    return NextResponse.json(
      { error: "Không tạo được link tệp." },
      { status: 502 },
    )
  }
}
