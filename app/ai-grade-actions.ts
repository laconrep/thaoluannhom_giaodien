"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { saveAnnotationAction } from "@/app/actions"
import type { GeminiTier } from "@/lib/types"

async function requireTeacherForSession(sessionId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Cần đăng nhập.")
  const { data: session } = await supabase
    .from("sessions")
    .select("id, class_id, title, kind, ai_enabled, ai_rubric, ai_max_score, classes!inner(teacher_id)")
    .eq("id", sessionId)
    .single()
  if (!session) throw new Error("Không tìm thấy phiên.")
  const teacherId = (session as { classes?: { teacher_id?: string } }).classes?.teacher_id
  if (teacherId !== user.id) throw new Error("Không có quyền.")
  return { supabase, user, session }
}

export async function saveGeminiSettingsAction(apiKey: string, tier: GeminiTier) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Cần đăng nhập.")
  const key = apiKey.trim()
  if (key && key.length < 20) {
    throw new Error("API key Gemini không hợp lệ.")
  }
  if (tier !== "free" && tier !== "pro") throw new Error("Gói Gemini không hợp lệ.")
  const patch: Record<string, unknown> = {
    teacher_id: user.id,
    gemini_tier: tier,
    updated_at: new Date().toISOString(),
  }
  if (key) patch.gemini_api_key = key
  const { error } = await supabase.from("teacher_ai_settings").upsert(patch, { onConflict: "teacher_id" })
  if (error) throw new Error(error.message)
  revalidatePath("/settings/ai")
}

export async function setSessionAiEnabledAction(sessionId: string, enabled: boolean) {
  const { supabase, session } = await requireTeacherForSession(sessionId)
  const { error } = await supabase.from("sessions").update({ ai_enabled: enabled }).eq("id", sessionId)
  if (error) throw new Error(error.message)
  revalidatePath(`/classes/${session.class_id}/sessions/${sessionId}`)
  revalidatePath(`/classes/${session.class_id}/individual/${sessionId}`)
}

export async function saveSessionAiRubricAction(sessionId: string, rubric: string, maxScore?: number) {
  const { supabase, session } = await requireTeacherForSession(sessionId)
  const score = maxScore != null && Number.isFinite(maxScore) ? Math.max(1, Math.min(10, maxScore)) : 10
  const { error } = await supabase
    .from("sessions")
    .update({ ai_rubric: rubric.trim() || null, ai_max_score: score })
    .eq("id", sessionId)
  if (error) throw new Error(error.message)
  revalidatePath(`/classes/${session.class_id}/sessions/${sessionId}`)
  revalidatePath(`/classes/${session.class_id}/individual/${sessionId}`)
}

export async function startAiGradeJobAction(sessionId: string): Promise<{ jobId: string; total: number }> {
  const { supabase, user, session } = await requireTeacherForSession(sessionId)
  if (!session.ai_enabled) throw new Error("Chế độ chấm AI chưa bật.")

  const { data: settings } = await supabase
    .from("teacher_ai_settings")
    .select("gemini_api_key")
    .eq("teacher_id", user.id)
    .maybeSingle()
  if (!settings?.gemini_api_key) throw new Error("Chưa lưu API key Gemini.")

  const { data: running } = await supabase
    .from("ai_grade_jobs")
    .select("id")
    .eq("session_id", sessionId)
    .in("status", ["queued", "running"])
    .maybeSingle()
  if (running) throw new Error("Phiên này đang được AI chấm.")

  const { data: submissions, error: subErr } = await supabase
    .from("submissions")
    .select("id, session_group_id, session_slot_id")
    .eq("session_id", sessionId)
  if (subErr) throw new Error(subErr.message)
  const list = submissions ?? []
  if (list.length === 0) throw new Error("Chưa có bài nộp để chấm.")

  const { data: job, error: jobErr } = await supabase
    .from("ai_grade_jobs")
    .insert({
      session_id: sessionId,
      teacher_id: user.id,
      status: "queued",
      total: list.length,
      completed: 0,
    })
    .select("id")
    .single()
  if (jobErr || !job) throw new Error(jobErr?.message ?? "Không tạo được phiên chấm AI.")

  const rows = list.map((s) => ({
    job_id: job.id,
    session_id: sessionId,
    session_group_id: s.session_group_id,
    session_slot_id: s.session_slot_id,
    submission_id: s.id,
    status: "pending",
  }))
  const { error: rowsErr } = await supabase.from("ai_grade_results").insert(rows)
  if (rowsErr) throw new Error(rowsErr.message)

  const h = await headers()
  const host = h.get("x-forwarded-host") || h.get("host")
  const proto = h.get("x-forwarded-proto") || "https"
  if (host) {
    fetch(`${proto}://${host}/api/ai/grade-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id }),
    }).catch(() => {})
  }

  return { jobId: job.id, total: list.length }
}

export async function approveAiGradeResultsAction(jobId: string, resultIds?: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Cần đăng nhập.")

  const { data: job } = await supabase
    .from("ai_grade_jobs")
    .select("id, session_id, teacher_id, sessions!inner(class_id)")
    .eq("id", jobId)
    .single()
  if (!job || job.teacher_id !== user.id) throw new Error("Không có quyền.")

  let q = supabase
    .from("ai_grade_results")
    .select("id, session_id, session_group_id, session_slot_id, ai_score, status")
    .eq("job_id", jobId)
    .eq("status", "ready")
  if (resultIds && resultIds.length > 0) q = q.in("id", resultIds)
  const { data: results, error } = await q
  if (error) throw new Error(error.message)

  for (const row of results ?? []) {
    if (row.ai_score === null || row.ai_score === undefined) continue
    let existingQ = supabase.from("annotations").select("data").eq("session_id", row.session_id)
    if (row.session_group_id) existingQ = existingQ.eq("session_group_id", row.session_group_id)
    else if (row.session_slot_id) existingQ = existingQ.eq("session_slot_id", row.session_slot_id)
    const { data: existedAnn } = await existingQ.maybeSingle()
    await saveAnnotationAction({
      sessionId: row.session_id,
      sessionGroupId: row.session_group_id,
      sessionSlotId: row.session_slot_id,
      data: existedAnn?.data ?? [],
      score: Number(row.ai_score),
    })
    await supabase.from("ai_grade_results").update({ status: "approved" }).eq("id", row.id)
  }

  const classId = (job as { sessions?: { class_id?: string } }).sessions?.class_id
  if (classId) {
    revalidatePath(`/classes/${classId}/sessions/${job.session_id}`)
    revalidatePath(`/classes/${classId}/individual/${job.session_id}`)
    revalidatePath(`/classes/${classId}/gradebook`)
  }
}
