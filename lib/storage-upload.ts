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
