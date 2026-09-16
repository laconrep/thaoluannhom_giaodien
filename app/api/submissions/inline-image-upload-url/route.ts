import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  SUBMISSION_MEDIA_BUCKET,
  SUBMISSION_IMAGE_EXTENSIONS,
  submissionMediaPublicUrl,
} from "@/lib/submission-media"

function safePath(input: string): string | null {
  const path = input.trim().replace(/^\/+/, "")
  if (!path) return null
  if (path.includes("..")) return null
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  if (!SUBMISSION_IMAGE_EXTENSIONS.includes(ext)) return null
  return path
}

// Cấp signed upload URL cho ảnh học sinh chèn vào bài viết.
// Bucket là public nên trả kèm publicUrl để nhúng trực tiếp vào HTML.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { path?: string }
    const path = safePath(typeof body.path === "string" ? body.path : "")

    if (!path) {
      return NextResponse.json({ error: "Đường dẫn tệp không hợp lệ." }, { status: 400 })
    }

    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Supabase chưa được cấu hình." }, { status: 500 })
    }

    const { data, error } = await supabase.storage
      .from(SUBMISSION_MEDIA_BUCKET)
      .createSignedUploadUrl(path, { upsert: true })
    if (error || !data?.token) {
      return NextResponse.json(
        { error: `Không tạo được đường dẫn tải ảnh: ${error?.message ?? "unknown error"}` },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      upload: { path: data.path, token: data.token },
      publicUrl: submissionMediaPublicUrl(data.path),
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: `Không tạo được đường dẫn tải ảnh: ${e?.message ?? "lỗi không xác định"}` },
      { status: 502 },
    )
  }
}
