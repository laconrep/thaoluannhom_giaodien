import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const ADMIN_EMAILS = ["gagabux95@gmail.com"] as const

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return ADMIN_EMAILS.some((allowed) => allowed === normalized)
}

export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?next=/admin")
  }

  if (!isAdminEmail(user.email)) {
    redirect("/dashboard")
  }

  const admin = createAdminClient()
  return { user, supabase, admin }
}
