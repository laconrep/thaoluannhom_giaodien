import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { gradeSubmissionWithGemini } from "@/lib/ai/gemini-grade"
import { getFiles } from "@/lib/submission-files"
import type { SubmissionRow } from "@/lib/types"

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { jobId?: string }
  const jobId = typeof body.jobId === "string" ? body.jobId : ""
  if (!jobId) return NextResponse.json({ error: "Thiếu jobId" }, { status: 400 })

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Supabase chưa cấu hình" }, { status: 500 })

  const { data: job } = await supabase
    .from("ai_grade_jobs")
    .select("id, session_id, teacher_id, status")
    .eq("id", jobId)
    .maybeSingle()
  if (!job) return NextResponse.json({ error: "Không tìm thấy job" }, { status: 404 })
  if (job.status === "done" || job.status === "error") {
    return NextResponse.json({ ok: true, skipped: true })
  }

  await supabase.from("ai_grade_jobs").update({ status: "running" }).eq("id", jobId)

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
    return NextResponse.json({ error: "Thiếu cấu hình" }, { status: 400 })
  }

  const rows = pending ?? []
  let completed = 0
  const { data: already } = await supabase
    .from("ai_grade_jobs")
    .select("completed")
    .eq("id", jobId)
    .maybeSingle()
  completed = already?.completed ?? 0

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
      const out = await gradeSubmissionWithGemini({
        apiKey,
        title: session.title,
        rubric: session.ai_rubric,
        maxScore: Number(session.ai_max_score ?? 10),
        textContent: sub.text_content,
        files: getFiles(sub as SubmissionRow),
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

  return NextResponse.json({ ok: true, completed })
}
