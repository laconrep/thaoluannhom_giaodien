// Server action cho luồng học sinh ẩn danh — lọc dữ liệu PHÍA SERVER
// (báo cáo bảo mật 24/10/2026, GĐ3).
//
// Vấn đề cũ: trang sảnh lớp, trang nộp bài và trang kết quả gửi toàn bộ
// danh sách học sinh KÈM device_token + toàn bộ bài nộp/điểm/nhận xét của
// phiên xuống trình duyệt rồi mới lọc ở client theo localStorage. Học sinh
// sửa localStorage là mạo danh bạn khác, xem/nộp đè bài của bạn.
//
// Cách sửa: client chỉ gửi device_token của CHÍNH MÌNH lên (token này vốn đã
// nằm trong localStorage của thiết bị đó), server đối chiếu với DB rồi chỉ
// trả về đúng dữ liệu của học sinh đó — không bao giờ trả device_token hay
// dữ liệu của học sinh khác xuống client. Trang kết quả vốn đã chỉ mở khi
// giáo viên bật chia sẻ (results_shared_at) nên action cũng giữ cổng đó.

"use server"

import { createClient } from "@/lib/supabase/server"
import type { AnnotationRow, SubmissionRow } from "@/lib/types"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID_RE.test(v)
}

type StudentIdentity = { id: string; name: string | null } | null

async function resolveStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string,
  deviceToken?: string | null,
  savedStudentId?: string | null,
  // strict: tên đã lưu chỉ nhận khi device_token KHỚP CHÍNH XÁC (sảnh lớp:
  // GV mở khóa hoặc thiết bị khác chiếm ô thì phải về màn chọn lại).
  // Không strict: chấp nhận cả khi ô chưa gắn thiết bị nào (tên tự nhận
  // trong phiên nộp bài khi chưa bị chiếm).
  strictSaved?: boolean,
): Promise<StudentIdentity> {
  // 1. Tên đã chọn trước đó trên thiết bị.
  if (savedStudentId && isUuid(savedStudentId)) {
    const { data: saved } = await supabase
      .from("students")
      .select("id, name, device_token")
      .eq("id", savedStudentId)
      .eq("class_id", classId)
      .maybeSingle()
    const savedOk = strictSaved
      ? !!deviceToken && saved?.device_token === deviceToken
      : !!saved && (!saved.device_token || (deviceToken && saved.device_token === deviceToken))
    if (savedOk && saved) {
      return { id: saved.id as string, name: saved.name as string | null }
    }
  }
  // 2. Tìm theo device_token của thiết bị.
  if (deviceToken && isUuid(deviceToken)) {
    const { data: match } = await supabase
      .from("students")
      .select("id, name")
      .eq("class_id", classId)
      .eq("device_token", deviceToken)
      .maybeSingle()
    if (match) return { id: match.id as string, name: match.name as string | null }
  }
  return null
}

/**
 * Nhận diện học sinh trên thiết bị (dùng cho sảnh lớp + trang nộp bài phiên
 * cá nhân). Trả về id học sinh hoặc null — không bao giờ trả device_token.
 */
export async function resolveStudentIdentityAction(
  classId: string,
  deviceToken: string | null,
  savedStudentId?: string | null,
  strictSaved?: boolean,
): Promise<{ studentId: string | null }> {
  if (!isUuid(classId)) return { studentId: null }
  const supabase = await createClient()
  const student = await resolveStudent(supabase, classId, deviceToken, savedStudentId, strictSaved)
  return { studentId: student?.id ?? null }
}

/**
 * Roster sảnh lớp kèm cờ "của mình / bị khóa bởi thiết bị khác" — tính phía
 * server từ device_token, không trả token xuống client. Giao diện sảnh lớp
 * giữ nguyên (ô của mình bấm được, ô người khác bị khóa).
 */
export async function getLobbyRosterAction(
  classId: string,
  deviceToken: string | null,
): Promise<{ students: { id: string; slot_number: number; name: string | null; mine: boolean; locked: boolean }[] }> {
  if (!isUuid(classId)) return { students: [] }
  const supabase = await createClient()
  const { data } = await supabase
    .from("students")
    .select("id, slot_number, name, device_token")
    .eq("class_id", classId)
    .order("slot_number")
  const dt = deviceToken && isUuid(deviceToken) ? deviceToken : null
  return {
    students: (data ?? []).map((s) => ({
      id: s.id as string,
      slot_number: s.slot_number as number,
      name: s.name as string | null,
      mine: !!dt && s.device_token === dt,
      locked: !!s.device_token && s.device_token !== dt,
    })),
  }
}

export type OwnResults = {
  notShared: boolean
  student: { id: string; name: string | null } | null
  targetLabel: string | null
  hasTarget: boolean
  submission: SubmissionRow | null
  annotation: AnnotationRow | null
  feedback: string | null
}

