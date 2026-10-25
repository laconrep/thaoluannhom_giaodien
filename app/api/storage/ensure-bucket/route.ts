import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/admin"
import { MAX_PRESENTATION_BYTES, PRESENTATIONS_BUCKET } from "@/lib/storage-upload"
import {
  MAX_SUBMISSION_IMAGE_BYTES,
  SUBMISSION_MEDIA_BUCKET,
  SUBMISSION_IMAGE_MIME_TYPES,
} from "@/lib/submission-media"
import { checkApiRateLimit } from "@/lib/rate-limit"

const SUBMISSIONS_BUCKET = "submissions"

function parseLimit(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

type BucketConfig = {
  public: boolean
  fileSizeLimit: number
  allowedMimeTypes: string[] | null
}

function configFor(bucket: string): BucketConfig {
  if (bucket === PRESENTATIONS_BUCKET) {
    return { public: false, fileSizeLimit: MAX_PRESENTATION_BYTES, allowedMimeTypes: null }
  }
  if (bucket === SUBMISSION_MEDIA_BUCKET) {
    return {
      public: true,
      fileSizeLimit: MAX_SUBMISSION_IMAGE_BYTES,
      allowedMimeTypes: SUBMISSION_IMAGE_MIME_TYPES,
    }
  }
  return { public: false, fileSizeLimit: 50 * 1024 * 1024, allowedMimeTypes: null }
}

export async function POST(request: NextRequest) {
  if (!checkApiRateLimit(request)) {
    return NextResponse.json(
      { ok: false, error: "Gửi quá nhiều yêu cầu, thử lại sau." },
      { status: 429 },
    )
  }
  const body = (await request.json().catch(() => ({}))) as { bucket?: string }
  const bucket = body.bucket ?? SUBMISSIONS_BUCKET
  // Bảo mật 24/10/2026 (GĐ2): trước đây nhận tên bucket tùy ý để tạo/sửa
  // bucket bằng service key. Giờ chỉ đúng 3 bucket của app, cấu hình cố định
  // theo configFor (caller không chỉnh được limit/public). Route vẫn cho ẩn
  // danh gọi vì trang nộp bài của HS cũng gọi nó (lỗi ở đó chỉ warn).
  const ALLOWED_BUCKETS = [SUBMISSIONS_BUCKET, PRESENTATIONS_BUCKET, SUBMISSION_MEDIA_BUCKET]
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return NextResponse.json({ ok: false, error: "Bucket không hợp lệ.", bucket }, { status: 400 })
  }

  // Chuyển sang B2 (24/10/2026): bucket B2 đã tạo sẵn ngoài app (private,
  // không giới hạn từng file như Supabase) nên không còn gì để "ensure" —
  // trả ok ngay để trang nộp bài không kẹt. Chỉ submission-media vẫn ở
  // Supabase nên vẫn chạy tiếp logic cũ bên dưới.
  if (bucket === SUBMISSIONS_BUCKET || bucket === PRESENTATIONS_BUCKET) {
    const fileSizeLimit =
      bucket === PRESENTATIONS_BUCKET ? MAX_PRESENTATION_BYTES : 50 * 1024 * 1024
    return NextResponse.json({ ok: true, bucket, created: false, fileSizeLimit })
  }

  const config = configFor(bucket)
  const fileSizeLimit = config.fileSizeLimit

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Thiếu SUPABASE_SERVICE_ROLE_KEY nên không nâng được hạn mức kho lưu trữ." },
      { status: 500 },
    )
  }

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    if (listError) {
      // Bảo mật 24/10/2026 (GĐ4): không trả message thô của Supabase.
      console.error("[ensure-bucket]", listError)
      return NextResponse.json(
        { ok: false, error: "Không đọc được kho lưu trữ.", bucket },
        { status: 502 },
      )
    }

    const current = buckets?.find((b) => b.id === bucket)
    if (!current) {
      const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: config.public,
        fileSizeLimit,
        allowedMimeTypes: config.allowedMimeTypes,
      })
      if (createError && !/already exists/i.test(createError.message)) {
        console.error("[ensure-bucket]", createError)
        return NextResponse.json(
          { ok: false, error: "Không tạo được kho lưu trữ.", bucket },
          { status: 502 },
        )
      }
    }

    const { error: updateError } = await supabase.storage.updateBucket(bucket, {
      public: config.public,
      fileSizeLimit,
      allowedMimeTypes: config.allowedMimeTypes,
    })
    if (updateError) {
      const after = (await supabase.storage.listBuckets()).data?.find((b) => b.id === bucket)
      const limit = parseLimit(after?.file_size_limit)
      console.error("[ensure-bucket]", updateError)
      return NextResponse.json({
        ok: limit !== null && limit >= fileSizeLimit,
        bucket,
        fileSizeLimit: limit,
        error: "Không nâng được hạn mức kho lưu trữ.",
      })
    }

    const after = (await supabase.storage.listBuckets()).data?.find((b) => b.id === bucket)
    return NextResponse.json({
      ok: true,
      bucket,
      created: !current,
      fileSizeLimit: parseLimit(after?.file_size_limit) ?? fileSizeLimit,
    })
  } catch (e: any) {
    console.error("[ensure-bucket]", e)
    return NextResponse.json({ ok: false, error: "Lỗi kho lưu trữ." }, { status: 500 })
  }
}
