"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"
import {
  approveAiGradeResultsAction,
  regradeOneSubmissionAction,
  saveSessionAiRubricAction,
  setSessionAiEnabledAction,
  startAiGradeJobAction,
} from "@/app/ai-grade-actions"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RubricBaremDialog } from "@/components/rubric-barem-dialog"
import { EvalReportDialog } from "@/components/eval-report-dialog"
import type { AiGradeJobRow, AiGradeResultRow, AiProviderChoice, SessionGroupRow, SessionSlotRow } from "@/lib/types"
import { BarChart3, Bot, Check, Eye, Loader2, RotateCcw, Sparkles } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Props = {
  sessionId: string
  kind: "group" | "individual"
  aiEnabled: boolean
  aiRubric: string | null
  groups?: SessionGroupRow[]
  slots?: Array<SessionSlotRow & { studentName?: string | null }>
  compact?: boolean
}

export function AiGradePanel({
  sessionId,
  kind,
  aiEnabled: initialEnabled,
  aiRubric: initialRubric,
  groups = [],
  slots = [],
  compact,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [rubric, setRubric] = useState(initialRubric ?? "")
  const [job, setJob] = useState<AiGradeJobRow | null>(null)
  const [results, setResults] = useState<AiGradeResultRow[]>([])
  const [open, setOpen] = useState(false)
  const [paramOpen, setBaremOpen] = useState(false)
  const [evalOpen, setEvalOpen] = useState(false)
  const [providerChoice, setProviderChoice] = useState<AiProviderChoice>("auto")
  const [pending, startTransition] = useTransition()
  const prevJobStatus = useRef<string | null>(null)
  // Realtime là kênh chính; polling 2.5s chỉ chạy khi realtime lỗi hoặc >10s không có event.
  const lastJobRtAt = useRef(0)
  const lastResultsRtAt = useRef(0)
  const jobRtFailed = useRef(false)
  const resultsRtFailed = useRef(false)
  const resultsChannelRef = useRef<RealtimeChannel | null>(null)

  async function refreshJob() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("ai_grade_jobs")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    setJob(data as AiGradeJobRow)
    return data as AiGradeJobRow
  }

  useEffect(() => {
    refreshJob().catch(() => {})
  }, [sessionId])

  useEffect(() => {
    const supabase = createClient()
    lastJobRtAt.current = 0
    jobRtFailed.current = false
    const ch = supabase
      .channel(`ai-job-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_grade_jobs", filter: `session_id=eq.${sessionId}` },
        (p: { new?: AiGradeJobRow }) => {
          lastJobRtAt.current = Date.now()
          if (p.new) setJob(p.new)
        },
      )
      .subscribe((status: string) => {
        jobRtFailed.current = status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED"
      })
    return () => {
      supabase.removeChannel(ch)
    }
  }, [sessionId])

  // Realtime kết quả theo job đang theo dõi — upsert từng dòng khi có thay đổi.
  useEffect(() => {
    if (!open || !job) {
      if (resultsChannelRef.current) {
        createClient().removeChannel(resultsChannelRef.current)
        resultsChannelRef.current = null
      }
      return
    }
    const supabase = createClient()
    lastResultsRtAt.current = 0
    resultsRtFailed.current = false
    const ch = supabase
      .channel(`ai-results-${job.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_grade_results", filter: `job_id=eq.${job.id}` },
        (p: { new?: AiGradeResultRow }) => {
          lastResultsRtAt.current = Date.now()
          const row = p.new
          if (!row) return
          setResults((cur) => {
            const i = cur.findIndex((r) => r.id === row.id)
            if (i === -1) return [...cur, row].sort((a, b) => a.created_at.localeCompare(b.created_at))
            const next = [...cur]
            next[i] = row
            return next
          })
        },
      )
      .subscribe((status: string) => {
        resultsRtFailed.current =
          status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED"
      })
    resultsChannelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      resultsChannelRef.current = null
    }
  }, [open, job?.id])

  useEffect(() => {
    if (!job || (job.status !== "queued" && job.status !== "running")) return
    const tick = window.setInterval(() => {
      // Fallback: chỉ poll khi realtime lỗi hoặc quá 10s không có event.
      if (jobRtFailed.current || Date.now() - lastJobRtAt.current > 10000) {
        refreshJob().catch(() => {})
      }
      if (open && (resultsRtFailed.current || Date.now() - lastResultsRtAt.current > 10000)) {
        loadResults().catch(() => {})
      }
    }, 2500)
    const kick = window.setTimeout(() => {
      fetch("/api/ai/grade-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      }).catch(() => {})
    }, 8000)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(kick)
    }
  }, [job?.id, job?.status, open])

  const labelByTarget = useMemo(() => {
    const m: Record<string, string> = {}
    for (const g of groups) m[`g:${g.id}`] = g.label
    for (const s of slots) {
      m[`s:${s.id}`] = s.studentName?.trim() || `Ô ${s.slot_number}`
    }
    return m
  }, [groups, slots])

  const running = job?.status === "queued" || job?.status === "running"
  const readyCount = results.filter((r) => r.status === "ready").length
  const done = job?.status === "done"

  // Cảnh báo điểm bất thường: (a) tất cả cùng 1 điểm, (b) có bài lệch >2.5đ so với trung bình.
  const scoreAnomaly = useMemo(() => {
    const scored = results
      .filter((r) => (r.status === "ready" || r.status === "approved") && r.ai_score != null)
      .map((r) => ({
        name:
          (r.session_group_id && labelByTarget[`g:${r.session_group_id}`]) ||
          (r.session_slot_id && labelByTarget[`s:${r.session_slot_id}`]) ||
          "Bài nộp",
        score: r.ai_score as number,
      }))
    if (scored.length < 2) return null
    const scores = scored.map((s) => s.score)
    if (scores.every((s) => s === scores[0])) {
      return { kind: "same" as const, names: scored.map((s) => s.name), value: scores[0] }
    }
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    const outliers = scored.filter((s) => Math.abs(s.score - mean) > 2.5)
    if (outliers.length === 0) return null
    return { kind: "outlier" as const, names: outliers.map((s) => s.name), mean }
  }, [results, labelByTarget])

  useEffect(() => {
    if (!job) return
    const prev = prevJobStatus.current
    prevJobStatus.current = job.status
    if (prev !== "queued" && prev !== "running") return
    if (job.status === "done") {
      toast.success("AI đã chấm xong phiên. Bấm Xem kết quả chấm để duyệt.")
    }
    if (job.status === "error") {
      toast.error(job.error_message || "Chấm AI gặp lỗi")
    }
  }, [job])

  async function loadResults() {
    if (!job) return
    const supabase = createClient()
    const { data } = await supabase
      .from("ai_grade_results")
      .select("*")
      .eq("job_id", job.id)
      .order("created_at")
    setResults((data ?? []) as AiGradeResultRow[])
  }

  function toggleEnabled(v: boolean) {
    setEnabled(v)
    startTransition(async () => {
      try {
        await setSessionAiEnabledAction(sessionId, v)
      } catch (e) {
        setEnabled(!v)
        toast.error(e instanceof Error ? e.message : "Không đổi được chế độ")
      }
    })
  }

  function startGrade() {
    startTransition(async () => {
      try {
        if (rubric.trim() !== (initialRubric ?? "")) {
          await saveSessionAiRubricAction(sessionId, rubric)
        }
        const started = await startAiGradeJobAction(sessionId, providerChoice)
        if (!started.ok) {
          toast.error(started.error)
          return
        }
        setJob({
          id: started.jobId,
          session_id: sessionId,
          teacher_id: "",
          status: "queued",
          provider: started.provider ?? null,
          total: started.total,
          completed: 0,
          error_message: null,
          created_at: new Date().toISOString(),
          finished_at: null,
        })
        fetch("/api/ai/grade-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: started.jobId }),
        }).catch(() => {})
        toast.success("AI đang chấm ngầm, tự thử lại nhóm lỗi tối đa 6 lần. Có thể tiếp tục sửa bài.")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không bắt đầu được")
      }
    })
  }

  async function openResults() {
    await loadResults()
    setOpen(true)
  }

  function regradeOne(r: AiGradeResultRow) {
    if (!job || !r.submission_id || running) return
    startTransition(async () => {
      try {
        const res = await regradeOneSubmissionAction(job.id, r.submission_id as string)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        lastJobRtAt.current = 0
        lastResultsRtAt.current = 0
        jobRtFailed.current = false
        resultsRtFailed.current = false
        setJob({
          id: res.jobId,
          session_id: sessionId,
          teacher_id: "",
          status: "queued",
          provider: res.provider,
          total: 1,
          completed: 0,
          error_message: null,
          created_at: new Date().toISOString(),
          finished_at: null,
        })
        setResults([])
        fetch("/api/ai/grade-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: res.jobId }),
        }).catch(() => {})
        toast.success("Đang chấm lại bài này.")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không chấm lại được")
      }
    })
  }

  function approveAll() {
    if (!job) return
    startTransition(async () => {
      try {
        await approveAiGradeResultsAction(job.id)
        await loadResults()
        toast.success("Đã duyệt điểm lên nhóm/học sinh")
        setOpen(false)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không duyệt được")
      }
    })
  }

  return (
    <div className="rounded-md border bg-primary/5 border-primary/20 p-2 flex flex-col gap-1.5 mt-1">
      <div className="flex items-center gap-2 text-xs">
        <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
        <span className="font-semibold">Chấm bài AI</span>
      </div>
      <label className="flex items-center justify-between gap-2 text-[11px]">
        <span className="leading-tight">Bật chấm AI</span>
        <Switch checked={enabled} onCheckedChange={toggleEnabled} aria-label="Bật chấm AI" />
      </label>
      {enabled && (
        <>
          {!compact && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setBaremOpen(true)}>
              <Sparkles className="size-3" /> Tiêu chí chấm
            </Button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground shrink-0">Chấm bằng</span>
            <Select
              value={providerChoice}
              onValueChange={(v) => setProviderChoice(v as AiProviderChoice)}
              disabled={running}
            >
              <SelectTrigger className="h-7 text-xs flex-1" aria-label="Chọn AI chấm bài">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Tự động</SelectItem>
                <SelectItem value="gemini">Gemini (cần key)</SelectItem>
                <SelectItem value="muse">Muse AI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={startGrade}
            disabled={pending || running}
          >
            {running ? <Loader2 className="size-3 animate-spin" /> : <Bot className="size-3" />}
            {running
              ? job?.provider === "muse_chat"
                ? `Muse chat đang chấm ${job?.completed ?? 0}/${job?.total ?? "?"}`
                : `Đang chấm ${job?.completed ?? 0}/${job?.total ?? "?"}`
              : "Chấm bài AI"}
          </Button>
          {job && (
            <Button variant="secondary" size="sm" className="h-7 text-xs gap-1" onClick={openResults}>
              <Eye className="size-3" />
              {running ? "Xem tiến độ chấm" : "Xem kết quả chấm"}
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setEvalOpen(true)}>
            <BarChart3 className="size-3" /> Đánh giá tổng thể
          </Button>
          <Link href="/settings/ai" className="text-[10px] text-muted-foreground hover:underline">
            Cài API Gemini
          </Link>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Kết quả chấm AI</DialogTitle>
            <DialogDescription>
              Điểm chưa lên sổ. Duyệt mới ghi điểm cho {kind === "group" ? "nhóm" : "học sinh"}.
            </DialogDescription>
          </DialogHeader>
          {job && (
            <p className="text-xs text-muted-foreground">
              {job.status === "running" || job.status === "queued"
                ? `Đang chấm ${job.completed}/${job.total}`
                : job.status === "error"
                  ? job.error_message ?? "Lỗi"
                  : `Xong ${job.completed}/${job.total}${job.error_message ? ` · ${job.error_message}` : ""}`}
            </p>
          )}
          {scoreAnomaly?.kind === "same" && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
              <p className="font-semibold text-amber-700 dark:text-amber-400">Cảnh báo điểm bất thường</p>
              <p className="text-muted-foreground mt-0.5">
                Tất cả {scoreAnomaly.names.length} bài đều cùng điểm {scoreAnomaly.value} — kiểm tra
                lại xem AI có chấm ẩu không trước khi duyệt.
              </p>
            </div>
          )}
          {scoreAnomaly?.kind === "outlier" && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
              <p className="font-semibold text-amber-700 dark:text-amber-400">Cảnh báo điểm bất thường</p>
              <p className="text-muted-foreground mt-0.5">
                {scoreAnomaly.names.length} bài lệch hơn 2.5đ so với trung bình (
                {scoreAnomaly.mean.toFixed(1)}đ): {scoreAnomaly.names.join(", ")} — kiểm tra lại
                trước khi duyệt.
              </p>
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {results.map((r) => {
              const name =
                (r.session_group_id && labelByTarget[`g:${r.session_group_id}`]) ||
                (r.session_slot_id && labelByTarget[`s:${r.session_slot_id}`]) ||
                "Bài nộp"
              return (
                <li key={r.id} className="rounded-md border p-2 text-xs flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{name}</span>
                    <span className="ml-auto inline-flex items-center gap-2">
                      {r.status === "ready" && r.ai_score != null && (
                        <span className="font-bold text-primary tabular-nums">{r.ai_score} đ</span>
                      )}
                      {r.status === "approved" && (
                        <span className="text-primary inline-flex items-center gap-0.5">
                          <Check className="size-3" /> Đã duyệt
                        </span>
                      )}
                      {r.status === "error" && <span className="text-destructive">Lỗi</span>}
                      {r.submission_id && !running && (
                        <button
                          type="button"
                          onClick={() => regradeOne(r)}
                          disabled={pending}
                          className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-primary disabled:opacity-40 shrink-0"
                          title="Xóa kết quả cũ và chấm lại bài này bằng AI"
                        >
                          <RotateCcw className="size-3" /> Chấm lại
                        </button>
                      )}
                    </span>
                    {r.unreadable && <span className="text-muted-foreground">Khó đọc</span>}
                  </div>
                  {r.ai_feedback && <p className="text-muted-foreground whitespace-pre-wrap">{r.ai_feedback}</p>}
                  {r.error_message && <p className="text-destructive">{r.error_message}</p>}
                </li>
              )
            })}
            {results.length === 0 && <p className="text-sm text-muted-foreground">Chưa có kết quả.</p>}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Đóng
            </Button>
            <Button onClick={approveAll} disabled={pending || results.every((r) => r.status !== "ready")}>
              Duyệt lên điểm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RubricBaremDialog
        sessionId={sessionId}
        open={paramOpen}
        onOpenChange={setBaremOpen}
        initialRubric={rubric}
        onSaved={(r) => setRubric(r)}
      />
      <EvalReportDialog sessionId={sessionId} open={evalOpen} onOpenChange={setEvalOpen} />
    </div>
  )
}
