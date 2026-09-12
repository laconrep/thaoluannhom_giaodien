import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { PLAN_DEFAULT, planLimits, type Plan } from "@/lib/plans"

const PRESENTATIONS_BUCKET = "presentations"

async function ensurePresentationsBucket(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
) {
  const { data: buckets, error: listError } = await admin.storage.listBuckets()
  if (!listError && buckets?.some((b) => b.id === PRESENTATIONS_BUCKET)) {
    return
  }
  const { error: createError } = await admin.storage.createBucket(PRESENTATIONS_BUCKET, {
    public: false,
    fileSizeLimit: 200 * 1024 * 1024,
    allowedMimeTypes: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
      "application/zip",
    ],
  })
  if (createError && !/already exists|duplicate/i.test(createError.message)) {
    throw createError
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
    const allowedTypes = new Set([
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
      "application/zip",
    ])

    if (!fileName || !sessionId || !Number.isFinite(fileSize)) {
      return NextResponse.json({ error: "Thiếu thông tin file hoặc sessionId" }, { status: 400 })
    }

    if (fileSize === 0 || fileSize > 200 * 1024 * 1024) {
      return NextResponse.json({ error: "File PowerPoint phải từ 1 byte đến 200 MB." }, { status: 400 })
    }

    if (!allowedTypes.has(fileType) && !/\.(pptx?|PPTX?)$/.test(fileName)) {
      return NextResponse.json({ error: "Chỉ hỗ trợ file PowerPoint .ppt hoặc .pptx." }, { status: 415 })
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

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: "Supabase chưa được cấu hình." }, { status: 500 })
    }

    try {
      await ensurePresentationsBucket(admin)
    } catch (bucketError) {
      const message = bucketError instanceof Error ? bucketError.message : "unknown error"
      return NextResponse.json(
        { error: `Không chuẩn bị được kho lưu trữ PowerPoint: ${message}` },
        { status: 502 },
      )
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_")
    const timestamp = Date.now()
    const storagePath = `${user.id}/${sessionId}/${timestamp}_${safeFileName}`
    const { data: signedUpload, error: signedUploadError } = await admin.storage
      .from(PRESENTATIONS_BUCKET)
      .createSignedUploadUrl(storagePath)

    if (signedUploadError || !signedUpload?.token || !signedUpload.signedUrl) {
      return NextResponse.json(
        {
          error: `Không tạo được đường dẫn tải lên. Kho lưu trữ PowerPoint chưa sẵn sàng${
            signedUploadError?.message ? `: ${signedUploadError.message}` : "."
          }`,
        },
        { status: 502 },
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ""
    const rawSignedUrl = signedUpload.signedUrl
    const signedUrl = rawSignedUrl.startsWith("http")
      ? rawSignedUrl
      : `${supabaseUrl.replace(/\/$/, "")}${rawSignedUrl.startsWith("/") ? "" : "/"}${rawSignedUrl}`

    if (!signedUrl.startsWith("http")) {
      return NextResponse.json(
        { error: "Không tạo được đường dẫn tải lên. Thiếu địa chỉ kho lưu trữ." },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success: true,
      upload: {
        path: signedUpload.path || storagePath,
        token: signedUpload.token,
        signedUrl,
      },
    })
  } catch (error) {
    console.error("Presentation upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
