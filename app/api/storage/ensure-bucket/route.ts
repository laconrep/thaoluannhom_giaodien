import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/admin"
import { MAX_PRESENTATION_BYTES, PRESENTATIONS_BUCKET } from "@/lib/storage-upload"

const SUBMISSIONS_BUCKET = "submissions"

function parseLimit(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { bucket?: string }
  const bucket = body.bucket ?? SUBMISSIONS_BUCKET
  const isPresentations = bucket === PRESENTATIONS_BUCKET
  const fileSizeLimit = isPresentations ? MAX_PRESENTATION_BYTES : 50 * 1024 * 1024

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
      return NextResponse.json({ ok: false, error: listError.message, bucket }, { status: 502 })
    }

    const current = buckets?.find((b) => b.id === bucket)
    if (!current) {
      const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit,
        allowedMimeTypes: null,
      })
      if (createError && !/already exists/i.test(createError.message)) {
        return NextResponse.json({ ok: false, error: createError.message, bucket }, { status: 502 })
      }
    }

    const { error: updateError } = await supabase.storage.updateBucket(bucket, {
      public: false,
      fileSizeLimit,
      allowedMimeTypes: null,
    })
    if (updateError) {
      const after = (await supabase.storage.listBuckets()).data?.find((b) => b.id === bucket)
      const limit = parseLimit(after?.file_size_limit)
      return NextResponse.json({
        ok: limit !== null && limit >= fileSizeLimit,
        bucket,
        fileSizeLimit: limit,
        error: updateError.message,
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
    return NextResponse.json({ ok: false, error: e?.message ?? "Lỗi không xác định" }, { status: 500 })
  }
}
