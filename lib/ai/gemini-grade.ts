import type { SubmissionFile } from "@/lib/types"
import { toPlainText } from "@/lib/rich-text"

export const GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
]
const MAX_IMAGES = 4
const MAX_EDGE = 1600
const JPEG_QUALITY = 78
const MAX_INLINE_BYTES = 4 * 1024 * 1024

export type GeminiGradeInput = {
  apiKey: string
  title: string
  rubric: string | null
  maxScore: number
  textContent: string | null
  files: SubmissionFile[]
}

export type GeminiGradeOutput = {
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

function parseJsonPayload(raw: string): GeminiGradeOutput {
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

function geminiErrorMessage(status: number, errText: string): string {
  let parsed: { error?: { message?: string; status?: string } } = {}
  try {
    parsed = JSON.parse(errText) as typeof parsed
  } catch {
    parsed = {}
  }
  const msg = parsed.error?.message || errText.slice(0, 280) || `Gemini lỗi ${status}`
  if (status === 400 && /API key|api_key|invalid/i.test(msg)) return "API key Gemini không hợp lệ."
  if (status === 403) return "API key Gemini bị từ chối. Kiểm tra quyền AI Studio."
  if (status === 429) return "Gemini hết hạn mức tạm thời. Thử lại sau."
  if (status === 404 || /not found|not supported/i.test(msg)) return `Model không hỗ trợ: ${msg}`
  return msg.slice(0, 280)
}

function isRetryableModelError(status: number, errText: string): boolean {
  if (status === 404) return true
  return /not found|not supported|invalid model|UNKNOWN_MODEL/i.test(errText)
}

async function callGemini(
  apiKey: string,
  model: string,
  parts: Array<Record<string, unknown>>,
): Promise<{ ok: true; raw: string } | { ok: false; status: number; errText: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  })
  const errText = res.ok ? "" : await res.text().catch(() => "")
  if (!res.ok) return { ok: false, status: res.status, errText }
  const body = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    promptFeedback?: { blockReason?: string }
  }
  const raw = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? ""
  if (!raw) {
    const reason = body.promptFeedback?.blockReason
    return {
      ok: false,
      status: 200,
      errText: reason ? `Gemini chặn nội dung (${reason}).` : "Gemini không trả kết quả.",
    }
  }
  return { ok: true, raw }
}

export async function gradeSubmissionWithGemini(
  input: GeminiGradeInput,
): Promise<GeminiGradeOutput> {
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

  const parts: Array<Record<string, unknown>> = [
    {
      text: [
        "Bạn là giáo viên THPT, chấm bài học sinh tiếng Việt.",
        `Tên phiên: ${input.title}`,
        `Thang điểm: 0–${maxScore}`,
        `Tiêu chí / đáp án:\n${rubric}`,
        text ? `Bài gõ của học sinh:\n${text}` : "Không có bài gõ.",
        skipped > 0 ? `Còn ${skipped} ảnh chưa gửi vì không tải được hoặc vượt hạn mức.` : "",
        "Nếu bài là ảnh chữ viết tay: chép lại nội dung đọc được vào transcript. Chỗ không đọc được ghi [?].",
        "Nếu đọc được dưới khoảng 50% bài, đặt unreadable=true và score=null, không bịa điểm.",
        'Trả về DUY NHẤT JSON: {"score": number|null, "feedback": string, "transcript": string, "unreadable": boolean}',
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ]
  for (const img of images) {
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } })
  }

  let lastErr = "Gemini lỗi"
  for (const model of GEMINI_MODELS) {
    const result = await callGemini(input.apiKey, model, parts)
    if (result.ok) {
      const out = parseJsonPayload(result.raw)
      if (out.score !== null) {
        out.score = Math.max(0, Math.min(maxScore, Math.round(out.score * 4) / 4))
      }
      return out
    }
    lastErr = geminiErrorMessage(result.status, result.errText)
    if (!isRetryableModelError(result.status, result.errText) && result.status !== 200) {
      throw new Error(lastErr)
    }
  }
  throw new Error(lastErr)
}
