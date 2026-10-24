import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { validateStoragePath } from "@/lib/route-guards"

const SUBMISSIONS_BUCKET = "submissions"
// Bucket được phép ký URL qua API này (allowlist — không ký bừa bucket khác).
const ALLOWED_BUCKETS = ["submissions", "presentations"] as const

export async function POST(request: NextRequest) {
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
    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()
    const pathError = await validateStoragePath(userClient, bucket, path, user?.id ?? null)
    if (pathError) {
      return NextResponse.json({ error: pathError }, { status: 403 })
    }

    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Supabase chưa được cấu hình." }, { status: 500 })
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24 * 7)
    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: `Không tạo được link tệp: ${error?.message ?? "unknown error"}` },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true, signedUrl: data.signedUrl })
  } catch (e: any) {
    return NextResponse.json(
      { error: `Không tạo được link tệp: ${e?.message ?? "lỗi không xác định"}` },
      { status: 502 },
    )
  }
}
