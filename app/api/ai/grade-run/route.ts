import { NextRequest, NextResponse } from "next/server"
import { runAiGradeJob } from "@/lib/ai/run-grade-job"
import { createClient } from "@/lib/supabase/server"
import { checkGradeRunRateLimit } from "@/lib/rate-limit"

export const maxDuration = 300

export async function POST(request: NextRequest) {
  // Bảo mật 24/10/2026 (GĐ4): route này chạy job tới 300s — chặn spam kích
  // hoạt trước khi chạm DB.
  if (!checkGradeRunRateLimit(request)) {
    return NextResponse.json(
      { error: "Gửi quá nhiều yêu cầu chấm, thử lại sau." },
      { status: 429 },
    )
  }
  const body = (await request.json().catch(() => ({}))) as { jobId?: string }
  const jobId = typeof body.jobId === "string" ? body.jobId : ""
  if (!jobId) return NextResponse.json({ error: "Thiếu jobId" }, { status: 400 })

  // Bảo mật 24/10/2026 (GĐ2): trước đây ai cũng kích hoạt được job chấm của
  // GV khác (đốt key Gemini / ghi đè điểm). Giờ chỉ GV sở hữu job mới chạy.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 })
  const { data: job } = await supabase
    .from("ai_grade_jobs")
    .select("teacher_id")
    .eq("id", jobId)
    .maybeSingle()
  if (!job || job.teacher_id !== user.id) {
    return NextResponse.json({ error: "Không có quyền với job này." }, { status: 403 })
  }

  const result = await runAiGradeJob(jobId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Lỗi chấm AI" }, { status: 400 })
  }
  return NextResponse.json({ ok: true, completed: result.completed ?? 0 })
}
