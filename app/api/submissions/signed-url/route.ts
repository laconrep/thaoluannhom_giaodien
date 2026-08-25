import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const SUBMISSIONS_BUCKET = "submissions"

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { path?: string }
  const path = typeof body.path === "string" && body.path ? body.path : ""

  if (!path) {
    return NextResponse.json({ error: "Thiếu đường dẫn tệp." }, { status: 400 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase chưa được cấu hình." }, { status: 500 })
  }

  const { data, error } = await supabase.storage
    .from(SUBMISSIONS_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7)
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: `Không tạo được link tệp: ${error?.message ?? "unknown error"}` },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, signedUrl: data.signedUrl })
}
