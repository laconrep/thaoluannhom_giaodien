import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { IndividualBoard } from "./individual-board"
import { isMissingSchemaError } from "@/lib/ai/schema-error"

export default async function IndividualSessionPage({
  params,
}: {
  params: Promise<{ id: string; sid: string }>
}) {
  const { id, sid } = await params
  const supabase = await createClient()

  let session: Record<string, unknown> | null = null
  try {
    const first = await supabase.from("sessions").select("*").eq("id", sid).eq("class_id", id).single()
    session = first.data as Record<string, unknown> | null
    if (!session && first.error && isMissingSchemaError(first.error)) {
      const fallback = await supabase
        .from("sessions")
        .select(
          "id, class_id, title, kind, duration_seconds, started_at, ends_at, status, scores_shared, allow_paste, results_shared_at, allow_download, use_fixed_groups, created_at",
        )
        .eq("id", sid)
        .eq("class_id", id)
        .single()
      session = fallback.data as Record<string, unknown> | null
    }
  } catch {
    const fallback = await supabase
      .from("sessions")
      .select(
        "id, class_id, title, kind, duration_seconds, started_at, ends_at, status, scores_shared, allow_paste, results_shared_at, allow_download, use_fixed_groups, created_at",
      )
      .eq("id", sid)
      .eq("class_id", id)
      .single()
    session = fallback.data as Record<string, unknown> | null
  }
  if (!session || session.kind !== "individual") notFound()

  const [{ data: slots }, { data: students }, { data: cls }, { data: subs }, { data: anns }] =
    await Promise.all([
      supabase
        .from("session_slots")
        .select("id, session_id, slot_number, student_id")
        .eq("session_id", sid)
        .order("slot_number"),
      supabase.from("students").select("id, slot_number, name").eq("class_id", id).order("slot_number"),
      supabase.from("classes").select("share_token, name").eq("id", id).single(),
      supabase
        .from("submissions")
        .select(
          "id, session_id, session_group_id, session_slot_id, image_url, text_content, files, submitted_at, is_auto_submitted",
        )
        .eq("session_id", sid),
      // T3: KHÔNG select cột data (nặng) — tải lười khi mở editor.
      supabase
        .from("annotations")
        .select("id, session_id, session_group_id, session_slot_id, score, updated_at")
        .eq("session_id", sid),
    ])

  return (
    <IndividualBoard
      classId={id}
      className={cls?.name ?? ""}
      shareToken={cls?.share_token ?? ""}
      session={session as any}
      slots={(slots ?? []) as any}
      students={(students ?? []) as any}
      submissions={(subs ?? []) as any}
      annotations={(anns ?? []) as any}
    />
  )
}
