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

async function ensurePresentationsBucket(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const { data: buckets } = await admin.storage.listBuckets()
  const exists = buckets?.some((b) => b.id === PRESENTATIONS_BUCKET)
  if (!exists) {
    const { error: createError } = await admin.storage.createBucket(PRESENTATIONS_BUCKET, {
      public: false,
      fileSizeLimit: MAX_PRESENTATION_BYTES,
      allowedMimeTypes: null,
    })
    if (createError && !/already exists/i.test(createError.message)) {
      throw new Error(createError.message)
    }
  }
  const { error: updateError } = await admin.storage.updateBucket(PRESENTATIONS_BUCKET, {
    public: false,
    fileSizeLimit: MAX_PRESENTATION_BYTES,
    allowedMimeTypes: null,
  })
  if (updateError) {
    const { data: bucketsAfter } = await admin.storage.listBuckets()
    const current = bucketsAfter?.find((b) => b.id === PRESENTATIONS_BUCKET)
    const limit = Number(current?.file_size_limit)
    if (!Number.isFinite(limit) || limit < MAX_PRESENTATION_BYTES) {
      throw new Error(updateError.message)
    }
  }
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

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, class_id")
      .eq("id", sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const { data: cls } = await supabase
      .from("classes")
      .select("teacher_id")
      .eq("id", session.class_id)
      .single()

    if (!cls || cls.teacher_id !== user.id) {
      return NextResponse.json({ error: "Not authorized to upload presentation" }, { status: 403 })
    }

    const service = createServiceClient()
    const admin = service ?? createAdminClient()
    const slideCount = getEstimatedSlideCount(fileSize)
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_")
    const timestamp = Date.now()
    const storagePath = `${user.id}/${sessionId}/${timestamp}_${safeFileName}`
    const storageClient = admin ?? supabase
    const [bucketResult, signedResult] = await Promise.all([
      service ? ensurePresentationsBucket(service).then(() => null).catch((e: unknown) => e) : Promise.resolve(null),
      storageClient.storage.from(PRESENTATIONS_BUCKET).createSignedUploadUrl(storagePath),
    ])
    if (bucketResult) {
      const message = bucketResult instanceof Error ? bucketResult.message : "unknown error"
      return NextResponse.json(
        { error: `Không nâng được hạn mức kho lưu trữ lên 200 MB: ${message}` },
        { status: 502 },
      )
    }
    let { data: signedUpload, error: signedUploadError } = signedResult

    if ((!signedUpload?.token || signedUploadError) && admin && admin !== supabase) {
      const fallback = await supabase.storage
        .from(PRESENTATIONS_BUCKET)
        .createSignedUploadUrl(storagePath)
      signedUpload = fallback.data
      signedUploadError = fallback.error
    }

    if (signedUploadError || !signedUpload?.token) {
      return NextResponse.json(
        { error: `Không tạo được đường dẫn upload: ${signedUploadError?.message ?? "unknown error"}` },
        { status: 502 },
      )
    }

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
