import { createClient as createSupabaseClient } from "@supabase/supabase-js"

function serviceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    ""
  )
}

function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ""
}

export function createServiceClient() {
  const url = supabaseUrl()
  const key = serviceRoleKey()
  if (!url || !key) return null
  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// Bảo mật 24/10/2026 (GĐ4): trước đây hàm này tự fallback về anon key khi
// thiếu service key — code gọi nó tưởng mình có quyền admin nhưng thực chất
// chỉ có quyền anon (fail-open tiềm ẩn). Giờ thiếu key thì trả null để
// caller báo lỗi rõ ràng thay vì chạy lén bằng quyền anon. Mọi caller hiện
// tại đều đã kiểm tra null (admin actions throw "Thiếu quyền service role",
// các route ký URL trả 500, run-grade-job trả lỗi job).
export function createAdminClient() {
  const url = supabaseUrl()
  const key = serviceRoleKey()

  if (!url || !key) {
    return null
  }

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
