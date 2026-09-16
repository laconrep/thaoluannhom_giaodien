// Cấu hình bucket ảnh chèn trong bài nộp của học sinh.
// Bucket public để URL ảnh nhúng trong bài viết không hết hạn.
export const SUBMISSION_MEDIA_BUCKET = "submission-media"
export const MAX_SUBMISSION_IMAGE_BYTES = 5 * 1024 * 1024
export const SUBMISSION_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]
export const SUBMISSION_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"]
export const SUBMISSION_IMAGE_ACCEPT = SUBMISSION_IMAGE_MIME_TYPES.join(",")

function supabaseBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").replace(/\/$/, "")
}

function encodePath(path: string): string {
  return path
    .replace(/^\/+/, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/")
}

// Dựng URL PUT để client tải ảnh trực tiếp lên signed URL của Supabase.
export function submissionMediaSignedUploadUrl(path: string, token: string): string {
  return `${supabaseBaseUrl()}/storage/v1/object/upload/sign/${SUBMISSION_MEDIA_BUCKET}/${encodePath(path)}?token=${encodeURIComponent(token)}`
}

export function submissionMediaPublicUrl(path: string): string {
  return `${supabaseBaseUrl()}/storage/v1/object/public/${SUBMISSION_MEDIA_BUCKET}/${encodePath(path)}`
}

// Sinh đường dẫn lưu ảnh: tách theo phiên + nhóm/ô để dễ truy vết và dọn dẹp.
export function submissionMediaPath(parts: {
  sessionId: string
  targetId: string
  fileName: string
}): string {
  const ext = (parts.fileName.split(".").pop() ?? "png").toLowerCase()
  const safeExt = SUBMISSION_IMAGE_EXTENSIONS.includes(ext) ? ext : "png"
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return `${parts.sessionId}/${parts.targetId}/${unique}.${safeExt}`
}
