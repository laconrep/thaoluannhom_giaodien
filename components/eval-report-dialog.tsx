"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { requestAiEvalAction } from "@/app/ai-grade-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { EvalReport } from "@/lib/types"
import { BarChart3, Loader2, RotateCcw } from "lucide-react"

type Props = {
  sessionId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}

type Phase = "idle" | "requesting" | "waiting" | "done" | "error"

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border bg-background p-2 text-center">
      <div className="text-lg font-bold tabular-nums text-primary">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

function DistBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right tabular-nums">{count} bài</span>
    </div>
  )
}

export function EvalReportDialog({ sessionId, open, onOpenChange }: Props) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [requestId, setRequestId] = useState<string | null>(null)
  const [report, setReport] = useState<EvalReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const pollRef = useRef<number | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  // Realtime là kênh chính; polling chỉ chạy khi realtime lỗi hoặc >10s không có event.
  const lastRtAt = useRef(0)
  const rtFailed = useRef(false)

  function stopWatch() {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (channelRef.current) {
      createClient().removeChannel(channelRef.current)
      channelRef.current = null
    }
  }

  useEffect(() => stopWatch, [])

  function applyRow(row: { status: string; result_json: unknown; error_message: string | null }) {
    if (row.status === "done") {
      stopWatch()
      setReport(row.result_json as EvalReport)
      setPhase("done")
    } else if (row.status === "error") {
      stopWatch()
      setError(row.error_message || "AI đánh giá gặp lỗi.")
      setPhase("error")
    }
  }

  async function pollOnce(id: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("ai_eval_requests")
      .select("status,result_json,error_message")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return
    applyRow(data as { status: string; result_json: unknown; error_message: string | null })
  }

  function startWatch(id: string) {
    stopWatch()
    lastRtAt.current = 0
    rtFailed.current = false
    const supabase = createClient()
    const ch = supabase
      .channel(`ai-eval-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ai_eval_requests", filter: `id=eq.${id}` },
        (p: { new?: { status: string; result_json: unknown; error_message: string | null } }) => {
          lastRtAt.current = Date.now()
          if (p.new) applyRow(p.new)
        },
      )
      .subscribe((status: string) => {
        rtFailed.current = status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED"
      })
    channelRef.current = ch
    pollRef.current = window.setInterval(() => {
      // Fallback: chỉ poll khi realtime lỗi hoặc quá 10s không có event.
      if (rtFailed.current || Date.now() - lastRtAt.current > 10000) {
        pollOnce(id).catch(() => {})
      }
    }, 2500)
    pollOnce(id).catch(() => {})
  }

  function request() {
    setPhase("requesting")
    setError(null)
    setReport(null)
    startTransition(async () => {
      const res = await requestAiEvalAction(sessionId)
      if (!res.ok) {
        setPhase("error")
        setError(res.error)
        return
      }
      setRequestId(res.requestId)
      setPhase("waiting")
      toast.success("AI đang tổng hợp đánh giá toàn phiên.")
      startWatch(res.requestId)
    })
  }

  useEffect(() => {
    if (open && phase === "idle") request()
    if (!open) {
      stopWatch()
      setPhase("idle")
      setRequestId(null)
      setReport(null)
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ])

  const s = report?.stats

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="size-4" /> Đánh giá tổng thể
          </DialogTitle>
          <DialogDescription>
            AI tổng hợp từ toàn bộ bài đã chấm của phiên — điểm số, lỗi sai phổ biến và gợi ý cho tiết sau.
          </DialogDescription>
        </DialogHeader>

        {(phase === "requesting" || phase === "waiting") && (
          <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p>AI đang đọc toàn bộ bài chấm và tổng hợp đánh giá…</p>
            <p className="text-xs">Thường mất vài phút tùy số lượng bài.</p>
          </div>
        )}

        {phase === "error" && (
          <div className="py-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={request} disabled={pending}>
              Thử lại
            </Button>
          </div>
        )}

        {phase === "done" && report && s && (
          <div className="flex flex-col gap-5 text-sm">
            {/* 1. Tổng quan */}
            <section>
              <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
                1. Tổng quan điểm số
              </h4>
              <div className="grid grid-cols-4 gap-2">
                <StatCard label="Đã chấm" value={`${s.graded}/${s.total_submissions}`} sub="bài" />
                <StatCard label="Trung bình" value={s.avg.toFixed(1)} />
                <StatCard label="Cao nhất" value={s.max.toFixed(1)} />
                <StatCard label="Thấp nhất" value={s.min.toFixed(1)} />
              </div>
              <div className="mt-2 flex flex-col gap-1.5 rounded-md border p-2">
                <DistBar label="Giỏi (≥8)" count={s.distribution.gioi} total={s.graded} color="bg-green-500" />
                <DistBar label="Khá (6.5–8)" count={s.distribution.kha} total={s.graded} color="bg-blue-500" />
                <DistBar label="TB (5–6.5)" count={s.distribution.trung_binh} total={s.graded} color="bg-yellow-500" />
                <DistBar label="Yếu (<5)" count={s.distribution.yeu} total={s.graded} color="bg-red-500" />
              </div>
            </section>

            {/* 2. Theo tiêu chí */}
            {report.criteria_avg.length > 0 && (
              <section>
                <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  2. Điểm trung bình theo tiêu chí
                </h4>
                <ul className="flex flex-col gap-1.5">
                  {report.criteria_avg.map((c) => (
                    <li key={c.name} className="flex items-center gap-2 text-xs">
                      <span className="w-40 shrink-0 font-medium">{c.name}</span>
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${c.points > 0 ? Math.round((c.avg / c.points) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="w-20 text-right tabular-nums">
                        {c.avg.toFixed(1)}/{c.points} đ
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 3. Lỗi sai phổ biến */}
            {report.common_mistakes.length > 0 && (
              <section>
                <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  3. Lỗi sai phổ biến
                </h4>
                <ul className="list-disc pl-5 flex flex-col gap-1 text-[13px]">
                  {report.common_mistakes.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* 4. Điểm mạnh chung */}
            {report.common_strengths.length > 0 && (
              <section>
                <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  4. Điểm mạnh chung của lớp
                </h4>
                <ul className="list-disc pl-5 flex flex-col gap-1 text-[13px]">
                  {report.common_strengths.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* 5. Theo nhóm */}
            {report.group_avg.length > 0 && (
              <section>
                <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  5. So sánh các nhóm
                </h4>
                <ul className="flex flex-col gap-1.5">
                  {report.group_avg.map((g) => (
                    <li key={g.key} className="flex items-center gap-2 text-xs">
                      <span className="w-40 shrink-0 font-medium">{g.name}</span>
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${report.max_score > 0 ? Math.round((g.avg / report.max_score) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <span className="w-24 text-right tabular-nums">
                        {g.avg.toFixed(1)} đ · {g.count} bài
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 6. Cần chú ý */}
            {report.attention_list.length > 0 && (
              <section>
                <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  6. Danh sách cần chú ý
                </h4>
                <ul className="flex flex-col gap-1.5">
                  {report.attention_list.map((a, i) => (
                    <li key={i} className="rounded-md border p-2 text-xs flex items-center gap-2">
                      <span className="font-medium">{a.name}</span>
                      {a.score != null && (
                        <span className="tabular-nums text-muted-foreground">{a.score} đ</span>
                      )}
                      <span className="text-muted-foreground">— {a.reason}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 7. Nhận xét tổng thể */}
            {report.overall_comment && (
              <section>
                <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  7. Nhận xét tổng thể & gợi ý tiết sau
                </h4>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed rounded-md bg-primary/5 border border-primary/20 p-3">
                  {report.overall_comment}
                </p>
              </section>
            )}
          </div>
        )}

        <DialogFooter>
          {phase === "done" && (
            <Button variant="outline" size="sm" onClick={request} disabled={pending} className="gap-1">
              <RotateCcw className="size-3" /> Đánh giá lại
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
