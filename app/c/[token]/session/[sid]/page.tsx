import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { StudentSubmit } from "./student-submit"

export default async function StudentSessionPage({
  params,
}: {
  params: Promise<{ token: string; sid: string }>
}) {
  const { token, sid } = await params
  const supabase = await createClient()

  const { data: cls } = await supabase.from("classes").select("*").eq("share_token", token).single()
  if (!cls) notFound()

  // Bảo mật 24/10/2026 (GĐ3): chỉ lấy các cột phía HS được thấy — KHÔNG lấy
  // ai_rubric (barem chấm của GV) và KHÔNG lấy device_token của học sinh.
  const { data: session } = await supabase
    .from("sessions")
    .select(
      "id, class_id, title, kind, duration_seconds, started_at, ends_at, status, scores_shared, allow_paste, results_shared_at, allow_download, use_fixed_groups, prompt_text, prompt_file, prompt_source, created_at",
    )
    .eq("id", sid)
    .eq("class_id", cls.id)
    .single()
  if (!session) notFound()

  if (session.kind === "group") {
    const [{ data: groups }, { data: groupStudents }] = await Promise.all([
      supabase
        .from("session_groups")
        .select("id, session_id, class_group_id, group_number, label, claimed, claimed_at")
        .eq("session_id", sid)
        .order("group_number"),
      // Chỉ cần students khi phiên "chia lại nhóm" để HS tự nhận dạng
      session.use_fixed_groups
        ? Promise.resolve({ data: [] as any[] })
        : supabase
            .from("students")
            .select("id, slot_number, name")
            .eq("class_id", cls.id)
            .order("slot_number"),
    ])

    return (
      <StudentSubmit
        kind="group"
        classId={cls.id}
        className={cls.name}
        session={session}
        groups={groups ?? []}
        slots={[]}
        students={(groupStudents ?? []) as any}
        shareToken={token}
      />
    )
  }

  const { data: slots } = await supabase
    .from("session_slots")
    .select("id, session_id, slot_number, student_id")
    .eq("session_id", sid)
    .order("slot_number")

  const { data: students } = await supabase
    .from("students")
    .select("id, slot_number, name")
    .eq("class_id", cls.id)
    .order("slot_number")

  return (
    <StudentSubmit
      kind="individual"
      classId={cls.id}
      className={cls.name}
      session={session}
      groups={[]}
      slots={slots ?? []}
      students={students ?? []}
      shareToken={token}
    />
  )
}
