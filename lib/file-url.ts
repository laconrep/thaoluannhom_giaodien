// Tách bucket + path từ Supabase signed URL dạng:
//   https://<project>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=...
// App lưu signed URL (hạn 7 ngày) vào DB lúc HS nộp bài; hết hạn thì URL chết.
// Dùng hàm này để lấy path rồi xin cấp URL mới qua /api/submissions/signed-url.
const SIGN_RE = /\/storage\/v1\/object\/sign\/([^/?#]+)\/([^?#]+)/

export function parseSignUrl(
  url: string | undefined | null,
): { bucket: string; path: string } | null {
  if (!url) return null
  const m = SIGN_RE.exec(url)
  if (!m) return null
  try {
    return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) }
  } catch {
    return null
  }
}

export function isSignUrl(url: string | undefined | null): boolean {
  return parseSignUrl(url) !== null
}
