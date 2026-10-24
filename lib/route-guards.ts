// Guard cho các API route ký/cấp URL storage (báo cáo bảo mật 24/10/2026, GĐ2).
//
// Trước đây 5 route (signed-url, upload-url, inline-image-upload-url,
// grade-run, ensure-bucket) không kiểm tra gì: ai cũng mint được link đọc/
// ghi cho bất kỳ path nào, kích hoạt chấm AI đốt key, tạo bucket tùy ý.
//
// Quy tắc validateStoragePath:
// - submissions bucket: `<sessionId>/<targetId>/<file>` (bài nộp) hoặc
//   `prompts/<sessionId>/<file>` (file đề của GV).
// - submission-media bucket: `<sessionId>/<targetId>/<file>` (ảnh nhúng).
// - presentations bucket: `<teacherId>/<sessionId>/<file>` — chỉ chính GV đó
//   (đường dẫn do route upload bài giảng sinh ra đã có user id ở đầu).
// - Đã đăng nhập (GV): phiên trong path phải thuộc lớp của chính GV đó.
// - Ẩn danh (HS): phiên phải tồn tại và target phải là ô/nhóm thật của phiên
//   đó — chặn mint URL cho path bịa. Đây là mức chặn thực tế cho luồng HS
//   ẩn danh (HS không có JWT mang danh tính); đóng hẳn cần định danh HS
//   phía server (GĐ3 của báo cáo).
//
// CHỈ dùng trong route handler (server). Không import vào client component.

import type { SupabaseClient } from "@supabase/supabase-js"

type Client = SupabaseClient<any, "public", any>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Trả null nếu path hợp lệ, ngược lại trả thông báo lỗi. */
export async function validateStoragePath(
  supabase: Client,
  bucket: string,
  path: string,
  userId: string | null,
): Promise<string | null> {
  if (!path || path.includes("..") || path.startsWith("/")) return "Đường dẫn tệp không hợp lệ."
  const parts = path.split("/")

  if (bucket === "presentations") {
    if (parts.length < 3) return "Đường dẫn tệp không hợp lệ."
    if (!userId || parts[0] !== userId) return "Không có quyền với tệp này."
    return null
  }

  let sessionId: string
  let targetId: string | null = null
  if (parts[0] === "prompts") {
    // File đề của GV: prompts/<sessionId>/<file>
    if (parts.length !== 3) return "Đường dẫn tệp không hợp lệ."
    sessionId = parts[1]
  } else {
    if (parts.length !== 3) return "Đường dẫn tệp không hợp lệ."
    sessionId = parts[0]
    targetId = parts[1]
  }
  if (!UUID_RE.test(sessionId)) return "Đường dẫn tệp không hợp lệ."
  if (targetId && !UUID_RE.test(targetId)) return "Đường dẫn tệp không hợp lệ."

  const { data: session } = await supabase
    .from("sessions")
    .select("id, class_id, classes!inner(teacher_id)")
    .eq("id", sessionId)
    .maybeSingle()
  if (!session) return "Không tìm thấy phiên."
  if (userId) {
    const cls = session.classes as { teacher_id?: string } | { teacher_id?: string }[] | undefined
    const teacherId = Array.isArray(cls) ? cls[0]?.teacher_id : cls?.teacher_id
    if (teacherId !== userId) return "Không có quyền với tệp này."
  }
  if (targetId) {
    const [{ data: slot }, { data: group }] = await Promise.all([
      supabase.from("session_slots").select("id").eq("id", targetId).eq("session_id", sessionId).maybeSingle(),
      supabase.from("session_groups").select("id").eq("id", targetId).eq("session_id", sessionId).maybeSingle(),
    ])
    if (!slot && !group) return "Ô/nhóm không thuộc phiên này."
  }
  return null
}
