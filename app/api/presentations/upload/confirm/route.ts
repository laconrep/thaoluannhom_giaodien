import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { PLAN_DEFAULT, planLimits, type Plan } from "@/lib/plans"

function getEstimatedSlideCount(fileSize: number): number {
  return Math.max(1, Math.min(100, Math.floor(fileSize / 50000)))
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await request.json()
    const fileName = typeof payload.fileName === "string" ? payload.fileName : ""
    const fileSize = Number(payload.fileSize)
    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : ""
    const storagePath = typeof payload.path === "string" ? payload.path : ""

    if (!fileName || !sessionId || !storagePath || !Number.isFinite(fileSize)) {
      return NextResponse.json({ error: "Thiếu thông tin file hoặc sessionId" }, { status: 400 })
    }

    const expectedPrefix = `${user.id}/${sessionId}/`
    if (!storagePath.startsWith(expectedPrefix) || storagePath.includes("..")) {
      return NextResponse.json({ error: "Đường dẫn file không hợp lệ." }, { status: 400 })
    }

    const [{ data: profile }, { count }] = await Promise.all([
      supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
      supabase
        .from("presentations")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", user.id),
    ])
    const plan = (profile?.plan as Plan | undefined) ?? PLAN_DEFAULT
    const maxPresentations = planLimits(plan).maxPresentations
    if (count !== null && count >= maxPresentations) {
      return NextResponse.json(
        { error: `Gói ${plan} giới hạn ${maxPresentations} bài trình chiếu. Hãy xóa bớt bài cũ hoặc nâng cấp gói.` },
        { status: 429 },
      )
    }

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, class_id")
      .eq("id", sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Không tìm thấy phiên học." }, { status: 404 })
    }

    const { data: cls } = await supabase
      .from("classes")
      .select("teacher_id")
      .eq("id", session.class_id)
      .single()

    if (!cls || cls.teacher_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to upload presentation" }, { status: 403 })
    }

    const slideCount = getEstimatedSlideCount(fileSize)
    const { data: presentation, error: presentationError } = await supabase
      .from("presentations")
      .insert({
        session_id: sessionId,
        teacher_id: user.id,
        file_name: fileName,
        file_path: storagePath,
        storage_path: storagePath,
        slide_count: slideCount,
      })
      .select()
      .single()

    if (presentationError || !presentation) {
      return NextResponse.json(
        {
          error: `Không lưu được thông tin bài trình chiếu: ${presentationError?.message ?? "unknown error"}`,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      presentation: {
        id: presentation.id,
        fileName: presentation.file_name,
        slideCount: presentation.slide_count,
        storage_path: presentation.storage_path,
        file_path: presentation.file_path,
      },
    })
  } catch (error) {
    console.error("Presentation confirm error:", error)
    return NextResponse.json({ error: "Không lưu được bài trình chiếu." }, { status: 500 })
  }
}
