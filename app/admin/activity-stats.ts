import { createAdminClient } from "@/lib/supabase/admin"

export type TeacherActivity = {
  classCount: number
  groupSessionsWithSubmissions: number
  groupSessionsWithoutSubmissions: number
  aiGradedCount: number
}

const EMPTY: TeacherActivity = {
  classCount: 0,
  groupSessionsWithSubmissions: 0,
  groupSessionsWithoutSubmissions: 0,
  aiGradedCount: 0,
}

/* Lấy chỉ số hoạt động theo từng giáo viên (teacher_id → TeacherActivity).
 * Nguồn: classes, sessions (kind='group'), submissions, ai_grade_results.
 * Không cần migration mới. */
export async function getTeacherActivityMap(): Promise<Map<string, TeacherActivity>> {
  const admin = createAdminClient()
  const result = new Map<string, TeacherActivity>()
  if (!admin) return result

  const ensure = (tid: string): TeacherActivity => {
    let s = result.get(tid)
    if (!s) {
      s = { ...EMPTY }
      result.set(tid, s)
    }
    return s
  }

  // 1. Số lớp theo giáo viên
  const { data: classes } = await admin.from("classes").select("id, teacher_id")
  const classToTeacher = new Map<string, string>()
  for (const c of (classes ?? []) as Array<{ id: string; teacher_id: string }>) {
    classToTeacher.set(c.id, c.teacher_id)
    ensure(c.teacher_id).classCount += 1
  }

  // 2. Phiên theo giáo viên (mọi loại phiên cho mục 4; riêng phiên nhóm cho mục 3)
  const { data: sessions } = await admin
    .from("sessions")
    .select("id, class_id, kind")
  const sessionToTeacher = new Map<string, string>()
  const groupSessionToTeacher = new Map<string, string>()
  const groupSessionIds: string[] = []
  for (const s of (sessions ?? []) as Array<{ id: string; class_id: string; kind: string }>) {
    const tid = classToTeacher.get(s.class_id)
    if (!tid) continue
    sessionToTeacher.set(s.id, tid)
    if (s.kind === "group") {
      groupSessionToTeacher.set(s.id, tid)
      groupSessionIds.push(s.id)
    }
  }

  // 3. Phiên nào có bài nộp (đếm submissions theo session)
  const sessionsWithSubmissions = new Set<string>()
  if (groupSessionIds.length > 0) {
    // Chia nhỏ để tránh URL quá dài
    for (let i = 0; i < groupSessionIds.length; i += 200) {
      const chunk = groupSessionIds.slice(i, i + 200)
      const { data: subs } = await admin
        .from("submissions")
        .select("session_id")
        .in("session_id", chunk)
      for (const sub of (subs ?? []) as Array<{ session_id: string }>) {
        sessionsWithSubmissions.add(sub.session_id)
      }
    }
  }
  for (const [sid, tid] of groupSessionToTeacher) {
    if (sessionsWithSubmissions.has(sid)) {
      ensure(tid).groupSessionsWithSubmissions += 1
    } else {
      ensure(tid).groupSessionsWithoutSubmissions += 1
    }
  }

  // 4. Tổng số bài chấm bằng AI (ai_grade_results có điểm) — mọi loại phiên
  // (nhóm + cá nhân), trạng thái ready hoặc approved (bài đã duyệt vẫn tính).
  const allSessionIds = [...sessionToTeacher.keys()]
  if (allSessionIds.length > 0) {
    for (let i = 0; i < allSessionIds.length; i += 200) {
      const chunk = allSessionIds.slice(i, i + 200)
      const { data: results } = await admin
        .from("ai_grade_results")
        .select("session_id")
        .in("session_id", chunk)
        .in("status", ["ready", "approved"])
        .not("ai_score", "is", null)
      for (const r of (results ?? []) as Array<{ session_id: string }>) {
        const tid = sessionToTeacher.get(r.session_id)
        if (tid) ensure(tid).aiGradedCount += 1
      }
    }
  }

  return result
}
