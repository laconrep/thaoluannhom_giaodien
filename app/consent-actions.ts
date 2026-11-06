// Đồng bộ bằng chứng đồng ý (đã lưu trong user_metadata lúc đăng ký) sang
// bảng profiles để quản trị tra cứu được. Tolerant: migration 013 chưa chạy
// (thiếu cột) thì bỏ qua lặng lẽ — metadata vẫn là bằng chứng chính.
// Dùng chung cho: sau đăng ký có phiên + lần đầu vào dashboard sau khi xác
// nhận email.
"use server"

import { createClient } from "@/lib/supabase/server"
import { isMissingSchemaError } from "@/lib/ai/schema-error"
import { CONSENT_METADATA_KEYS } from "@/lib/privacy"

export async function recordSignupConsentAction(): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    if (meta[CONSENT_METADATA_KEYS.consentPrivacy] !== true) return
    const consentAt =
      typeof meta[CONSENT_METADATA_KEYS.consentAt] === "string"
        ? (meta[CONSENT_METADATA_KEYS.consentAt] as string)
        : new Date().toISOString()
    const consentVersion =
      typeof meta[CONSENT_METADATA_KEYS.consentVersion] === "string"
        ? (meta[CONSENT_METADATA_KEYS.consentVersion] as string)
        : null
    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        consent_at: consentAt,
        consent_version: consentVersion,
        age_confirmed: meta[CONSENT_METADATA_KEYS.ageConfirmed] === true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    // Thiếu cột (chưa chạy migration 013) → bỏ qua, metadata vẫn giữ bằng chứng.
    if (error && !isMissingSchemaError(error)) throw error
  } catch {
    // Không bao giờ làm hỏng luồng đăng nhập/đăng ký vì lỗi đồng bộ.
    return
  }
}

/** Ghi dấu giáo viên đã xác nhận được phụ huynh đồng ý cho lớp này.
 * Tolerant: migration 013 chưa chạy thì bỏ qua (xác nhận trên giao diện
 * vẫn chặn được việc nhập khi chưa tick). */
export async function recordGuardianConsentAction(classId: string): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from("classes")
      .update({
        guardian_consent_at: new Date().toISOString(),
        guardian_consent_by: user.id,
      })
      .eq("id", classId)
      .eq("teacher_id", user.id)
    if (error && !isMissingSchemaError(error)) throw error
  } catch {
    return
  }
}
