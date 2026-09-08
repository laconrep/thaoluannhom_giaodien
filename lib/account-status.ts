import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function ensureActiveUser(userId?: string) {
  const supabase = await createClient()
  let id = userId
  if (!id) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect("/auth/login")
    id = user.id
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", id)
    .maybeSingle()

  if (error) return
  if (data?.status !== "disabled") return

  await supabase.auth.signOut()
  redirect("/auth/login?reason=disabled")
}
