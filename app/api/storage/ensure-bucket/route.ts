import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const SUBMISSIONS_BUCKET = "submissions"

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { bucket?: string }
  const bucket = body.bucket ?? SUBMISSIONS_BUCKET

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase chưa được cấu hình." }, { status: 500 })
  }

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    if (!listError && buckets?.some((b) => b.id === bucket)) {
      return NextResponse.json({ ok: true, bucket, created: false })
    }

    const { error: createError } = await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: bucket === "presentations" ? 200 * 1024 * 1024 : 50 * 1024 * 1024,
      ...(bucket === "presentations"
        ? {
            allowedMimeTypes: [
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              "application/vnd.ms-powerpoint",
              "application/zip",
            ],
          }
        : {}),
    })
    if (createError) {
      return NextResponse.json(
        { ok: false, error: createError.message, bucket },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true, bucket, created: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Lỗi không xác định" }, { status: 500 })
  }
}
