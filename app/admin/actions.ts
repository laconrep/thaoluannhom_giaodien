"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail } from "@/lib/admin"

async function assertAdminActor() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Chưa đăng nhập.")
  if (!isAdminEmail(user.email)) throw new Error("Không có quyền quản trị.")
  const admin = createAdminClient()
  if (!admin) throw new Error("Thiếu quyền service role.")
  return { user, admin }
}

export async function setAccountStatusAction(userId: string, status: "active" | "disabled") {
  if (status !== "active" && status !== "disabled") {
    throw new Error("Trạng thái không hợp lệ.")
  }
  if (!userId) throw new Error("Thiếu tài khoản.")

  const { user, admin } = await assertAdminActor()
  if (userId === user.id && status === "disabled") {
    throw new Error("Không thể chấm dứt tài khoản đang đăng nhập.")
  }

  const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId)
  if (targetError) throw new Error(targetError.message)
  if (target.user && isAdminEmail(target.user.email) && status === "disabled") {
    throw new Error("Không thể chấm dứt tài khoản quản trị.")
  }

  const now = new Date().toISOString()
  const { data: existing } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle()
  const { error } = existing
    ? await admin.from("profiles").update({ status, updated_at: now }).eq("id", userId)
    : await admin.from("profiles").insert({ id: userId, plan: "free", role: "user", status, updated_at: now })

  if (error) throw new Error(error.message)
  revalidatePath("/admin")
}
