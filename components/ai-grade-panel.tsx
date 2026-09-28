"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  approveAiGradeResultsAction,
  saveSessionAiRubricAction,
  setSessionAiEnabledAction,
  startAiGradeJobAction,
} from "@/app/ai-grade-actions"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AiGradeJobRow, AiGradeResultRow, SessionGroupRow, SessionSlotRow } from "@/lib/types"
import { Bot, Check, Eye, Loader2, Sparkles } from "lucide-react"

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
  const [pending, startTransition] = useTransition()
  const prevJobStatus = useRef<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("ai_grade_jobs")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((res: { data: AiGradeJobRow | null }) => {
        if (res.data) setJob(res.data)
      })
  }, [sessionId])

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`ai-job-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_grade_jobs", filter: `session_id=eq.${sessionId}` },
        (p: { new?: AiGradeJobRow }) => {
          if (p.new) setJob(p.new)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [sessionId])

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

  function saveRubric() {
    startTransition(async () => {
      try {
        await saveSessionAiRubricAction(sessionId, rubric)
        toast.success("Đã lưu tiêu chí chấm")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không lưu được")
      }
    })
  }

  function startGrade() {
    startTransition(async () => {
      try {
        if (rubric.trim() !== (initialRubric ?? "")) {
          await saveSessionAiRubricAction(sessionId, rubric)
        }
        const { jobId, total } = await startAiGradeJobAction(sessionId)
        setJob({
          id: jobId,
          session_id: sessionId,
          teacher_id: "",
          status: "queued",
          total,
          completed: 0,
          error_message: null,
          created_at: new Date().toISOString(),
          finished_at: null,
        })
        fetch("/api/ai/grade-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        }).catch(() => {})
        toast.success("AI đang chấm ngầm. Có thể tiếp tục sửa bài.")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không bắt đầu được")
      }
    })
  }

  async function openResults() {
    await loadResults()
    setOpen(true)
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
        <span className="leading-tight">Bật chấm bằng Gemini</span>
        <Switch checked={enabled} onCheckedChange={toggleEnabled} aria-label="Bật chấm AI" />
      </label>
      {enabled && (
        <>
          {!compact && (
            <Textarea
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              placeholder="Đáp án / tiêu chí chấm (tuỳ chọn)"
              className="min-h-16 text-xs"
            />
          )}
          {!compact && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={saveRubric} disabled={pending}>
              Lưu tiêu chí
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={startGrade}
            disabled={pending || running}
          >
            {running ? <Loader2 className="size-3 animate-spin" /> : <Bot className="size-3" />}
            {running ? `Đang chấm ${job?.completed ?? 0}/${job?.total ?? "?"}` : "Chấm bài AI"}
          </Button>
          {(done || readyCount > 0 || job?.status === "error") && (
            <Button variant="secondary" size="sm" className="h-7 text-xs gap-1" onClick={openResults}>
              <Eye className="size-3" />
              Xem kết quả chấm
            </Button>
          )}
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
                    {r.status === "ready" && r.ai_score != null && (
                      <span className="ml-auto font-bold text-primary tabular-nums">{r.ai_score} đ</span>
                    )}
                    {r.status === "approved" && (
                      <span className="ml-auto text-primary inline-flex items-center gap-0.5">
                        <Check className="size-3" /> Đã duyệt
                      </span>
                    )}
                    {r.status === "error" && <span className="ml-auto text-destructive">Lỗi</span>}
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
    </div>
  )
}
