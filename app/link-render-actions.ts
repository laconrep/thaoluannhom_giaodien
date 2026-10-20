"use server"

import { createClient } from "@/lib/supabase/server"
import { extractCanvaUrl } from "@/lib/canva"
import { isMissingSchemaError } from "@/lib/ai/schema-error"

// Luồng "chụp link Canva thành ảnh": giáo viên bấm nút trong khung chấm →
// insert 1 dòng link_render_requests (pending) → trạm chấm (hook Muse chat)
// claim, mở link bằng trình duyệt, chụp từng trang, tải ảnh lên storage và
// gắn vào submissions.files → bài Canva trở thành bài ảnh: chấm tay được
// từng trang và AI chấm được như bài nộp file.

const MIGRATION_HINT =
  "Chức năng chụp link Canva chưa được bật trên Supabase (cần chạy migration 007_link_render_requests.sql)."

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/** Trạm được gán cho giáo viên (farm) — giống ai-grade-actions. */
async function resolveAssignedBackend(
  supabase: SupabaseServerClient,
  teacherId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("teacher_backend_map")
      .select("station_id")
      .eq("teacher_id", teacherId)
      .maybeSingle()
    if (error) return null
    return (data?.station_id as string | undefined) ?? null
  } catch {
    return null
  }
}

export type LinkRenderRequestResult =
  | { ok: true; requestId: string; status: string }
  | { ok: false; error: string }

export async function requestLinkRenderAction(
  submissionId: string,
): Promise<LinkRenderRequestResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "Cần đăng nhập." }

    const { data: sub } = await supabase
      .from("submissions")
      .select("id, session_id, text_content")
      .eq("id", submissionId)
      .single()
    if (!sub) return { ok: false, error: "Không tìm thấy bài nộp." }

    const sourceUrl = extractCanvaUrl(sub.text_content as string | null)
    if (!sourceUrl)
      return { ok: false, error: "Bài nộp này không có link Canva." }

    // Đang có yêu cầu chờ/đang chạy cho bài này → không tạo trùng.
    const existing = await supabase
      .from("link_render_requests")
      .select("id, status")
      .eq("submission_id", submissionId)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(1)
    if (existing.error && isMissingSchemaError(existing.error))
      return { ok: false, error: MIGRATION_HINT }
    if (existing.data && existing.data.length > 0)
      return {
        ok: true,
        requestId: existing.data[0].id as string,
        status: existing.data[0].status as string,
      }

    const assignedBackend = await resolveAssignedBackend(supabase, user.id)
    const ins = await supabase
      .from("link_render_requests")
      .insert({
        session_id: sub.session_id,
        submission_id: submissionId,
        teacher_id: user.id,
        source_url: sourceUrl,
        assigned_backend: assignedBackend,
      })
      .select("id")
      .single()
    if (ins.error) {
      if (isMissingSchemaError(ins.error))
        return { ok: false, error: MIGRATION_HINT }
      return { ok: false, error: ins.error.message }
    }
    return { ok: true, requestId: ins.data.id as string, status: "pending" }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Không tạo được yêu cầu.",
    }
  }
}

export type LinkRenderStatusResult = {
  ok: boolean
  status: string | null
  errorMessage?: string | null
  error?: string
}

export async function getLinkRenderStatusAction(
  submissionId: string,
): Promise<LinkRenderStatusResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, status: null }

    const { data, error } = await supabase
      .from("link_render_requests")
      .select("id, status, error_message")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false })
      .limit(1)
    if (error) {
      if (isMissingSchemaError(error))
        return { ok: false, status: null, error: MIGRATION_HINT }
      return { ok: false, status: null }
    }
    const row = data?.[0]
    if (!row) return { ok: true, status: null }
    return {
      ok: true,
      status: row.status as string,
      errorMessage: (row.error_message as string | null) ?? null,
    }
  } catch {
    return { ok: false, status: null }
  }
}
