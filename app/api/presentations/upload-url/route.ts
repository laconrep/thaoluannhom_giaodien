import { createClient } from "@/lib/supabase/server"
import { createAdminClient, createServiceClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { PRESENTATIONS_BUCKET } from "@/lib/storage-upload"

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { sessionId?: string }
    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : ""
    if (!sessionId) {
      return NextResponse.json({ error: "Thiếu sessionId" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const storagePath = `${user.id}/${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const admin = createServiceClient() ?? createAdminClient() ?? supabase
    const { data, error } = await admin.storage
      .from(PRESENTATIONS_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: true })
    if (error || !data?.token) {
      return NextResponse.json(
        { error: `Không tạo được đường dẫn upload: ${error?.message ?? "unknown error"}` },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      upload: {
        path: data.path || storagePath,
        token: data.token,
        signedUrl: data.signedUrl,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
