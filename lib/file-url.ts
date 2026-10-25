// Tách bucket + path từ Supabase signed URL dạng:
//   https://<project>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=...
// App lưu signed URL (hạn 7 ngày) vào DB lúc HS nộp bài; hết hạn thì URL chết.
// Dùng hàm này để lấy path rồi xin cấp URL mới qua /api/submissions/signed-url.
// Các URL Supabase cũ trong DB vẫn tự chữa được nhờ đường này: route ký mới
// giờ trả URL B2 cho cùng object key (key giữ nguyên khi di dời sang B2).
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

// URL presigned B2 do app ký ra (virtual-host):
//   https://<bucket>.s3.<region>.backblazeb2.com/<key>?X-Amz-Signature=...
// Nhận diện bằng hậu tố host + tham số ký — không cần biết tên bucket hay
// endpoint cụ thể ở phía client (2 thứ đó không phải secret nhưng nằm ở env
// server; client chỉ cần biết "đây là URL B2 có hạn, xin cấp mới khi hết").
export function parseB2Url(url: string | undefined | null): { path: string } | null {
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
  return { path: segments.join("/") }
}

export function isB2Url(url: string | undefined | null): boolean {
  return parseB2Url(url) !== null
}
