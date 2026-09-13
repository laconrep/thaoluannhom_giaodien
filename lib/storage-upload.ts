export const PRESENTATIONS_BUCKET = "presentations"
export const MAX_PRESENTATION_BYTES = 200 * 1024 * 1024

export function powerpointContentType(fileName: string, fileType?: string): string {
  const type = fileType || ""
  if (
    type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    type === "application/vnd.ms-powerpoint" ||
    type === "application/zip"
  ) {
    return type
  }
  if (/\.ppt$/i.test(fileName) && !/\.pptx$/i.test(fileName)) {
    return "application/vnd.ms-powerpoint"
  }
  return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

export function friendlyStorageError(message: string, fileSize?: number): string {
  if (/exceeded the maximum allowed size/i.test(message) || /maximum allowed size/i.test(message)) {
    const size = fileSize ? ` File đang tải: ${formatMegabytes(fileSize)}.` : ""
    return `File vượt dung lượng tối đa của kho lưu trữ.${size} Hạn mức bucket presentations cần là 200 MB.`
  }
  if (/mime type/i.test(message) || /not allowed/i.test(message)) {
    return "Kho lưu trữ đang chặn định dạng PowerPoint. Hãy chạy lại SQL cấu hình bucket presentations."
  }
  return message
}

export function resolveSignedUploadUrl(signedUrl?: string, path?: string, token?: string): string {
  const url = signedUrl || ""
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").replace(
    /\/$/,
    "",
  )
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  if (url.startsWith("/storage/v1")) return `${base}${url}`
  if (url.startsWith("/object/")) return `${base}/storage/v1${url}`
  if (url.startsWith("/")) return `${base}/storage/v1${url}`
  if (url) return `${base}/storage/v1/${url}`
  if (!path || !token) return ""
  const encoded = path
    .replace(/^\/+/, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/")
  return `${base}/storage/v1/object/upload/sign/presentations/${encoded}?token=${encodeURIComponent(token)}`
}
