import sharp from "sharp"
import type { SubmissionFile } from "@/lib/types"
import { toPlainText } from "@/lib/rich-text"

export const GEMINI_MODEL = "gemini-3.6-flash"
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const MAX_IMAGES = 4
const MAX_EDGE = 1600
const JPEG_QUALITY = 78

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

async function prepareImage(file: SubmissionFile): Promise<InlineImage | null> {
  if (file.kind !== "image" || !file.url) return null
  const buf = await fetchBuffer(file.url)
  if (!buf) return null
  try {
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
    if (jpeg.length > 4 * 1024 * 1024) return null
    return { mimeType: "image/jpeg", data: jpeg.toString("base64") }
  } catch {
    return null
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

  const parts: Array<Record<string, unknown>> = [
    {
      text: [
        "Bạn là giáo viên THPT, chấm bài học sinh tiếng Việt.",
        `Tên phiên: ${input.title}`,
        `Thang điểm: 0–${maxScore}`,
        `Tiêu chí / đáp án:\n${rubric}`,
        text ? `Bài gõ của học sinh:\n${text}` : "Không có bài gõ.",
        skipped > 0 ? `Còn ${skipped} ảnh chưa gửi vì vượt hạn mức.` : "",
        "Nếu bài là ảnh chữ viết tay: chép lại nội dung đọc được vào transcript. Chỗ không đọc được ghi [?].",
        "Nếu đọc được dưới khoảng 50% bài, đặt unreadable=true và score=null, không bịa điểm.",
        "Trả về DUY NHẤT JSON: {\"score\": number|null, \"feedback\": string, \"transcript\": string, \"unreadable\": boolean}",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ]
  for (const img of images) {
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } })
  }

  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(input.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(errText.slice(0, 280) || `Gemini lỗi ${res.status}`)
  }

  const body = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const raw = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? ""
  const out = parseJsonPayload(raw)
  if (out.score !== null) {
    out.score = Math.max(0, Math.min(maxScore, Math.round(out.score * 4) / 4))
  }
  return out
}
