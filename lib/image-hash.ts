/**
 * Hash ảnh cảm nhận (perceptual aHash 8x8) + so sánh độ giống — phục vụ cảnh
 * báo trùng bài trong phiên cá nhân: cùng một tờ giấy mà 2 HS chụp 2 lần
 * khác nhau (góc, sáng, cắt cúp) vẫn cho hash gần nhau, khác hẳn ảnh 2 bài
 * khác nhau. Hash là 64 bit (16 ký tự hex) — KHÔNG khôi phục được ảnh gốc
 * nên không lộ nội dung bài của HS khác.
 *
 * File này dùng được cả phía client (tính hash lúc nộp bài) lẫn server
 * (so sánh hash) — không import supabase hay secret nào.
 */

/** Tính aHash 8x8 của một ảnh (File/Blob). Lỗi → undefined (không chặn nộp bài). */
export async function computeImageHash(blob: Blob): Promise<string | undefined> {
  try {
    const url = URL.createObjectURL(blob)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      const canvas = document.createElement("canvas")
      canvas.width = 8
      canvas.height = 8
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return undefined
      ctx.drawImage(img, 0, 0, 8, 8)
      const data = ctx.getImageData(0, 0, 8, 8).data
      const lum: number[] = []
      let sum = 0
      for (let i = 0; i < 64; i++) {
        const v = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
        lum.push(v)
        sum += v
      }
      const avg = sum / 64
      let hex = ""
      for (let i = 0; i < 64; i += 4) {
        let nibble = 0
        for (let b = 0; b < 4; b++) if (lum[i + b] >= avg) nibble |= 1 << (3 - b)
        hex += nibble.toString(16)
      }
      return hex.length === 16 ? hex : undefined
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch {
    return undefined
  }
}

function hamming(a: string, b: string): number | null {
  if (!/^[0-9a-f]{16}$/.test(a) || !/^[0-9a-f]{16}$/.test(b)) return null
  let dist = 0
  for (let i = 0; i < 16; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (x) {
      dist += x & 1
      x >>= 1
    }
  }
  return dist
}

/** Độ giống 0-100 từ 2 hash, null nếu hash không hợp lệ. */
export function hashSimilarity(a: string | undefined, b: string | undefined): number | null {
  if (!a || !b) return null
  const dist = hamming(a, b)
  if (dist === null) return null
  return Math.round(((64 - dist) / 64) * 100)
}

/** Ngưỡng cảnh báo: giống từ 90% trở lên mới gắn cờ (Hamming ≤ 6/64).
 * Dưới ngưỡng này vẫn có thể là cùng bài chụp lệch nhiều — nhưng cảnh báo
 * lỏng hơn sẽ gắn cờ nhầm bài khác nhau, gây phiền cho GV. */
export const DUPLICATE_IMAGE_THRESHOLD = 90

/** Chuẩn hoá nội dung chữ để so trùng tuyệt đối: bỏ thẻ HTML, gộp khoảng
 * trắng, bỏ khoảng trắng đầu/cuối. Giữ nguyên chữ hoa/thường và dấu. */
export function normalizeSubmissionText(html: string | null | undefined): string {
  if (!html) return ""
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}
