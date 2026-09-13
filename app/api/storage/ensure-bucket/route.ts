import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const SUBMISSIONS_BUCKET = "submissions"
const PRESENTATIONS_BUCKET = "presentations"

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { bucket?: string }
  const bucket = body.bucket ?? SUBMISSIONS_BUCKET

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase chưa được cấu hình." }, { status: 500 })
  }

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    const exists = !listError && buckets?.some((b) => b.id === bucket)
    if (!exists) {
      const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit: bucket === PRESENTATIONS_BUCKET ? 200 * 1024 * 1024 : 50 * 1024 * 1024,
        allowedMimeTypes: null,
      })
      if (createError && !/already exists/i.test(createError.message)) {
        return NextResponse.json(
          { ok: false, error: createError.message, bucket },
          { status: 502 },
        )
      }
    }

    if (bucket === PRESENTATIONS_BUCKET) {
      await supabase.storage.updateBucket(PRESENTATIONS_BUCKET, {
        public: false,
        fileSizeLimit: 200 * 1024 * 1024,
        allowedMimeTypes: null,
      })
    }

    return NextResponse.json({ ok: true, bucket, created: !exists })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Lỗi không xác định" }, { status: 500 })
  }
}
