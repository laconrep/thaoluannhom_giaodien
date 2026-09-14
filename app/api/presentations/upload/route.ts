import { createClient } from "@/lib/supabase/server"
import { createAdminClient, createServiceClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { PLAN_DEFAULT, planLimits, type Plan } from "@/lib/plans"
import {
  MAX_PRESENTATION_BYTES,
  PRESENTATIONS_BUCKET,
  powerpointContentType,
} from "@/lib/storage-upload"

function getEstimatedSlideCount(fileSize: number): number {
  return Math.max(1, Math.min(100, Math.floor(fileSize / 50000)))
}

function classTeacherId(session: { classes?: unknown }): string | null {
  const nested = session.classes as { teacher_id?: string } | { teacher_id?: string }[] | null | undefined
  if (!nested) return null
  if (Array.isArray(nested)) return nested[0]?.teacher_id ?? null
  return nested.teacher_id ?? null
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const fileName = typeof payload.fileName === "string" ? payload.fileName : ""
    const fileSize = Number(payload.fileSize)
    const fileType = typeof payload.fileType === "string" ? payload.fileType : ""
    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : ""
    const contentType = powerpointContentType(fileName, fileType)

    if (!fileName || !sessionId || !Number.isFinite(fileSize)) {
      return NextResponse.json({ error: "Thiếu thông tin file hoặc sessionId" }, { status: 400 })
    }

    if (fileSize === 0 || fileSize > MAX_PRESENTATION_BYTES) {
      return NextResponse.json({ error: "File PowerPoint phải từ 1 byte đến 200 MB." }, { status: 400 })
    }

    if (!/\.(pptx?|PPTX?)$/.test(fileName) && !contentType.includes("powerpoint") && fileType !== "application/zip") {
      return NextResponse.json({ error: "Chỉ hỗ trợ file PowerPoint .ppt hoặc .pptx." }, { status: 415 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [{ data: profile }, { count }, sessionResult] = await Promise.all([
      supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
      supabase
        .from("presentations")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", user.id),
      supabase
        .from("sessions")
        .select("id, class_id, classes!inner(teacher_id)")
        .eq("id", sessionId)
        .single(),
    ])
    const plan = (profile?.plan as Plan | undefined) ?? PLAN_DEFAULT
    const maxPresentations = planLimits(plan).maxPresentations
    if (count !== null && count >= maxPresentations) {
      return NextResponse.json(
        { error: `Gói ${plan} giới hạn ${maxPresentations} bài trình chiếu. Hãy xóa bớt bài cũ hoặc nâng cấp gói.` },
        { status: 429 },
      )
    }

    const session = sessionResult.data
    if (sessionResult.error || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (classTeacherId(session) !== user.id) {
      return NextResponse.json({ error: "Not authorized to upload presentation" }, { status: 403 })
    }

    const admin = createServiceClient() ?? createAdminClient()
    const slideCount = getEstimatedSlideCount(fileSize)
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_")
    const timestamp = Date.now()
    const storagePath = `${user.id}/${sessionId}/${timestamp}_${safeFileName}`
    const storageClient = admin ?? supabase
    const insertPayload = {
      session_id: sessionId,
      teacher_id: user.id,
      file_name: fileName,
      file_path: storagePath,
      storage_path: storagePath,
      slide_count: slideCount,
    }

    let [{ data: signedUpload, error: signedUploadError }, { data: presentation, error: presentationError }] =
      await Promise.all([
        storageClient.storage.from(PRESENTATIONS_BUCKET).createSignedUploadUrl(storagePath, { upsert: true }),
        supabase.from("presentations").insert(insertPayload).select().single(),
      ])

    if ((!signedUpload?.token || signedUploadError) && admin && admin !== supabase) {
      const fallback = await supabase.storage
        .from(PRESENTATIONS_BUCKET)
        .createSignedUploadUrl(storagePath, { upsert: true })
      signedUpload = fallback.data
      signedUploadError = fallback.error
    }

    if (signedUploadError || !signedUpload?.token) {
      return NextResponse.json(
        { error: `Không tạo được đường dẫn upload: ${signedUploadError?.message ?? "unknown error"}` },
        { status: 502 },
      )
    }

    if (presentationError || !presentation) {
      return NextResponse.json(
        { error: `Không lưu được thông tin bài trình chiếu: ${presentationError?.message ?? "unknown error"}` },
        { status: 500 },
      )
    }

    const uploadPath = signedUpload.path || storagePath
    return NextResponse.json({
      success: true,
      upload: {
        path: uploadPath,
        token: signedUpload.token,
        signedUrl: signedUpload.signedUrl,
        contentType,
      },
      presentation: {
        ...presentation,
        id: presentation.id,
        fileName: presentation.file_name,
        slideCount: presentation.slide_count,
      },
    })
  } catch (error) {
    console.error("Presentation upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
