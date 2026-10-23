import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type {
  ClassRow,
  SessionRow,
  SessionGroupRow,
  SessionSlotRow,
  SubmissionRow,
  AnnotationRow,
  StudentRow,
} from "@/lib/types"
import { ResultsViewer } from "./results-viewer"

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ token: string; sid: string }>
}) {
  const { token, sid } = await params
  const supabase = await createClient()

  const { data: cls } = await supabase
    .from("classes")
    .select("*")
    .eq("share_token", token)
    .maybeSingle<ClassRow>()
  if (!cls) notFound()

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sid)
    .eq("class_id", cls.id)
    .maybeSingle<SessionRow>()
  if (!session) notFound()
  if (!session.results_shared_at) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/20">
        <div className="max-w-md text-center space-y-4 p-8 bg-card rounded-xl shadow-sm border">
          <div className="size-16 rounded-full bg-muted mx-auto flex items-center justify-center text-3xl">
            ⏳
          </div>
          <h1 className="text-xl font-semibold">Kết quả chưa được chia sẻ</h1>
          <p className="text-muted-foreground text-sm">
            Giáo viên chưa mở chia sẻ kết quả cho phiên thảo luận này. Em vui lòng quay lại sau.
          </p>
        </div>
      </div>
    )
  }

  const { data: groups } = await supabase
    .from("session_groups")
    .select("*")
    .eq("session_id", sid)
    .order("group_number", { ascending: true })
    .returns<SessionGroupRow[]>()

  const { data: slots } = await supabase
    .from("session_slots")
    .select("*")
    .eq("session_id", sid)
    .order("slot_number", { ascending: true })
    .returns<SessionSlotRow[]>()

  const { data: submissions } = await supabase
    .from("submissions")
    .select("*")
    .eq("session_id", sid)
    .returns<SubmissionRow[]>()

  const { data: annotations } = await supabase
    .from("annotations")
    .select("*")
    .eq("session_id", sid)
    .returns<AnnotationRow[]>()

  const { data: students } = await supabase
    .from("students")
    .select("*")
    .eq("class_id", cls.id)
    .order("slot_number", { ascending: true })
    .returns<StudentRow[]>()

  // Ánh xạ học sinh → nhóm của mình trong phiên, để mỗi em chỉ xem được
  // bài của nhóm mình: ưu tiên session_group_members (phiên chia lại),
  // fallback class_group_members (phiên dùng nhóm cố định của lớp).
  const ownGroupByStudent: Record<string, string> = {}
  if (session.kind === "group" && groups && groups.length > 0) {
    const groupIds = groups.map((g) => g.id)
    const { data: sgm } = await supabase
      .from("session_group_members")
      .select("session_group_id, student_id")
      .in("session_group_id", groupIds)
      .returns<{ session_group_id: string; student_id: string }[]>()
    for (const m of sgm ?? []) ownGroupByStudent[m.student_id] = m.session_group_id

    const classGroupIds = groups
      .map((g) => g.class_group_id)
      .filter((x): x is string => !!x)
    if (classGroupIds.length > 0) {
      const sgByClassGroup: Record<string, string> = {}
      for (const g of groups) if (g.class_group_id) sgByClassGroup[g.class_group_id] = g.id
      const { data: cgm } = await supabase
        .from("class_group_members")
        .select("class_group_id, student_id")
        .in("class_group_id", classGroupIds)
        .returns<{ class_group_id: string; student_id: string }[]>()
      for (const m of cgm ?? []) {
        const sgid = sgByClassGroup[m.class_group_id]
        if (sgid && !ownGroupByStudent[m.student_id]) ownGroupByStudent[m.student_id] = sgid
      }
    }
  }

  // Nhận xét cho từng bài nộp (bản chấm đã hoàn tất mới nhất). Phía học sinh
  // hiển thị dưới tên "Nhận xét của giáo viên".
  const { data: gradeResults } = await supabase
    .from("ai_grade_results")
    .select("submission_id, ai_feedback, created_at")
    .eq("session_id", sid)
    .eq("status", "ready")
    .not("ai_feedback", "is", null)
    .order("created_at", { ascending: false })
    .returns<{ submission_id: string | null; ai_feedback: string | null; created_at: string }[]>()
  const feedbacks: Record<string, string> = {}
  for (const r of gradeResults ?? []) {
    if (r.submission_id && r.ai_feedback && !feedbacks[r.submission_id]) {
      feedbacks[r.submission_id] = r.ai_feedback
    }
  }

  return (
    <ResultsViewer
      classId={cls.id}
      className={cls.name}
      session={session}
      groups={groups ?? []}
      slots={slots ?? []}
      submissions={submissions ?? []}
      annotations={annotations ?? []}
      students={students ?? []}
      ownGroupByStudent={ownGroupByStudent}
      feedbacks={feedbacks}
    />
  )
}
