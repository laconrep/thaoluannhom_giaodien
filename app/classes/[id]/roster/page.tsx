import { createClient } from "@/lib/supabase/server"
import { fetchClassGroups } from "@/lib/class-groups"
import { RosterView } from "./roster-view"

export default async function RosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: cls }, { data: students }, groups, membersRes] = await Promise.all([
    // Tolerant khi chưa chạy migration 014 (thiếu cột device_lock_enabled):
    // đọc không kèm cột mới, coi như công tắc lớp đang tắt.
    (async () => {
      const r1 = await supabase
        .from("classes")
        .select("id, name, capacity, device_lock_enabled")
        .eq("id", id)
        .maybeSingle()
      if (!r1.error) return r1
      if ((r1.error as { code?: string }).code === "42703") {
        return supabase.from("classes").select("id, name, capacity").eq("id", id).maybeSingle()
      }
      return r1
    })(),
    supabase
      .from("students")
      .select("id, slot_number, name, device_token")
      .eq("class_id", id)
      .order("slot_number"),
    fetchClassGroups(supabase, id),
    supabase
      .from("class_group_members")
      .select("class_group_id, student_id, students!inner(class_id)")
      .eq("students.class_id", id),
  ])

  if (!cls) return null

  const memberMap: Record<string, string[]> = {}
  for (const m of (membersRes.error ? [] : ((membersRes.data as any[]) ?? [])) ) {
    memberMap[m.class_group_id] ??= []
    memberMap[m.class_group_id].push(m.student_id)
  }

  return (
    <RosterView
      classId={id}
      capacity={cls.capacity}
      deviceLockEnabled={(cls as { device_lock_enabled?: boolean }).device_lock_enabled === true}
      students={(students ?? []) as any}
      groups={(groups ?? []) as any}
      memberMap={memberMap}
    />
  )
}
