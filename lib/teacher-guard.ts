// Guard sở hữu cho teacher server action (báo cáo bảo mật 24/10/2026, GĐ2).
//
// Vấn đề: trước đây hầu hết action giáo viên trong app/actions.ts không kiểm
// tra đăng nhập hay sở hữu — ai cũng gọi được với classId/sessionId của lớp
// khác để xóa lớp/phiên, sửa điểm, mở khóa xóa bài. Mẫu kiểm tra đúng đã có
// sẵn ở app/ai-grade-actions.ts (requireTeacherForSession); file này tách
// thành helper dùng chung cho cả app/actions.ts.
//
// Cách dùng: đầu mỗi action giáo viên, sau khi tạo supabase client:
//   const guardError = await checkTeacherForClass(supabase, classId)
//   if (guardError) throw new Error(guardError)          // action kiểu throw
//   if (guardError) return { ok: false, error: guardError } // action kiểu {ok}
//
// Lưu ý: đây là lớp phòng thủ thứ nhất. Lớp thứ hai là RLS ở migration 010
// (authenticated chỉ chạm được dữ liệu lớp mình sở hữu), nên kể cả khi một
// action quên guard thì database vẫn chặn — chỉ khác là lỗi sẽ khó hiểu hơn.
//
// CHỈ dùng trong server action / route handler. Không import vào client
// component (file này đi qua lib/supabase/server).

import type { SupabaseClient } from "@supabase/supabase-js"

type Client = SupabaseClient<any, "public", any>

async function authedUserId(supabase: Client): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function teacherIdOfClass(supabase: Client, classId: string): Promise<string | null> {
  const { data } = await supabase.from("classes").select("teacher_id").eq("id", classId).maybeSingle()
  return (data?.teacher_id as string | undefined) ?? null
}

/** null = được quyền; ngược lại là thông báo lỗi để trả/throw cho caller. */
export async function checkTeacherForClass(supabase: Client, classId: string): Promise<string | null> {
  const uid = await authedUserId(supabase)
  if (!uid) return "Cần đăng nhập."
  const tid = await teacherIdOfClass(supabase, classId)
  if (!tid) return "Không tìm thấy lớp."
  return tid === uid ? null : "Không có quyền với lớp này."
}

export async function checkTeacherForSession(supabase: Client, sessionId: string): Promise<string | null> {
  const { data } = await supabase.from("sessions").select("class_id").eq("id", sessionId).maybeSingle()
  if (!data?.class_id) return "Không tìm thấy phiên."
  return checkTeacherForClass(supabase, data.class_id as string)
}

export async function checkTeacherForSessionGroup(
  supabase: Client,
  sessionGroupId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("session_groups")
    .select("session_id")
    .eq("id", sessionGroupId)
    .maybeSingle()
  if (!data?.session_id) return "Không tìm thấy nhóm."
  return checkTeacherForSession(supabase, data.session_id as string)
}

export async function checkTeacherForSessionSlot(
  supabase: Client,
  sessionSlotId: string,
): Promise<string | null> {
  const { data } = await supabase.from("session_slots").select("session_id").eq("id", sessionSlotId).maybeSingle()
  if (!data?.session_id) return "Không tìm thấy ô."
  return checkTeacherForSession(supabase, data.session_id as string)
}

export async function checkTeacherForStudent(supabase: Client, studentId: string): Promise<string | null> {
  const { data } = await supabase.from("students").select("class_id").eq("id", studentId).maybeSingle()
  if (!data?.class_id) return "Không tìm thấy học sinh."
  return checkTeacherForClass(supabase, data.class_id as string)
}

export async function checkTeacherForClassGroup(
  supabase: Client,
  classGroupId: string,
): Promise<string | null> {
  const { data } = await supabase.from("class_groups").select("class_id").eq("id", classGroupId).maybeSingle()
  if (!data?.class_id) return "Không tìm thấy nhóm."
  return checkTeacherForClass(supabase, data.class_id as string)
}
