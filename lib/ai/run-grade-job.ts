import { createAdminClient } from "@/lib/supabase/admin"
import { gradeSubmissionWithGemini } from "@/lib/ai/gemini-grade"
import { getFiles } from "@/lib/submission-files"
import type { SubmissionFile, SubmissionRow } from "@/lib/types"

const SUBMISSIONS_BUCKET = "submissions"
const inFlight = new Set<string>()

function storagePathFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const m = u.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/submissions\/(.+)$/)
    if (!m?.[1]) return null
    return decodeURIComponent(m[1])
  } catch {
    return null
  }
}

async function refreshFileUrls(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  files: SubmissionFile[],
): Promise<SubmissionFile[]> {
  const next: SubmissionFile[] = []
  for (const file of files) {
    const path = storagePathFromUrl(file.url)
    if (!path) {
      next.push(file)
      continue
    }
    const { data } = await supabase.storage.from(SUBMISSIONS_BUCKET).createSignedUrl(path, 60 * 60)
    next.push({ ...file, url: data?.signedUrl || file.url })
  }
  return next
}

export async function runAiGradeJob(jobId: string): Promise<{ ok: boolean; error?: string; completed?: number }> {
  if (inFlight.has(jobId)) return { ok: true, completed: 0 }
  inFlight.add(jobId)
  try {
    return await runAiGradeJobInner(jobId)
  } finally {
    inFlight.delete(jobId)
  }
}

async function runAiGradeJobInner(jobId: string): Promise<{ ok: boolean; error?: string; completed?: number }> {
  const supabase = createAdminClient()
  if (!supabase) return { ok: false, error: "Supabase chưa cấu hình" }

  const { data: job } = await supabase
    .from("ai_grade_jobs")
    .select("id, session_id, teacher_id, status")
    .eq("id", jobId)
    .maybeSingle()
  if (!job) return { ok: false, error: "Không tìm thấy job" }
  if (job.status === "done" || job.status === "error") {
    return { ok: true, completed: 0 }
  }

  await supabase.from("ai_grade_jobs").update({ status: "running" }).eq("id", jobId)

  try {
    const [{ data: settings }, { data: session }, { data: pending }] = await Promise.all([
      supabase
        .from("teacher_ai_settings")
        .select("gemini_api_key")
        .eq("teacher_id", job.teacher_id)
        .maybeSingle(),
      supabase
        .from("sessions")
        .select("id, title, ai_rubric, ai_max_score")
        .eq("id", job.session_id)
        .maybeSingle(),
      supabase
        .from("ai_grade_results")
        .select("id, submission_id")
        .eq("job_id", jobId)
        .eq("status", "pending")
        .order("created_at"),
    ])

    const apiKey = settings?.gemini_api_key
    if (!apiKey || !session) {
      await supabase
        .from("ai_grade_jobs")
        .update({
          status: "error",
          error_message: !apiKey ? "Thiếu API key Gemini." : "Không tìm thấy phiên.",
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId)
      return { ok: false, error: "Thiếu cấu hình" }
    }

    const rows = pending ?? []
    const { data: already } = await supabase
      .from("ai_grade_jobs")
      .select("completed")
      .eq("id", jobId)
      .maybeSingle()
    let completed = already?.completed ?? 0

    for (const row of rows) {
      if (!row.submission_id) {
        await supabase
          .from("ai_grade_results")
          .update({ status: "error", error_message: "Thiếu bài nộp." })
          .eq("id", row.id)
        completed += 1
        await supabase.from("ai_grade_jobs").update({ completed }).eq("id", jobId)
        continue
      }

      const { data: sub } = await supabase.from("submissions").select("*").eq("id", row.submission_id).maybeSingle()
      if (!sub) {
        await supabase
          .from("ai_grade_results")
          .update({ status: "error", error_message: "Không tìm thấy bài nộp." })
          .eq("id", row.id)
        completed += 1
        await supabase.from("ai_grade_jobs").update({ completed }).eq("id", jobId)
        continue
      }

      try {
        const files = await refreshFileUrls(supabase, getFiles(sub as SubmissionRow))
        const out = await gradeSubmissionWithGemini({
          apiKey,
          title: session.title,
          rubric: session.ai_rubric,
          maxScore: Number(session.ai_max_score ?? 10),
          textContent: sub.text_content,
          files,
        })
        await supabase
          .from("ai_grade_results")
          .update({
            ai_score: out.score,
            ai_feedback: out.feedback,
            transcript: out.transcript,
            unreadable: out.unreadable,
            status: "ready",
            error_message: null,
          })
          .eq("id", row.id)
      } catch (e) {
        const message = e instanceof Error ? e.message : "Lỗi Gemini"
        await supabase
          .from("ai_grade_results")
          .update({ status: "error", error_message: message.slice(0, 400) })
          .eq("id", row.id)
      }

      completed += 1
      await supabase.from("ai_grade_jobs").update({ completed }).eq("id", jobId)
    }

    const { count: errCount } = await supabase
      .from("ai_grade_results")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("status", "error")

    await supabase
      .from("ai_grade_jobs")
      .update({
        status: "done",
        finished_at: new Date().toISOString(),
        error_message: errCount ? `${errCount} bài lỗi` : null,
      })
      .eq("id", jobId)

    return { ok: true, completed }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi chấm AI"
    await supabase
      .from("ai_grade_jobs")
      .update({
        status: "error",
        error_message: message.slice(0, 400),
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId)
    return { ok: false, error: message }
  }
}
