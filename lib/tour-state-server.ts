import { createClient } from "@/lib/supabase/server"

// Đọc danh sách tour giáo viên đã xem để hydrate phía client ngay từ server.
// Trả về {} nếu chưa có bản ghi hoặc bảng chưa được migrate.
export async function loadTourSeenState(userId: string): Promise<Record<string, boolean>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("teacher_tour_seen")
    .select("tour_key")
    .eq("teacher_id", userId)

  if (error || !data) return {}

  const state: Record<string, boolean> = {}
  for (const row of data as { tour_key: string | null }[]) {
    if (row.tour_key) state[row.tour_key] = true
  }
  return state
}
