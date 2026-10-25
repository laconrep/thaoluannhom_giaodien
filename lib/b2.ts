// Kho file Backblaze B2 (tương thích S3) — thay Supabase Storage cho 2 bucket
// `submissions` (bài nộp + file đề prompts/) và `presentations` (bài giảng).
// Cả 2 "bucket logic" này cùng nằm trong MỘT bucket B2 duy nhất; route vẫn
// nhận tham số bucket logic như cũ để validateStoragePath phân biệt quy tắc
// (presentations: teacherId đầu path; submissions: sessionId/targetId).
//
// CHỈ dùng trong route handler / server action. Không import vào client
// component: file này đọc application key từ env phía server.
//
// Env vars (đặt trên Vercel, KHÔNG commit giá trị thật vào repo):
//   B2_ENDPOINT, B2_REGION, B2_BUCKET, B2_KEY_ID, B2_APPLICATION_KEY
// Bucket B2 để PRIVATE — mọi lượt đọc/ghi đều qua presigned URL có hạn.

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

/** 7 ngày — khớp hạn signed URL Supabase cũ mà DB đang lưu. */
export const B2_VIEW_EXPIRES_SECONDS = 60 * 60 * 24 * 7
/** 1 giờ — đủ cho 1 lần upload của HS/GV. */
export const B2_UPLOAD_EXPIRES_SECONDS = 60 * 60
/** 1 giờ — grader tải file về chấm. */
export const B2_GRADE_EXPIRES_SECONDS = 60 * 60

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim()
}

/** Đủ 5 env var thì mới ký được URL. Thiếu → route trả 500, không đoán mò. */
export function isB2Configured(): boolean {
  return Boolean(
    readEnv("B2_ENDPOINT") &&
      readEnv("B2_REGION") &&
      readEnv("B2_BUCKET") &&
      readEnv("B2_KEY_ID") &&
      readEnv("B2_APPLICATION_KEY"),
  )
}

export function b2Bucket(): string {
  return readEnv("B2_BUCKET")
}

let cached: S3Client | null = null

export function b2Client(): S3Client | null {
  if (!isB2Configured()) return null
  if (!cached) {
    cached = new S3Client({
      endpoint: `https://${readEnv("B2_ENDPOINT")}`,
      region: readEnv("B2_REGION"),
      credentials: {
        accessKeyId: readEnv("B2_KEY_ID"),
        secretAccessKey: readEnv("B2_APPLICATION_KEY"),
      },
      // B2 hỗ trợ cả 2 kiểu; để mặc định virtual-host
      // (https://<bucket>.s3.<region>.backblazeb2.com/<key>) cho URL gọn.
      forcePathStyle: false,
    })
  }
  return cached
}

/** Presigned PUT để client tải file trực tiếp lên B2 (không qua server). */
export async function presignB2Upload(key: string): Promise<string | null> {
  const client = b2Client()
  if (!client) return null
  try {
    return await getSignedUrl(client, new PutObjectCommand({ Bucket: b2Bucket(), Key: key }), {
      expiresIn: B2_UPLOAD_EXPIRES_SECONDS,
    })
  } catch (e) {
    console.error("[b2] presign upload failed", e)
    return null
  }
}

/** Presigned GET để trình xem / grader tải file qua HTTPS thuần. */
export async function presignB2Download(key: string, expiresIn: number): Promise<string | null> {
  const client = b2Client()
  if (!client) return null
  try {
    return await getSignedUrl(client, new GetObjectCommand({ Bucket: b2Bucket(), Key: key }), {
      expiresIn,
    })
  } catch (e) {
    console.error("[b2] presign download failed", e)
    return null
  }
}

/**
 * Kiểm tra object đã tồn tại chưa — thay cho upsert:false của Supabase.
 * Trả true nếu đã có, false nếu chưa có HOẶC probe lỗi (không chặn upload
 * vì lỗi probe; key upload vẫn duy nhất theo timestamp + random).
 */
export async function b2ObjectExists(key: string): Promise<boolean> {
  const client = b2Client()
  if (!client) return false
  try {
    await client.send(new HeadObjectCommand({ Bucket: b2Bucket(), Key: key }))
    return true
  } catch {
    return false
  }
}

/**
 * Tách object key từ URL presigned B2 do chính app ký ra.
 * Nhận cả 2 kiểu: virtual-host (<bucket>.s3.<region>.backblazeb2.com/<key>)
 * và path-style (s3.<region>.backblazeb2.com/<bucket>/<key>).
 * URL không phải B2 presigned → null (để caller giữ nguyên URL gốc).
 */
export function b2KeyFromUrl(url: string | undefined | null): string | null {
  if (!url) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (!u.hostname.endsWith(".backblazeb2.com")) return null
  if (!u.searchParams.has("X-Amz-Signature")) return null
  const segments = u.pathname
    .split("/")
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s)
      } catch {
        return s
      }
    })
  if (segments.length === 0) return null
  // Path-style: đoạn đầu là tên bucket → bỏ đi.
  if (segments[0] === b2Bucket()) segments.shift()
  if (segments.length === 0) return null
  return segments.join("/")
}
