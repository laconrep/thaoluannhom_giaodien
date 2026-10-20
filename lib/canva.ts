// Nhận diện link Canva trong bài nộp của học sinh.
// HS thường dán link chia sẻ (canva.link/... hoặc canva.com/design/...) vào
// phần văn bản (text_content) thay vì nộp file. Các hàm ở đây trích link đó ra
// để khung chấm hiện trình xem Canva nhúng, và dựng URL nhúng chuẩn từ URL
// thiết kế đã được resolve (xem /api/canva/resolve).

const CANVA_URL_RE =
  /https?:\/\/(?:www\.)?(?:canva\.link\/[^\s"'<>)\]]+|canva\.com\/[^\s"'<>)\]]+)/i
const BARE_CANVA_RE =
  /(?:^|[\s(])(?:www\.)?(canva\.link\/[^\s"'<>)\]]+)/i

function cleanUrl(u: string): string {
  // Bỏ dấu câu thường dính cuối link khi HS dán trong câu văn.
  return u.replace(/[.,;!?]+$/, "")
}

export function extractCanvaUrl(
  text: string | null | undefined,
): string | null {
  if (!text) return null
  // text_content là HTML (rich text) — gỡ thẻ để regex chạy trên chữ thuần,
  // link cũng có thể nằm trong href của thẻ <a>.
  const plain = text.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&")
  const m = CANVA_URL_RE.exec(plain) ?? CANVA_URL_RE.exec(text)
  if (m) return cleanUrl(m[0])
  const b = BARE_CANVA_RE.exec(plain)
  if (b) return cleanUrl(`https://${b[1]}`)
  return null
}

export function isCanvaUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`)
    return (
      u.hostname === "canva.link" ||
      u.hostname === "canva.com" ||
      u.hostname === "www.canva.com"
    )
  } catch {
    return false
  }
}

// Từ URL thiết kế (đã resolve chuyển hướng) dựng URL nhúng chuẩn của Canva:
//   https://www.canva.com/design/<id>/<token>/view?embed
// Không nhận diện được mẫu design → trả null (nơi gọi tự fallback).
export function buildCanvaEmbedUrl(resolvedUrl: string): string | null {
  const m = /canva\.com\/design\/([^/]+)\/([^/]+)/.exec(resolvedUrl)
  if (!m) return null
  return `https://www.canva.com/design/${m[1]}/${m[2]}/view?embed`
}
