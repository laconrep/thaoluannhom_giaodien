/**
 * T5: nén ảnh phía client trước khi upload.
 *
 * Ảnh chụp bằng điện thoại thường 3–12MB → resize về tối đa 1920px,
 * JPEG chất lượng 0.85 (vẫn đủ nét để chấm bài và AI đọc).
 * An toàn: chỉ nén file >1MB, bỏ qua GIF, nén lỗi → trả file gốc,
 * bản nén không nhỏ hơn → giữ file gốc.
 */
const MAX_DIMENSION = 1920
const MIN_SIZE_TO_COMPRESS = 1024 * 1024 // 1MB
const JPEG_QUALITY = 0.85

export async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file
  if (file.type === "image/gif") return file // giữ ảnh động nguyên vẹn
  if (file.size <= MIN_SIZE_TO_COMPRESS) return file
  try {
    if (typeof createImageBitmap === "undefined") return file
    const bitmap = await createImageBitmap(file)
    try {
      const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
      const w = Math.max(1, Math.round(bitmap.width * scale))
      const h = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) return file
      ctx.drawImage(bitmap, 0, 0, w, h)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      )
      if (!blob || blob.size >= file.size) return file
      const name = file.name.replace(/\.(png|webp|bmp|jpeg)$/i, ".jpg")
      return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() })
    } finally {
      bitmap.close()
    }
  } catch {
    return file
  }
}
