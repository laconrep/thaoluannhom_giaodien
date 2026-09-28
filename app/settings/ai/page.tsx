import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TeacherShell } from "@/components/teacher-shell"
import { ensureActiveUser } from "@/lib/account-status"
import { GeminiSettingsForm } from "./gemini-settings-form"
import type { GeminiTier } from "@/lib/types"

export default async function AiSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  await ensureActiveUser(user.id)

  const { data: settings } = await supabase
    .from("teacher_ai_settings")
    .select("gemini_api_key, gemini_tier")
    .eq("teacher_id", user.id)
    .maybeSingle()

  const key = settings?.gemini_api_key ?? ""
  const masked = key ? `${key.slice(0, 6)}…${key.slice(-4)}` : ""

  return (
    <TeacherShell email={user.email}>
      <section className="mx-auto max-w-xl px-4 py-8 flex flex-col gap-4">
        <header>
          <h1 className="font-heading text-2xl font-bold">API Gemini</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lưu key riêng theo tài khoản. Dùng khi bật chấm bài AI trên phiên.
          </p>
        </header>
        <GeminiSettingsForm
          hasKey={Boolean(key)}
          maskedKey={masked}
          initialTier={(settings?.gemini_tier as GeminiTier | undefined) ?? "free"}
        />
      </section>
    </TeacherShell>
  )
}
