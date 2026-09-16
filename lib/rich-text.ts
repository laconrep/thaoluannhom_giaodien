import DOMPurify from "isomorphic-dompurify"

// Nội dung bài nộp được lưu ở cột submissions.text_content dưới 2 dạng:
//  - Bài cũ: văn bản thuần (plain text).
//  - Bài mới: HTML do trình soạn thảo tạo ra (có thể chứa bảng, ảnh).
// Các hàm dưới đây giúp nhận biết và chuẩn hoá an toàn cho cả 2 dạng.

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img",
  "a",
  "span",
  "code",
  "pre",
  "hr",
]

const ALLOWED_ATTR = [
  "href",
  "target",
  "rel",
  "src",
  "alt",
  "title",
  "colspan",
  "rowspan",
  "colwidth",
  "class",
]

// Chỉ cho phép link http/https/mailto/tel và đường dẫn tương đối.
// Chặn javascript:, data: (không nhúng base64 vào bài nộp) và các scheme lạ.
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i

const BLOCK_TAG_REGEXP =
  /<(p|br|div|span|strong|b|em|i|u|s|del|h[1-6]|ul|ol|li|blockquote|table|thead|tbody|tr|th|td|img|a|code|pre|hr)\b[^>]*>/i

const TAG_REGEXP = /<\/?[a-z][^>]*>/gi

export function isHtmlContent(raw: string | null | undefined): boolean {
  if (!raw) return false
  return BLOCK_TAG_REGEXP.test(raw)
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function sanitizeSubmissionHtml(html: string): string {
  if (!html) return ""
  // DOMPurify mặc định vẫn cho phép ảnh base64 (data:), nhưng quy ước của app là
  // ảnh phải được tải lên storage → loại bỏ trước khi sanitize.
  const withoutDataImages = html.replace(/<img\b[^>]*>/gi, (tag) =>
    /src\s*=\s*["']\s*data:/i.test(tag) ? "" : tag,
  )
  return DOMPurify.sanitize(withoutDataImages, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
    KEEP_CONTENT: true,
  })
}

// Bài plain text cũ: escape ký tự đặc biệt rồi chuyển xuống dòng thành <br>,
// giữ các khoảng trắng lặp (thường là thụt lề) để không làm mất định dạng cũ.
export function plainTextToHtml(text: string): string {
  if (!text) return ""
  const escaped = escapeHtml(text).replace(/ {2,}/g, (spaces) => "&nbsp;".repeat(spaces.length))
  return `<p>${escaped.replace(/\r\n|\r|\n/g, "<br>")}</p>`
}

// Chuẩn hoá bất kỳ nội dung nào (cũ hoặc mới) thành HTML an toàn để render.
export function submissionToRenderableHtml(raw: string | null | undefined): string {
  if (!raw) return ""
  return isHtmlContent(raw) ? sanitizeSubmissionHtml(raw) : plainTextToHtml(raw)
}

export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return ""
  return html
    .replace(TAG_REGEXP, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
}

export function toPlainText(raw: string | null | undefined): string {
  if (!raw) return ""
  return isHtmlContent(raw) ? htmlToPlainText(raw) : raw.trim()
}

// Nội dung được coi là rỗng khi không có chữ và cũng không có ảnh.
// Nhờ vậy bài chỉ có bảng rỗng hoặc khoảng trắng vẫn bị chặn nộp.
export function isRichTextEmpty(raw: string | null | undefined): boolean {
  if (!raw) return true
  if (!isHtmlContent(raw)) return raw.trim().length === 0
  if (/<img\b/i.test(raw)) return false
  const text = raw
    .replace(TAG_REGEXP, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  return text.length === 0
}
