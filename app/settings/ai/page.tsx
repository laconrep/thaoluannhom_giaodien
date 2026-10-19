import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getVerifiedAuthFromHeaders } from "@/lib/auth-headers"
import { TeacherShell } from "@/components/teacher-shell"
import { ensureActiveUser } from "@/lib/account-status"
import { GeminiSettingsForm } from "./gemini-settings-form"
import type { GeminiTier } from "@/lib/types"
import { isMissingSchemaError } from "@/lib/ai/schema-error"

export default async function AiSettingsPage() {
  // T2: lấy định danh từ header nội bộ do middleware xác thực — không gọi getUser() nữa.
  const user = await getVerifiedAuthFromHeaders()
  if (!user) redirect("/auth/login")
  await ensureActiveUser(user.id)
  const supabase = await createClient()

  let settings: { gemini_api_key?: string | null; gemini_tier?: string | null } | null = null
  let schemaMissing = false
  try {
    const { data, error } = await supabase
      .from("teacher_ai_settings")
      .select("gemini_api_key, gemini_tier")
      .eq("teacher_id", user.id)
      .maybeSingle()
    settings = data
    schemaMissing = isMissingSchemaError(error)
  } catch {
    schemaMissing = true
  }

  const key = settings?.gemini_api_key ?? ""
  const masked = key ? `${key.slice(0, 6)}…${key.slice(-4)}` : ""

  return (
    <TeacherShell email={user.email}>
      <section className="mx-auto max-w-xl px-4 py-8 flex flex-col gap-4">
        <header>
          <h1 className="font-heading text-2xl font-bold">AI chấm bài</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lưu key Gemini riêng theo tài khoản để chấm bằng Gemini. Nếu không lưu key,
            hệ thống tự dùng <span className="font-medium text-foreground">Muse AI</span> mặc
            định (không cần key riêng).
          </p>
        </header>
        {schemaMissing && (
          <p className="text-sm rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
            Chưa có bảng cài đặt AI trên Supabase. Chạy{" "}
            <code className="font-mono text-xs">scripts/110_ai_grading.sql</code> trong SQL Editor rồi tải lại trang.
          </p>
        )}
        <GeminiSettingsForm
          hasKey={Boolean(key)}
          maskedKey={masked}
          initialTier={(settings?.gemini_tier as GeminiTier | undefined) ?? "free"}
        />
      </section>
    </TeacherShell>
  )
}
