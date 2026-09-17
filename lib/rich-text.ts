// Nội dung bài nộp được lưu ở cột submissions.text_content dưới 2 dạng:
//  - Bài cũ: văn bản thuần (plain text).
//  - Bài mới: HTML do trình soạn thảo tạo ra (có thể chứa bảng, ảnh).
// Các hàm dưới đây giúp nhận biết và chuẩn hoá an toàn cho cả 2 dạng.
//
// Sanitize không dùng isomorphic-dompurify/jsdom: trên Vercel serverless,
// html-encoding-sniffer require() ESM @exodus/bytes và làm hỏng mọi server action
// (chọn nhóm, nộp bài, chụp ảnh).

const ALLOWED_TAGS = new Set([
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
])

const VOID_TAGS = new Set(["br", "img", "hr"])

const ALLOWED_ATTR = new Set([
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
])

const URI_ATTRS = new Set(["href", "src"])

const DROP_CONTENT_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "noscript",
  "template",
  "svg",
  "math",
  "form",
  "input",
  "textarea",
  "button",
  "select",
  "option",
  "video",
  "audio",
  "source",
  "canvas",
  "applet",
  "base",
  "frame",
  "frameset",
])

// Chỉ cho phép link http/https/mailto/tel và đường dẫn tương đối.
// Chặn javascript:, data: (không nhúng base64 vào bài nộp) và các scheme lạ.
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i

const BLOCK_TAG_REGEXP =
  /<(p|br|div|span|strong|b|em|i|u|s|del|h[1-6]|ul|ol|li|blockquote|table|thead|tbody|tr|th|td|img|a|code|pre|hr)\b[^>]*>/i

const TAG_REGEXP = /<\/?[a-z][^>]*>/gi

const ATTR_REGEXP = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi

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

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : ""
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : ""
    })
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
}

function stripControlChars(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "")
}

function isSafeUri(value: string): boolean {
  const decoded = stripControlChars(decodeHtmlEntities(value)).trim()
  if (!decoded) return false
  if (/^(?:javascript|vbscript|data)\s*:/i.test(decoded)) return false
  return ALLOWED_URI_REGEXP.test(decoded)
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}

function sanitizeAttrs(tag: string, rawAttrs: string): { attrs: string; dropTag: boolean } {
  let out = ""
  let hasSafeSrc = tag !== "img"
  ATTR_REGEXP.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ATTR_REGEXP.exec(rawAttrs))) {
    const name = match[1].toLowerCase()
    if (name.startsWith("on") || name === "style" || name.startsWith("xmlns")) continue
    if (!ALLOWED_ATTR.has(name)) continue
    const rawValue = match[2] ?? match[3] ?? match[4] ?? ""
    if (URI_ATTRS.has(name)) {
      if (!isSafeUri(rawValue)) continue
      const decoded = stripControlChars(decodeHtmlEntities(rawValue)).trim()
      if (name === "src" && tag === "img") {
        if (/^data:/i.test(decoded)) continue
        hasSafeSrc = true
      }
    }
    if (name === "target" && rawValue !== "_blank" && rawValue !== "_self") continue
    if ((name === "colspan" || name === "rowspan") && !/^\d{1,4}$/.test(rawValue)) continue
    if (name === "class" && !/^[\w\s-]*$/.test(rawValue)) continue
    if (name === "rel" && !/^[\w\s-]*$/.test(rawValue)) continue
    out += ` ${name}="${escapeAttr(rawValue)}"`
  }
  if (tag === "a" && /\starget="_blank"/.test(out) && !/\srel=/.test(out)) {
    out += ` rel="noopener noreferrer"`
  }
  return { attrs: out, dropTag: tag === "img" && !hasSafeSrc }
}

function dropDangerousBlocks(html: string): string {
  let out = html.replace(/<!--[\s\S]*?-->/g, "")
  out = out.replace(/<\?[\s\S]*?\?>/g, "")
  out = out.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, "")
  out = out.replace(/<!DOCTYPE[\s\S]*?>/gi, "")
  const drop = Array.from(DROP_CONTENT_TAGS).join("|")
  out = out.replace(new RegExp(`<(?:${drop})\\b[^>]*>[\\s\\S]*?<\\/(?:${drop})>`, "gi"), "")
  out = out.replace(new RegExp(`<(?:${drop})\\b[^>]*\\/?>`, "gi"), "")
  return out
}

export function sanitizeSubmissionHtml(html: string): string {
  if (!html) return ""
  const prepared = dropDangerousBlocks(html)
  return prepared.replace(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b([^>]*)>/g, (full, rawTag, rawAttrs) => {
    const isClose = full.startsWith("</")
    const tag = String(rawTag).toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ""
    if (isClose) return VOID_TAGS.has(tag) ? "" : `</${tag}>`
    const { attrs, dropTag } = sanitizeAttrs(tag, rawAttrs ?? "")
    if (dropTag) return ""
    if (VOID_TAGS.has(tag)) return `<${tag}${attrs}>`
    return `<${tag}${attrs}>`
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
