import { createAdminClient } from "@/lib/supabase/admin"
import { gradeSubmissionWithGemini } from "@/lib/ai/gemini-grade"
import { getFiles } from "@/lib/submission-files"
import type { SubmissionFile, SubmissionRow } from "@/lib/types"

const SUBMISSIONS_BUCKET = "submissions"
const MAX_SWEEPS = 6
const SWEEP_GAP_MS = 1000
const inFlight = new Set<string>()

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

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

async function refreshFileUrls(supabase: AdminClient, files: SubmissionFile[]): Promise<SubmissionFile[]> {
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

async function countSuccessful(supabase: AdminClient, jobId: string): Promise<number> {
  const { count } = await supabase
    .from("ai_grade_results")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .in("status", ["ready", "approved"])
  return count ?? 0
}

async function countErrors(supabase: AdminClient, jobId: string): Promise<number> {
  const { count } = await supabase
    .from("ai_grade_results")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("status", "error")
  return count ?? 0
}

async function gradeOneRow(
  supabase: AdminClient,
  row: { id: string; submission_id: string | null },
  apiKey: string,
  session: { title: string; ai_rubric: string | null; ai_max_score: number | null },
): Promise<boolean> {
  if (!row.submission_id) {
    await supabase
      .from("ai_grade_results")
      .update({ status: "error", error_message: "Thiếu bài nộp." })
      .eq("id", row.id)
    return false
  }

  const { data: sub } = await supabase.from("submissions").select("*").eq("id", row.submission_id).maybeSingle()
  if (!sub) {
    await supabase
      .from("ai_grade_results")
      .update({ status: "error", error_message: "Không tìm thấy bài nộp." })
      .eq("id", row.id)
    return false
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
    return true
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi Gemini"
    await supabase
      .from("ai_grade_results")
      .update({ status: "error", error_message: message.slice(0, 400) })
      .eq("id", row.id)
    return false
  }
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
    const [{ data: settings }, { data: session }] = await Promise.all([
      supabase.from("teacher_ai_settings").select("gemini_api_key").eq("teacher_id", job.teacher_id).maybeSingle(),
      supabase.from("sessions").select("id, title, ai_rubric, ai_max_score").eq("id", job.session_id).maybeSingle(),
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

    let completed = await countSuccessful(supabase, jobId)

    for (let sweep = 1; sweep <= MAX_SWEEPS; sweep++) {
      if (sweep > 1) {
        const leftover = await countErrors(supabase, jobId)
        if (!leftover) break
        await supabase
          .from("ai_grade_results")
          .update({ status: "pending", error_message: null })
          .eq("job_id", jobId)
          .eq("status", "error")
        await new Promise((resolve) => setTimeout(resolve, SWEEP_GAP_MS))
      }

      const { data: pending } = await supabase
        .from("ai_grade_results")
        .select("id, submission_id")
        .eq("job_id", jobId)
        .eq("status", "pending")
        .order("created_at")

      const rows = pending ?? []
      if (rows.length === 0) break

      for (const row of rows) {
        const ok = await gradeOneRow(supabase, row, apiKey, session)
        if (ok) completed += 1
        await supabase.from("ai_grade_jobs").update({ completed }).eq("id", jobId)
      }
    }

    const errCount = await countErrors(supabase, jobId)
    completed = await countSuccessful(supabase, jobId)

    await supabase
      .from("ai_grade_jobs")
      .update({
        status: "done",
        completed,
        finished_at: new Date().toISOString(),
        error_message: errCount ? `${errCount} bài lỗi sau 6 lần quét` : null,
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
