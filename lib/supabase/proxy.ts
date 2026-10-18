import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY

  // Keep public pages available if Supabase variables are not present in a deployment.
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  let user = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
  } catch {
    // A stale or invalid session must not crash the routing middleware.
  }

  const path = request.nextUrl.pathname
  const protectedPrefixes = ["/dashboard", "/classes", "/admin"]
  const needsAuth = protectedPrefixes.some((p) => path.startsWith(p))
  const isServerAction = request.headers.has("next-action")

  // Server Action POST phải tới đúng trang hiện tại. Redirect sang /auth/login
  // làm Next tìm action ID trên trang login → "Server Action was not found".
  if (needsAuth && !user && !isServerAction) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.searchParams.set("next", path)
    return NextResponse.redirect(url)
  }

  // T2: đính kèm định danh đã xác thực vào request header để layout khỏi gọi
  // getUser() thêm lần nữa (middleware và layout chạy 2 tiến trình riêng nên
  // React.cache không dedupe được).
  // Chống giả mạo: xóa mọi header x-auth-* do client gửi lên trước khi đặt của mình.
  const reqHeaders = new Headers(request.headers)
  for (const key of Array.from(reqHeaders.keys())) {
    if (key.toLowerCase().startsWith("x-auth-")) reqHeaders.delete(key)
  }
  if (user) {
    reqHeaders.set("x-auth-user-id", user.id)
    if (user.email) reqHeaders.set("x-auth-user-email", user.email)
  }
  const finalResponse = NextResponse.next({ request: { headers: reqHeaders } })
  // Giữ lại cookie session đã refresh (nếu có) — copy kèm nguyên options.
  for (const c of supabaseResponse.cookies.getAll()) {
    finalResponse.cookies.set(c)
  }
  return finalResponse
}
