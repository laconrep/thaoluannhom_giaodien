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

export function resolveSignedUploadUrl(
  signedUrl?: string,
  path?: string,
  token?: string,
  bucket = PRESENTATIONS_BUCKET,
): string {
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
  return `${base}/storage/v1/object/upload/sign/${bucket}/${encoded}?token=${encodeURIComponent(token)}`
}

export function fileContentType(file: File): string {
  if (file.type) return file.type
  const name = file.name.toLowerCase()
  if (/\.jpe?g$/.test(name)) return "image/jpeg"
  if (/\.png$/.test(name)) return "image/png"
  if (/\.webp$/.test(name)) return "image/webp"
  if (/\.gif$/.test(name)) return "image/gif"
  if (/\.heic$/.test(name) || /\.heif$/.test(name)) return "image/heic"
  if (/\.pdf$/.test(name)) return "application/pdf"
  if (/\.docx$/.test(name)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }
  if (/\.pptx$/.test(name)) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  }
  return "application/octet-stream"
}

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
}

export function fileExtension(file: File): string {
  const name = file.name || ""
  const dot = name.lastIndexOf(".")
  if (dot > 0) {
    const fromName = name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "")
    if (fromName) return fromName
  }
  const fromMime = MIME_TO_EXT[file.type]
  if (fromMime) return fromMime
  if (file.type.startsWith("image/")) return "jpg"
  return "bin"
}

export async function putToSignedUploadUrl(opts: {
  signedUrl?: string
  path: string
  token: string
  bucket: string
  file: File
  contentType?: string
}): Promise<void> {
  const uploadUrl = resolveSignedUploadUrl(opts.signedUrl, opts.path, opts.token, opts.bucket)
  if (!uploadUrl) throw new Error("Không tạo được đường dẫn tải lên kho lưu trữ.")

  const contentType = opts.contentType || fileContentType(opts.file)
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "x-upsert": "true",
  }

  let res = await fetch(uploadUrl, { method: "PUT", headers, body: opts.file })
  if (res.status === 401 || res.status === 403) {
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      ""
    if (anonKey) {
      res = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          ...headers,
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: opts.file,
      })
    }
  }
  if (res.ok) return

  const raw = await res.text().catch(() => "")
  let detail = raw.slice(0, 280)
  try {
    const json = JSON.parse(raw) as { message?: string; error?: string }
    detail = json.message || json.error || detail
  } catch {
    /* keep text */
  }
  throw new Error(`Không tải được tệp ${opts.file.name}${detail ? `: ${detail}` : "."}`)
}
