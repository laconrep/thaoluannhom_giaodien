"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { saveAnnotationAction } from "@/app/actions"
import type { AiProviderChoice, GeminiTier, GradedSample } from "@/lib/types"
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

/** Xóa key Gemini đã lưu của giáo viên — sau đó chấm AI dùng Muse (mặc định). */
export async function deleteGeminiKeyAction() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Cần đăng nhập.")
  const { error } = await supabase
    .from("teacher_ai_settings")
    .update({ gemini_api_key: null, updated_at: new Date().toISOString() })
    .eq("teacher_id", user.id)
  if (error) throwSchemaOrMessage(error, "Không xóa được key.")
  revalidatePath("/settings/ai")
}

export async function setSessionAiEnabledAction(sessionId: string, enabled: boolean) {  const { supabase, session } = await requireTeacherForSession(sessionId)
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

/** Tạo yêu cầu "AI chia barem tiêu chí chấm" — hook Muse chat sẽ xử lý. */
export async function requestAiBaremAction(
  sessionId: string,
  answerText: string,
  maxScore?: number,
): Promise<{ ok: true; requestId: string } | { ok: false; error: string }> {
  try {
    const { supabase, user } = await requireTeacherForSession(sessionId)
    const answer = answerText.trim()
    if (!answer) return { ok: false, error: "Chưa nhập đáp án." }
    const score =
      maxScore != null && Number.isFinite(maxScore) ? Math.max(1, Math.min(10, Math.round(maxScore))) : 10
    const { data: existing } = await supabase
      .from("ai_barem_requests")
      .select("id")
      .eq("session_id", sessionId)
      .in("status", ["pending", "processing"])
      .maybeSingle()
    if (existing) return { ok: true, requestId: existing.id }
    const { data: req, error } = await supabase
      .from("ai_barem_requests")
      .insert({
        session_id: sessionId,
        teacher_id: user.id,
        answer_text: answer,
        max_score: score,
        status: "pending",
      })
      .select("id")
      .single()
    if (error || !req) {
      if (isMissingSchemaError(error)) throwSchemaOrMessage(error, "")
      return { ok: false, error: "Không tạo được yêu cầu." }
    }
    return { ok: true, requestId: req.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không bắt đầu được" }
  }
}

/** Liệt kê các bài đã được giáo viên chấm tay trong phiên — để chọn làm "bài chấm mẫu". */
export async function listGradedSamplesAction(
  sessionId: string,
): Promise<{ ok: true; samples: GradedSample[] } | { ok: false; error: string }> {
  try {
    const { supabase } = await requireTeacherForSession(sessionId)

    const { data: annotations, error: annErr } = await supabase
      .from("annotations")
      .select("session_group_id, session_slot_id, score, data")
      .eq("session_id", sessionId)
      .not("score", "is", null)
    if (annErr) {
      if (isMissingSchemaError(annErr)) throwSchemaOrMessage(annErr, "")
      throw new Error(annErr.message)
    }

    const samples: GradedSample[] = []
    for (const ann of (annotations ?? []) as {
      session_group_id: string | null
      session_slot_id: string | null
      score: number | string | null
      data: unknown
    }[]) {
      // Tên nhóm / ô nộp bài
      let groupLabel = ""
      if (ann.session_group_id) {
        const { data: g } = await supabase
          .from("session_groups")
          .select("label")
          .eq("id", ann.session_group_id)
          .maybeSingle()
        groupLabel = (g as { label?: string } | null)?.label ?? ""
      } else if (ann.session_slot_id) {
        const { data: s } = await supabase
          .from("session_slots")
          .select("slot_number")
          .eq("id", ann.session_slot_id)
          .maybeSingle()
        const n = (s as { slot_number?: number } | null)?.slot_number
        groupLabel = n != null ? `Ô ${n}` : ""
      }
      if (!groupLabel) groupLabel = "Bài nộp"

      // 1 submission mới nhất cùng nhóm/ô (để subagent xem file)
      if (!ann.session_group_id && !ann.session_slot_id) continue
      let q = supabase
        .from("submissions")
        .select("id")
        .eq("session_id", sessionId)
        .order("submitted_at", { ascending: false })
        .limit(1)
      if (ann.session_group_id) q = q.eq("session_group_id", ann.session_group_id)
      else q = q.eq("session_slot_id", ann.session_slot_id as string)
      const { data: sub } = await q.maybeSingle()
      if (!sub) continue

      const items = Array.isArray(ann.data) ? (ann.data as { kind?: string }[]) : []
      const textCount = items.filter((i) => i.kind === "text").length
      const stampCount = items.filter((i) => i.kind === "stamp").length
      const hasDrawings = items.some(
        (i) => i.kind === "path" || i.kind === "highlight" || i.kind === "underline",
      )

      samples.push({
        submissionId: (sub as { id: string }).id,
        groupLabel,
        score: Number(ann.score),
        textCount,
        stampCount,
        hasDrawings,
      })
    }

    samples.sort((a, b) => a.groupLabel.localeCompare(b.groupLabel, "vi"))
    return { ok: true, samples }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không tải được danh sách bài mẫu" }
  }
}

/** Tạo yêu cầu "AI suy barem từ bài chấm mẫu" — hook chỉ báo tin, subagent có mắt xử lý. */
export async function requestAiBaremFromSampleAction(
  sessionId: string,
  submissionId: string,
  maxScore?: number,
): Promise<{ ok: true; requestId: string } | { ok: false; error: string }> {
  try {
    const { supabase, user } = await requireTeacherForSession(sessionId)
    const score =
      maxScore != null && Number.isFinite(maxScore) ? Math.max(1, Math.min(10, Math.round(maxScore))) : 10

    const { data: sub } = await supabase
      .from("submissions")
      .select("id, session_group_id, session_slot_id")
      .eq("id", submissionId)
      .eq("session_id", sessionId)
      .maybeSingle()
    if (!sub) return { ok: false, error: "Không tìm thấy bài nộp trong phiên này." }
    const sg = (sub as { session_group_id: string | null }).session_group_id
    const ss = (sub as { session_slot_id: string | null }).session_slot_id
    if (!sg && !ss) return { ok: false, error: "Bài này chưa được chấm tay." }

    let annQ = supabase
      .from("annotations")
      .select("id")
      .eq("session_id", sessionId)
      .not("score", "is", null)
    if (sg) annQ = annQ.eq("session_group_id", sg)
    else annQ = annQ.eq("session_slot_id", ss as string)
    const { data: ann } = await annQ.maybeSingle()
    if (!ann) return { ok: false, error: "Bài này chưa được chấm tay." }

    const { data: existing } = await supabase
      .from("ai_barem_requests")
      .select("id")
      .eq("session_id", sessionId)
      .eq("sample_submission_id", submissionId)
      .in("status", ["pending", "processing"])
      .maybeSingle()
    if (existing) return { ok: true, requestId: (existing as { id: string }).id }

    const { data: req, error } = await supabase
      .from("ai_barem_requests")
      .insert({
        session_id: sessionId,
        teacher_id: user.id,
        answer_text: "[Bài chấm mẫu]",
        max_score: score,
        status: "pending",
        source: "sample",
        sample_submission_id: submissionId,
      })
      .select("id")
      .single()
    if (error || !req) {
      if (isMissingSchemaError(error)) throwSchemaOrMessage(error, "")
      return { ok: false, error: "Không tạo được yêu cầu." }
    }
    return { ok: true, requestId: (req as { id: string }).id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không bắt đầu được" }
  }
}

/** Tạo yêu cầu "AI đánh giá tổng thể" — hook Muse chat sẽ xử lý. */
export async function requestAiEvalAction(
  sessionId: string,
): Promise<{ ok: true; requestId: string } | { ok: false; error: string }> {
  try {
    const { supabase, user } = await requireTeacherForSession(sessionId)
    // Cần có ít nhất 1 bài đã được AI chấm (ready/approved)
    const { data: graded, error: gradedErr } = await supabase
      .from("ai_grade_results")
      .select("id")
      .eq("session_id", sessionId)
      .in("status", ["ready", "approved"])
      .limit(1)
    if (gradedErr) {
      if (isMissingSchemaError(gradedErr)) throwSchemaOrMessage(gradedErr, "")
      return { ok: false, error: "Không đọc được kết quả chấm." }
    }
    if (!graded || graded.length === 0) {
      return { ok: false, error: "Chưa có bài nào được AI chấm. Hãy chấm bài trước." }
    }
    const { data: existing } = await supabase
      .from("ai_eval_requests")
      .select("id")
      .eq("session_id", sessionId)
      .in("status", ["pending", "processing"])
      .maybeSingle()
    if (existing) return { ok: true, requestId: existing.id }
    const { data: req, error } = await supabase
      .from("ai_eval_requests")
      .insert({ session_id: sessionId, teacher_id: user.id, status: "pending" })
      .select("id")
      .single()
    if (error || !req) {
      if (isMissingSchemaError(error)) throwSchemaOrMessage(error, "")
      return { ok: false, error: "Không tạo được yêu cầu." }
    }
    return { ok: true, requestId: req.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không bắt đầu được" }
  }
}

export async function startAiGradeJobAction(
  sessionId: string,
  providerChoice: AiProviderChoice = "auto",
): Promise<{ ok: true; jobId: string; total: number; provider: string } | { ok: false; error: string }> {
  try {
    return await startAiGradeJobActionInner(sessionId, providerChoice)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không bắt đầu được" }
  }
}

async function startAiGradeJobActionInner(
  sessionId: string,
  providerChoice: AiProviderChoice = "auto",
): Promise<{ ok: true; jobId: string; total: number; provider: string } | { ok: false; error: string }> {
  const { supabase, user, session } = await requireTeacherForSession(sessionId)
  if (!session.ai_enabled) return { ok: false, error: "Chế độ chấm AI chưa bật." }

  const { data: settings, error: settingsErr } = await supabase
    .from("teacher_ai_settings")
    .select("gemini_api_key")
    .eq("teacher_id", user.id)
    .maybeSingle()
  if (settingsErr && isMissingSchemaError(settingsErr)) throwSchemaOrMessage(settingsErr, "")
  const geminiKey = settings?.gemini_api_key ?? ""
  const museKey = process.env.MUSE_MODEL_API_KEY ?? ""
  // Giáo viên được chọn provider lúc bấm chấm:
  // - "gemini": bắt buộc có key Gemini riêng.
  // - "muse": Muse AI — dùng key hệ thống nếu có, không thì chấm qua khung chat (muse_chat), không cần key.
  // - "auto" (mặc định): có key Gemini → "gemini", có key Muse hệ thống → "muse", còn lại → "muse_chat".
  let provider: string
  if (providerChoice === "gemini") {
    if (!geminiKey) return { ok: false, error: "Chưa lưu key Gemini. Vào Cài đặt AI để thêm key." }
    provider = "gemini"
  } else if (providerChoice === "muse") {
    provider = museKey ? "muse" : "muse_chat"
  } else {
    provider = geminiKey ? "gemini" : museKey ? "muse" : "muse_chat"
  }

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
      provider,
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

  return { ok: true, jobId: job.id, total: list.length, provider }
}

/** Chấm lại 1 bài: xóa kết quả cũ của submission, tạo job mới total=1 giữ nguyên
 * provider của job gốc (muse_chat → hook ngoài xử lý, gemini/muse → grade-run). */
export async function regradeOneSubmissionAction(
  jobId: string,
  submissionId: string,
): Promise<{ ok: true; jobId: string; provider: string } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "Cần đăng nhập." }

    const { data: job } = await supabase
      .from("ai_grade_jobs")
      .select("id, session_id, teacher_id, provider, completed")
      .eq("id", jobId)
      .single()
    if (!job || job.teacher_id !== user.id) return { ok: false, error: "Không có quyền." }

    const { data: sub } = await supabase
      .from("submissions")
      .select("id, session_id, session_group_id, session_slot_id")
      .eq("id", submissionId)
      .single()
    if (!sub || sub.session_id !== job.session_id) {
      return { ok: false, error: "Bài nộp không thuộc phiên này." }
    }

    const { data: oldRows } = await supabase
      .from("ai_grade_results")
      .select("id, status")
      .eq("job_id", jobId)
      .eq("submission_id", submissionId)
    const counted = (oldRows ?? []).filter((r) => r.status === "ready" || r.status === "approved").length

    const { error: delErr } = await supabase
      .from("ai_grade_results")
      .delete()
      .eq("job_id", jobId)
      .eq("submission_id", submissionId)
    if (delErr) return { ok: false, error: "Không xóa được kết quả cũ." }
    if (counted > 0) {
      await supabase
        .from("ai_grade_jobs")
        .update({ completed: Math.max(0, (job.completed ?? 0) - counted) })
        .eq("id", jobId)
    }

    const { data: newJob, error: jobErr } = await supabase
      .from("ai_grade_jobs")
      .insert({
        session_id: job.session_id,
        teacher_id: user.id,
        status: "queued",
        provider: job.provider,
        total: 1,
        completed: 0,
      })
      .select("id")
      .single()
    if (jobErr || !newJob) return { ok: false, error: "Không tạo được job chấm lại." }

    const { error: rowErr } = await supabase.from("ai_grade_results").insert({
      job_id: newJob.id,
      session_id: job.session_id,
      session_group_id: sub.session_group_id,
      session_slot_id: sub.session_slot_id,
      submission_id: sub.id,
      unreadable: false,
      status: "pending",
    })
    if (rowErr) {
      await supabase.from("ai_grade_jobs").delete().eq("id", newJob.id)
      return { ok: false, error: "Không tạo được hàng chấm." }
    }
    return { ok: true, jobId: newJob.id, provider: job.provider ?? "muse_chat" }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không chấm lại được" }
  }
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
