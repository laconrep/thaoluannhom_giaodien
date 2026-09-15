"use server"

import { createClient } from "@/lib/supabase/server"

// Lưu cờ "đã xem tour" cho tài khoản giáo viên đang đăng nhập.
// Mỗi tour_key là một hàng riêng nên upsert an toàn, không ghi đè lẫn nhau.
export async function markTourSeenAction(key: string) {
  const tourKey = String(key ?? "").trim().slice(0, 160)
  if (!tourKey) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from("teacher_tour_seen")
    .upsert({ teacher_id: user.id, tour_key: tourKey }, { onConflict: "teacher_id,tour_key" })
}
