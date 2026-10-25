import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateStoragePath } from "@/lib/route-guards"
import { checkApiRateLimit } from "@/lib/rate-limit"
import { b2ObjectExists, isB2Configured, presignB2Upload } from "@/lib/b2"

const SUBMISSIONS_BUCKET = "submissions"

export async function POST(request: NextRequest) {
  if (!checkApiRateLimit(request)) {
    return NextResponse.json(
      { error: "Gửi quá nhiều yêu cầu, thử lại sau." },
      { status: 429 },
    )
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { path?: string }
    const path = typeof body.path === "string" && body.path ? body.path : ""

    if (!path) {
      return NextResponse.json({ error: "Thiếu đường dẫn tệp." }, { status: 400 })
    }

    // Bảo mật 24/10/2026 (GĐ2): path phải gắn với phiên thật (GV thì phải là
    // phiên của mình); HS không được upload vào thư mục prompts của GV.
    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user && path.startsWith("prompts/")) {
      return NextResponse.json({ error: "Không có quyền tải lên thư mục này." }, { status: 403 })
    }
    const pathError = await validateStoragePath(userClient, SUBMISSIONS_BUCKET, path, user?.id ?? null)
    if (pathError) {
      return NextResponse.json({ error: pathError }, { status: 403 })
    }

    // Chuyển sang B2 (24/10/2026): trả presigned PUT để client tải trực tiếp.
    // S3 không có upsert:false — thay bằng kiểm tra tồn tại trước khi ký:
    // mọi path upload của app đều duy nhất (timestamp + chuỗi ngẫu nhiên)
    // nên va chạm thực tế không xảy ra; gặp 409 thì client nộp lại với path mới.
    if (!isB2Configured()) {
      return NextResponse.json({ error: "Kho lưu trữ chưa được cấu hình." }, { status: 500 })
    }
    if (await b2ObjectExists(path)) {
      return NextResponse.json(
        { error: "Tệp đã tồn tại, vui lòng nộp lại." },
        { status: 409 },
      )
    }
    const uploadUrl = await presignB2Upload(path)
    if (!uploadUrl) {
      console.error("[upload-url] b2 presign failed")
      return NextResponse.json(
        { error: "Không tạo được đường dẫn tải lên." },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true, upload: { path, uploadUrl } })
  } catch (e: any) {
    console.error("[upload-url]", e)
    return NextResponse.json(
      { error: "Không tạo được đường dẫn tải lên." },
      { status: 502 },
    )
  }
}