/**
 * Chỉ trả về bài/điểm/nhận xét của ĐÚNG học sinh yêu cầu trong phiên đã chia
 * sẻ kết quả. Học sinh chưa nhận diện được (student null) thì client hiện
 * màn chọn tên; học sinh không có nhóm/ô (hasTarget false) thì hiện thông
 * báo như cũ.
 */
export async function getOwnResultsAction(
  sessionId: string,
  deviceToken?: string | null,
  studentId?: string | null,
): Promise<OwnResults> {
  const empty: OwnResults = {
    notShared: false,
    student: null,
    targetLabel: null,
    hasTarget: false,
    submission: null,
    annotation: null,
    feedback: null,
  }
  if (!isUuid(sessionId)) return empty
  const supabase = await createClient()

  const { data: session } = await supabase
    .from("sessions")
    .select("id, class_id, kind, title, results_shared_at")
    .eq("id", sessionId)
    .maybeSingle()
  if (!session) return empty
  if (!session.results_shared_at) return { ...empty, notShared: true }

  const classId = session.class_id as string
  const isGroup = session.kind === "group"

  // Nhận diện: ưu tiên device_token, fallback id đã chọn (màn chọn tên).
  let student: StudentIdentity = null
  if (deviceToken && isUuid(deviceToken)) {
    student = await resolveStudent(supabase, classId, deviceToken, studentId)
  } else if (studentId && isUuid(studentId)) {
    const { data } = await supabase
      .from("students")
      .select("id, name")
      .eq("id", studentId)
      .eq("class_id", classId)
      .maybeSingle()
    if (data) student = { id: data.id as string, name: data.name as string | null }
  }
  if (!student) return empty

  let targetLabel: string | null = null
  let hasTarget = false
  let groupId: string | null = null
  let slotId: string | null = null

  if (isGroup) {
    const { data: groups } = await supabase
      .from("session_groups")
      .select("id, label, class_group_id")
      .eq("session_id", sessionId)
      .order("group_number")
    const groupIds = (groups ?? []).map((g) => g.id as string)
    if (groupIds.length > 0) {
      const { data: sgm } = await supabase
        .from("session_group_members")
        .select("session_group_id")
        .in("session_group_id", groupIds)
        .eq("student_id", student.id)
        .maybeSingle()
      if (sgm?.session_group_id) {
        groupId = sgm.session_group_id as string
      } else {
        const classGroupIds = (groups ?? [])
          .map((g) => g.class_group_id as string | null)
          .filter((x): x is string => !!x)
        if (classGroupIds.length > 0) {
          const { data: cgm } = await supabase
            .from("class_group_members")
            .select("class_group_id")
            .in("class_group_id", classGroupIds)
            .eq("student_id", student.id)
            .maybeSingle()
          if (cgm?.class_group_id) {
            const sg = (groups ?? []).find((g) => g.class_group_id === cgm.class_group_id)
            if (sg) groupId = sg.id as string
          }
        }
      }
    }
    if (groupId) {
      hasTarget = true
      targetLabel = (groups ?? []).find((g) => g.id === groupId)?.label as string | null
    }
  } else {
    const { data: slot } = await supabase
      .from("session_slots")
      .select("id")
      .eq("session_id", sessionId)
      .eq("student_id", student.id)
      .maybeSingle()
    if (slot?.id) {
      hasTarget = true
      slotId = slot.id as string
      targetLabel = student.name ? `Bài của ${student.name}` : "Bài của em"
    }
  }

  if (!hasTarget) return { ...empty, student, targetLabel, hasTarget: false }

  const subQuery = supabase
    .from("submissions")
    .select("*")
    .eq("session_id", sessionId)
    .order("submitted_at", { ascending: false })
  const annQuery = supabase.from("annotations").select("*").eq("session_id", sessionId)
  if (groupId) {
    subQuery.eq("session_group_id", groupId)
    annQuery.eq("session_group_id", groupId)
  } else if (slotId) {
    subQuery.eq("session_slot_id", slotId)
    annQuery.eq("session_slot_id", slotId)
  }
  const [{ data: subs }, { data: anns }] = await Promise.all([
    subQuery.maybeSingle<SubmissionRow>(),
    annQuery.maybeSingle<AnnotationRow>(),
  ])
  const submission = (subs ?? null) as SubmissionRow | null
  const annotation = (anns ?? null) as AnnotationRow | null

  let feedback: string | null = null
  if (submission?.id) {
    const { data: gradeResults } = await supabase
      .from("ai_grade_results")
      .select("ai_feedback")
      .eq("submission_id", submission.id)
      .eq("status", "ready")
      .not("ai_feedback", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    feedback = (gradeResults?.ai_feedback as string | null) ?? null
  }

  return { notShared: false, student, targetLabel, hasTarget, submission, annotation, feedback }
}
