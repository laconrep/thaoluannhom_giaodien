import type { SubmissionFile } from "@/lib/types"
import { toPlainText } from "@/lib/rich-text"

/**
 * Chấm bài bằng Muse qua Meta Model API (OpenAI-compatible).
 * Contract I/O giữ giống hệt lib/ai/gemini-grade.ts để run-grade-job
 * có thể đổi provider mà không sửa logic job/sweep/duyệt.
 */

const MUSE_API_BASE = "https://api.meta.ai/v1"
const DEFAULT_MODEL = "muse-spark-1.3-contributor"
const MAX_IMAGES = 4
const MAX_EDGE = 1600
const JPEG_QUALITY = 78
const MAX_INLINE_BYTES = 4 * 1024 * 1024

export type MuseGradeInput = {
  apiKey: string
  model?: string
  title: string
  rubric: string | null
  maxScore: number
  textContent: string | null
  files: SubmissionFile[]
}

export type MuseGradeOutput = {
  score: number | null
  feedback: string
  transcript: string
  unreadable: boolean
}

type InlineImage = { mimeType: string; data: string }

function stripHtmlImages(raw: string | null): string {
  return toPlainText(raw)
}

async function fetchBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    if (!ab.byteLength) return null
    return Buffer.from(ab)
  } catch {
    return null
  }
}

function guessMime(file: SubmissionFile): string {
  if (file.mime && file.mime.startsWith("image/")) return file.mime
  const n = (file.name || "").toLowerCase()
  if (n.endsWith(".png")) return "image/png"
  if (n.endsWith(".webp")) return "image/webp"
  if (n.endsWith(".gif")) return "image/gif"
  return "image/jpeg"
}

async function prepareImage(file: SubmissionFile): Promise<InlineImage | null> {
  if (file.kind !== "image" || !file.url) return null
  const buf = await fetchBuffer(file.url)
  if (!buf) return null
  try {
    const sharpMod = await import("sharp")
    const sharp = sharpMod.default ?? sharpMod
    let img = sharp(buf, { failOn: "none" }).rotate()
    const rot = file.rotation ?? 0
    if (rot === 90 || rot === 180 || rot === 270) {
      img = img.rotate(rot)
    }
    const jpeg = await img
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer()
    if (jpeg.length > MAX_INLINE_BYTES) return null
    return { mimeType: "image/jpeg", data: jpeg.toString("base64") }
  } catch {
    if (buf.length > MAX_INLINE_BYTES) return null
    return { mimeType: guessMime(file), data: buf.toString("base64") }
  }
}

function parseJsonPayload(raw: string): MuseGradeOutput {
  const trimmed = raw.trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  const slice = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(slice) as Record<string, unknown>
  } catch {
    return {
      score: null,
      feedback: trimmed.slice(0, 800) || "Không đọc được kết quả AI.",
      transcript: "",
      unreadable: true,
    }
  }
  const unreadable = Boolean(parsed.unreadable)
  const num = typeof parsed.score === "number" ? parsed.score : Number(parsed.score)
  const score = unreadable || !Number.isFinite(num) ? null : num
  return {
    score,
    feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
    transcript: typeof parsed.transcript === "string" ? parsed.transcript : "",
    unreadable,
  }
}

function museErrorMessage(status: number, errText: string): string {
  let parsed: { error?: { message?: string } } = {}
  try {
    parsed = JSON.parse(errText) as typeof parsed
  } catch {
    parsed = {}
  }
  const msg = parsed.error?.message || errText.slice(0, 280) || `Muse lỗi ${status}`
  if (status === 401 || /invalid api key|unauthorized/i.test(msg)) return "API key Muse không hợp lệ."
  if (status === 403) return "API key Muse bị từ chối. Kiểm tra quyền truy cập Model API."
  if (status === 429) return "Muse hết hạn mức tạm thời. Thử lại sau."
  if (status === 404 || /not found|does not exist/i.test(msg)) return `Model không hỗ trợ: ${msg}`
  return msg.slice(0, 280)
}

type ChatMessage = {
  role: "system" | "user"
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >
}

async function callMuse(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<{ ok: true; raw: string } | { ok: false; status: number; errText: string }> {
  const res = await fetch(`${MUSE_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages,
    }),
  })
  const errText = res.ok ? "" : await res.text().catch(() => "")
  if (!res.ok) return { ok: false, status: res.status, errText }
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
  }
  const raw = body.choices?.[0]?.message?.content ?? ""
  if (!raw.trim()) {
    return { ok: false, status: 200, errText: "Muse không trả kết quả." }
  }
  return { ok: true, raw }
}

export async function gradeSubmissionWithMuse(
  input: MuseGradeInput,
): Promise<MuseGradeOutput> {
  const images: InlineImage[] = []
  for (const file of input.files) {
    if (images.length >= MAX_IMAGES) break
    const prepared = await prepareImage(file)
    if (prepared) images.push(prepared)
  }

  const text = stripHtmlImages(input.textContent)
  const skipped = Math.max(0, input.files.filter((f) => f.kind === "image").length - images.length)
  const rubric = (input.rubric ?? "").trim() || "Chưa có đáp án/tiêu chí. Chỉ nhận xét, không bịa điểm chắc chắn."
  const maxScore = Number.isFinite(input.maxScore) && input.maxScore > 0 ? input.maxScore : 10

  if (!text && images.length === 0) {
    return {
      score: null,
      feedback: skipped
        ? "Không tải được ảnh bài nộp để chấm."
        : "Không có chữ hay ảnh để chấm.",
      transcript: "",
      unreadable: true,
    }
  }

  const userText = [
    `Tên phiên: ${input.title}`,
    `Thang điểm: 0–${maxScore}`,
    `Tiêu chí / đáp án:\n${rubric}`,
    text ? `Bài gõ của học sinh:\n${text}` : "Không có bài gõ.",
    skipped > 0 ? `Còn ${skipped} ảnh chưa gửi vì không tải được hoặc vượt hạn mức.` : "",
    "Nếu bài là ảnh chữ viết tay: chép lại nội dung đọc được vào transcript. Chỗ không đọc được ghi [?].",
    "Nếu đọc được dưới khoảng 50% bài, đặt unreadable=true và score=null, không bịa điểm.",
  ]
    .filter(Boolean)
    .join("\n")

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Bạn là giáo viên THPT, chấm bài học sinh tiếng Việt. " +
        'Luôn trả về DUY NHẤT một JSON hợp lệ dạng {"score": number|null, "feedback": string, "transcript": string, "unreadable": boolean}. ' +
        "Không thêm bất kỳ văn bản nào ngoài JSON.",
    },
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        ...images.map((img) => ({
          type: "image_url" as const,
          image_url: { url: `data:${img.mimeType};base64,${img.data}` },
        })),
      ],
    },
  ]

  const model = input.model?.trim() || process.env.MUSE_MODEL || DEFAULT_MODEL
  const result = await callMuse(input.apiKey, model, messages)
  if (!result.ok) {
    throw new Error(museErrorMessage(result.status, result.errText))
  }
  const out = parseJsonPayload(result.raw)
  if (out.score !== null) {
    out.score = Math.max(0, Math.min(maxScore, Math.round(out.score * 4) / 4))
  }
  return out
}
