"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { saveAnnotationAction } from "@/app/actions"
import type { GeminiTier } from "@/lib/types"
import { isMissingSchemaError, throwSchemaOrMessage } from "@/lib/ai/schema-error"

type TeacherSession = {
  id: string
  class_id: string
  title: string
  kind: string
  ai_enabled?: boolean
  ai_rubric?: string | null
  ai_max_score?: number
  classes?: { teacher_id?: string }
}

async function requireTeacherForSession(sessionId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Cần đăng nhập.")
  let session: TeacherSession | null = null
  try {
    const first = await supabase
      .from("sessions")
      .select("id, class_id, title, kind, ai_enabled, ai_rubric, ai_max_score, classes!inner(teacher_id)")
      .eq("id", sessionId)
      .single()
    session = first.data as TeacherSession | null
    if (!session && first.error && isMissingSchemaError(first.error)) {
      const fallback = await supabase
        .from("sessions")
        .select("id, class_id, title, kind, classes!inner(teacher_id)")
        .eq("id", sessionId)
        .single()
      if (!fallback.data) throwSchemaOrMessage(first.error, "Không tìm thấy phiên.")
      session = {
        ...(fallback.data as TeacherSession),
        ai_enabled: false,
        ai_rubric: null,
        ai_max_score: 10,
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Chưa cài bảng")) throw e
    const fallback = await supabase
      .from("sessions")
      .select("id, class_id, title, kind, classes!inner(teacher_id)")
      .eq("id", sessionId)
      .single()
    if (!fallback.data) throw new Error("Không tìm thấy phiên.")
    session = {
      ...(fallback.data as TeacherSession),
      ai_enabled: false,
      ai_rubric: null,
      ai_max_score: 10,
    }
  }
  if (!session) throw new Error("Không tìm thấy phiên.")
  const cls = session.classes as { teacher_id?: string } | { teacher_id?: string }[] | undefined
  const teacherId = Array.isArray(cls) ? cls[0]?.teacher_id : cls?.teacher_id
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
  if (error) throwSchemaOrMessage(error, "Không lưu được cài đặt Gemini.")
  revalidatePath("/settings/ai")
}

export async function setSessionAiEnabledAction(sessionId: string, enabled: boolean) {
  const { supabase, session } = await requireTeacherForSession(sessionId)
  const { error } = await supabase.from("sessions").update({ ai_enabled: enabled }).eq("id", sessionId)
  if (error) throwSchemaOrMessage(error, "Không đổi được chế độ AI.")
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
  if (error) throwSchemaOrMessage(error, "Không lưu được tiêu chí chấm.")
  revalidatePath(`/classes/${session.class_id}/sessions/${sessionId}`)
  revalidatePath(`/classes/${session.class_id}/individual/${sessionId}`)
}

export async function startAiGradeJobAction(
  sessionId: string,
): Promise<{ ok: true; jobId: string; total: number } | { ok: false; error: string }> {
  try {
    return await startAiGradeJobActionInner(sessionId)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không bắt đầu được" }
  }
}

async function startAiGradeJobActionInner(
  sessionId: string,
): Promise<{ ok: true; jobId: string; total: number } | { ok: false; error: string }> {
  const { supabase, user, session } = await requireTeacherForSession(sessionId)
  if (!session.ai_enabled) return { ok: false, error: "Chế độ chấm AI chưa bật." }

  const { data: settings, error: settingsErr } = await supabase
    .from("teacher_ai_settings")
    .select("gemini_api_key")
    .eq("teacher_id", user.id)
    .maybeSingle()
  if (settingsErr && isMissingSchemaError(settingsErr)) throwSchemaOrMessage(settingsErr, "")
  if (!settings?.gemini_api_key) throw new Error("Chưa lưu API key Gemini.")

  const { data: running, error: runningErr } = await supabase
    .from("ai_grade_jobs")
    .select("id")
    .eq("session_id", sessionId)
    .in("status", ["queued", "running"])
    .maybeSingle()
  if (runningErr && isMissingSchemaError(runningErr)) throwSchemaOrMessage(runningErr, "")
  if (running) throw new Error("Phiên này đang được AI chấm.")

  const { data: submissions, error: subErr } = await supabase
    .from("submissions")
    .select("id, session_group_id, session_slot_id")
    .eq("session_id", sessionId)
  if (subErr) throw new Error(subErr.message)
  const list = submissions ?? []
  if (list.length === 0) throw new Error("Chưa có bài nộp để chấm.")

  const { data: prevOk } = await supabase
    .from("ai_grade_results")
    .select("submission_id, ai_score, ai_feedback, transcript, unreadable, status, created_at")
    .eq("session_id", sessionId)
    .in("status", ["ready", "approved"])
    .order("created_at", { ascending: false })

  const kept = new Map<
    string,
    {
      submission_id: string | null
      ai_score: number | null
      ai_feedback: string | null
      transcript: string | null
      unreadable: boolean
      status: string
    }
  >()
  for (const row of prevOk ?? []) {
    if (row.submission_id && !kept.has(row.submission_id)) kept.set(row.submission_id, row)
  }

  const rows = list.map((s) => {
    const prev = kept.get(s.id)
    if (prev) {
      return {
        job_id: "",
        session_id: sessionId,
        session_group_id: s.session_group_id,
        session_slot_id: s.session_slot_id,
        submission_id: s.id,
        ai_score: prev.ai_score,
        ai_feedback: prev.ai_feedback,
        transcript: prev.transcript,
        unreadable: prev.unreadable ?? false,
        status: prev.status,
        error_message: null,
      }
    }
    return {
      job_id: "",
      session_id: sessionId,
      session_group_id: s.session_group_id,
      session_slot_id: s.session_slot_id,
      submission_id: s.id,
      unreadable: false,
      status: "pending",
    }
  })
  const pendingCount = rows.filter((r) => r.status === "pending").length
  if (pendingCount === 0) throw new Error("Tất cả bài đã chấm xong.")
  const keptCount = list.length - pendingCount

  const { data: job, error: jobErr } = await supabase
    .from("ai_grade_jobs")
    .insert({
      session_id: sessionId,
      teacher_id: user.id,
      status: "queued",
      total: list.length,
      completed: keptCount,
    })
    .select("id")
    .single()
  if (jobErr || !job) throwSchemaOrMessage(jobErr, "Không tạo được phiên chấm AI.")

  const { error: rowsErr } = await supabase.from("ai_grade_results").insert(
    rows.map((r) => ({ ...r, job_id: job.id })),
  )
  if (rowsErr) throwSchemaOrMessage(rowsErr, "Không tạo được hàng chấm AI.")

  return { ok: true, jobId: job.id, total: list.length }
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

  const sess = (job as { sessions?: { class_id?: string } | { class_id?: string }[] }).sessions
  const classId = Array.isArray(sess) ? sess[0]?.class_id : sess?.class_id
  if (classId) {
    revalidatePath(`/classes/${classId}/sessions/${job.session_id}`)
    revalidatePath(`/classes/${classId}/individual/${job.session_id}`)
    revalidatePath(`/classes/${classId}/gradebook`)
  }
}
