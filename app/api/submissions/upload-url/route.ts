import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { validateStoragePath } from "@/lib/route-guards"

const SUBMISSIONS_BUCKET = "submissions"

export async function POST(request: NextRequest) {
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

    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Supabase chưa được cấu hình." }, { status: 500 })
    }

    // Mọi path upload của app đều duy nhất (timestamp + chuỗi ngẫu nhiên) nên
    // tắt upsert: không ai ghi đè được file đã biết đường dẫn.
    const { data, error } = await supabase.storage
      .from(SUBMISSIONS_BUCKET)
      .createSignedUploadUrl(path, { upsert: false })
    if (error || !data?.token) {
      return NextResponse.json(
        { error: `Không tạo được đường dẫn tải lên: ${error?.message ?? "unknown error"}` },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true, upload: { path: data.path, token: data.token } })
  } catch (e: any) {
    return NextResponse.json(
      { error: `Không tạo được đường dẫn tải lên: ${e?.message ?? "lỗi không xác định"}` },
      { status: 502 },
    )
  }
}
