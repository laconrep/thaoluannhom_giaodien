import sanitizeHtml from "sanitize-html"

// Nội dung bài nộp được lưu ở cột submissions.text_content dưới 2 dạng:
//  - Bài cũ: văn bản thuần (plain text).
//  - Bài mới: HTML do trình soạn thảo tạo ra (có thể chứa bảng, ảnh).
// Dùng sanitize-html (không kéo jsdom) để chạy được trên Vercel Node.

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
  const withoutDataImages = html.replace(/<img\b[^>]*>/gi, (tag) =>
    /src\s*=\s*["']\s*data:/i.test(tag) ? "" : tag,
  )
  return sanitizeHtml(withoutDataImages, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel", "title", "class"],
      img: ["src", "alt", "title", "class"],
      td: ["colspan", "rowspan", "colwidth", "class"],
      th: ["colspan", "rowspan", "colwidth", "class"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["http", "https"],
      a: ["http", "https", "mailto", "tel"],
    },
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
  })
}

export function plainTextToHtml(text: string): string {
  if (!text) return ""
  const escaped = escapeHtml(text).replace(/ {2,}/g, (spaces) => "&nbsp;".repeat(spaces.length))
  return `<p>${escaped.replace(/\r\n|\r|\n/g, "<br>")}</p>`
}

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
