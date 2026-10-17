"use server"

import { revalidatePath } from "next/cache"
import { isMissingSchemaError } from "@/lib/ai/schema-error"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail } from "@/lib/admin"

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

const FARM_MIGRATION_HINT =
  "Chưa có bảng trạm chấm. Chạy supabase-migrations/006_farm_stations.sql trong SQL Editor."

async function assertFarmAdmin(): Promise<{ admin: AdminClient }> {
  const { createClient } = await import("@/lib/supabase/server")
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Chưa đăng nhập.")
  if (!isAdminEmail(user.email)) throw new Error("Không có quyền quản trị.")
  const admin = createAdminClient()
  if (!admin) throw new Error("Thiếu quyền service role.")
  return { admin }
}

function farmSchemaError(error: { code?: string; message?: string } | null): Error | null {
  if (isMissingSchemaError(error)) return new Error(FARM_MIGRATION_HINT)
  return null
}

function validateStationId(id: string): string {
  const clean = id.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(clean)) {
    throw new Error("ID trạm chỉ gồm chữ thường, số, gạch ngang (tối đa 32 ký tự).")
  }
  return clean
}

export async function createStationAction(id: string, label: string, notes?: string) {
  const stationId = validateStationId(id)
  const cleanLabel = label.trim()
  if (!cleanLabel) throw new Error("Thiếu tên trạm.")
  const { admin } = await assertFarmAdmin()
  const { error } = await admin
    .from("backend_stations")
    .insert({ id: stationId, label: cleanLabel, notes: notes?.trim() || null })
  const schemaErr = farmSchemaError(error)
  if (schemaErr) throw schemaErr
  if (error) throw new Error(error.message)
  revalidatePath("/admin")
}

export async function setStationStatusAction(id: string, status: "active" | "paused") {
  if (status !== "active" && status !== "paused") throw new Error("Trạng thái không hợp lệ.")
  const { admin } = await assertFarmAdmin()
  const { error } = await admin.from("backend_stations").update({ status }).eq("id", id)
  const schemaErr = farmSchemaError(error)
  if (schemaErr) throw schemaErr
  if (error) throw new Error(error.message)
  revalidatePath("/admin")
}

export async function deleteStationAction(id: string) {
  if (id === "local") throw new Error("Không thể xóa trạm chính.")
  const { admin } = await assertFarmAdmin()
  const { data: used, error: usedError } = await admin
    .from("teacher_backend_map")
    .select("teacher_id")
    .eq("station_id", id)
    .limit(1)
  const schemaErr = farmSchemaError(usedError)
  if (schemaErr) throw schemaErr
  if (usedError) throw new Error(usedError.message)
  if (used && used.length > 0) {
    throw new Error("Trạm còn giáo viên đang gán. Chuyển họ sang trạm khác trước.")
  }
  const { error } = await admin.from("backend_stations").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/admin")
}

export async function assignTeacherStationAction(teacherId: string, stationId: string | null) {
  if (!teacherId) throw new Error("Thiếu giáo viên.")
  const { admin } = await assertFarmAdmin()
  if (stationId === null) {
    const { error } = await admin.from("teacher_backend_map").delete().eq("teacher_id", teacherId)
    const schemaErr = farmSchemaError(error)
    if (schemaErr) throw schemaErr
    if (error) throw new Error(error.message)
  } else {
    const clean = validateStationId(stationId)
    const { data: station, error: stationError } = await admin
      .from("backend_stations")
      .select("id")
      .eq("id", clean)
      .maybeSingle()
    const schemaErr = farmSchemaError(stationError)
    if (schemaErr) throw schemaErr
    if (stationError) throw new Error(stationError.message)
    if (!station) throw new Error("Trạm không tồn tại.")
    const { error } = await admin.from("teacher_backend_map").upsert(
      { teacher_id: teacherId, station_id: clean, updated_at: new Date().toISOString() },
      { onConflict: "teacher_id" },
    )
    if (error) throw new Error(error.message)
  }
  revalidatePath("/admin")
}
