type SchemaErr = { code?: string; message?: string } | null | undefined

export function isMissingSchemaError(error: SchemaErr): boolean {
  if (!error) return false
  const code = error.code ?? ""
  const msg = (error.message ?? "").toLowerCase()
  return (
    code === "PGRST202" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    code === "42P01" ||
    code === "42703" ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("could not find the")
  )
}

export const AI_SCHEMA_HINT =
  "Chưa cài bảng chấm AI trên Supabase. Chạy scripts/110_ai_grading.sql trong SQL Editor."

export function throwSchemaOrMessage(
  error: { code?: string; message?: string } | null | undefined,
  fallback: string,
): never {
  if (isMissingSchemaError(error)) throw new Error(AI_SCHEMA_HINT)
  throw new Error(error?.message || fallback)
}
