/**
 * Trích text đáp án mẫu từ file .docx / .pdf (chạy phía trình duyệt).
 * - .docx: mammoth → HTML → bảng chuyển thành bảng markdown pipe, text còn lại giữ xuống dòng.
 * - .pdf: pdfjs-dist đọc từng trang (getTextContent), nối items bằng khoảng trắng.
 */
export async function extractAnswerFromFile(
  file: File,
): Promise<{ text: string; tables: number; chars: number }> {
  const name = file.name.toLowerCase()
  let text = ""
  let tables = 0

  if (name.endsWith(".docx")) {
    const r = await extractDocx(file)
    text = r.text
    tables = r.tables
  } else if (name.endsWith(".pdf")) {
    text = await extractPdf(file)
  } else {
    throw new Error("Chỉ nhận file .docx hoặc .pdf")
  }

  text = text.trim()
  if (!text) throw new Error("Không đọc được nội dung từ file này.")
  return { text, tables, chars: text.length }
}

const BLOCK_TAGS = new Set([
  "P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "DIV",
  "UL", "OL", "BLOCKQUOTE", "PRE", "HR", "FIGURE", "SECTION", "ARTICLE",
])

function tableToMarkdown(table: HTMLTableElement): string {
  const rows = Array.from(table.rows)
    .map((tr) =>
      Array.from(tr.cells).map((c) =>
        (c.textContent ?? "").replace(/\s+/g, " ").trim().replace(/\|/g, "¦"),
      ),
    )
    .filter((r) => r.some((c) => c !== ""))
  if (rows.length === 0) return ""
  const cols = Math.max(...rows.map((r) => r.length))
  const norm = rows.map((r) => {
    const n = [...r]
    while (n.length < cols) n.push("")
    return n
  })
  const lines = norm.map((r) => `| ${r.join(" | ")} |`)
  // Dòng đầu làm header để AI dễ đọc cấu trúc bảng.
  lines.splice(1, 0, `| ${Array(cols).fill("---").join(" | ")} |`)
  return lines.join("\n")
}

function htmlToText(doc: Document): { text: string; tables: number } {
  let tables = 0
  const lines: string[] = []
  let current = ""
  const flush = () => {
    const t = current.replace(/\s+/g, " ").trim()
    if (t) lines.push(t)
    current = ""
  }
  const walk = (node: Node): void => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const tag = el.tagName
      if (tag === "TABLE") {
        flush()
        const md = tableToMarkdown(el as HTMLTableElement)
        if (md) {
          lines.push(md)
          tables += 1
        }
        return
      }
      if (tag === "BR") {
        flush()
        return
      }
      const isBlock = BLOCK_TAGS.has(tag)
      if (isBlock) flush()
      el.childNodes.forEach(walk)
      if (isBlock) flush()
      return
    }
    if (node.nodeType === Node.TEXT_NODE) {
      current += node.textContent ?? ""
    }
  }
  if (doc.body) walk(doc.body)
  flush()
  return { text: lines.join("\n").replace(/\n{3,}/g, "\n\n"), tables }
}

async function extractDocx(file: File): Promise<{ text: string; tables: number }> {
  const mammoth = await import("mammoth")
  const { value: html } = await mammoth.convertToHtml({
    arrayBuffer: await file.arrayBuffer(),
  })
  const doc = new DOMParser().parseFromString(html, "text/html")
  return htmlToText(doc)
}

async function extractPdf(file: File): Promise<string> {
  // Dynamic import để pdfjs chỉ load trên trình duyệt, tránh lỗi SSR (giống pdf-pages.tsx).
  const pdfjs = await import("pdfjs-dist")
  // Worker tự host trong public/ để đúng version với pdfjs-dist đã cài.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
  const data = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const tc = await page.getTextContent()
    const line = (tc.items as Array<{ str?: string }>)
      .map((it) => it.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
    if (line) pages.push(line)
  }
  return pages.join("\n\n")
}
