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

export function storageAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ""
  )
}

export function storageUploadHeaders(
  token: string,
  contentType: string,
  upsert = false,
  anonKey = storageAnonKey(),
): Record<string, string> {
  const key = anonKey || token
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
    "Content-Type": contentType,
    "x-upsert": upsert ? "true" : "false",
  }
}

export function buildSignedUploadUrl(
  bucket: string,
  path: string,
  token: string,
  signedUrl?: string,
): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").replace(
    /\/$/,
    "",
  )
  if (signedUrl) {
    if (signedUrl.startsWith("http://") || signedUrl.startsWith("https://")) return signedUrl
    if (signedUrl.startsWith("/storage/v1")) return `${base}${signedUrl}`
    if (signedUrl.startsWith("/")) return `${base}/storage/v1${signedUrl}`
    return `${base}/storage/v1/${signedUrl}`
  }
  return `${base}/storage/v1/object/upload/sign/${bucket}/${path}?token=${encodeURIComponent(token)}`
}
