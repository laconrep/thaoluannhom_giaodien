import { headers } from "next/headers"

/**
 * T2: đọc định danh đã xác thực từ header nội bộ do middleware đặt
 * (x-auth-user-id / x-auth-user-email).
 *
 * Middleware đã gọi supabase.auth.getUser() và chặn giả mạo (xóa mọi x-auth-*
 * do client gửi lên) nên layout dùng cái này thay vì gọi getUser() lần nữa.
 * Trả về null khi middleware chưa xác thực (vd thiếu env) → caller redirect login.
 */
export async function getVerifiedAuthFromHeaders(): Promise<{
  id: string
  email: string | null
} | null> {
  const h = await headers()
  const id = h.get("x-auth-user-id")
  if (!id) return null
  return { id, email: h.get("x-auth-user-email") }
}
