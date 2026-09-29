import { NextRequest, NextResponse } from "next/server"
import { runAiGradeJob } from "@/lib/ai/run-grade-job"

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { jobId?: string }
  const jobId = typeof body.jobId === "string" ? body.jobId : ""
  if (!jobId) return NextResponse.json({ error: "Thiếu jobId" }, { status: 400 })

  const result = await runAiGradeJob(jobId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Lỗi chấm AI" }, { status: 400 })
  }
  return NextResponse.json({ ok: true, completed: result.completed ?? 0 })
}
