"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { requestAiBaremAction, saveSessionAiRubricAction, listGradedSamplesAction, requestAiBaremFromSampleAction } from "@/app/ai-grade-actions"
import { parseGradingBarem } from "@/lib/ai/rubric-format"
import { extractAnswerFromFile } from "@/lib/answer-extract"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { GradingBarem, BaremCriterion, GradedSample, BaremSelfCheck } from "@/lib/types"
import {
  rebalanceOnAdd,
  rebalanceOnEdit,
  rebalanceOnMaxScore,
  rebalanceOnRemove,
} from "@/lib/barem-points"
import { Bot, Loader2, Plus, Trash2, Upload, X } from "lucide-react"

type Props = {
  sessionId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  initialRubric: string | null
  onSaved: (rubric: string) => void
}

function normalizeBarem(raw: unknown, fallbackMax: number): GradingBarem | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Partial<GradingBarem>
  if (!Array.isArray(r.criteria) || r.criteria.length === 0) return null
  const criteria: BaremCriterion[] = r.criteria.map((c) => ({
    name: String(c?.name ?? "").trim() || "Tiêu chí",
    points: Math.max(0, Number(c?.points) || 0),
    expect: Array.isArray(c?.expect) ? c.expect.map((e) => String(e)).filter(Boolean) : [],
    notes: String(c?.notes ?? ""),
  }))
  const maxScore =
    Number(r.max_score) > 0 ? Math.round(Number(r.max_score)) : fallbackMax
  return { template: "criteria_weighted", version: 1, max_score: maxScore, criteria }
}

function normalizeSelfCheck(raw: unknown): BaremSelfCheck | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Partial<BaremSelfCheck>
  if (typeof o.teacher_score !== "number" || typeof o.ai_rescore !== "number") return null
  const diff = Math.round(Math.abs(o.teacher_score - o.ai_rescore) * 10) / 10
  return {
    teacher_score: o.teacher_score,
    ai_rescore: o.ai_rescore,
    diff,
    match: typeof o.match === "boolean" ? o.match : diff <= 1,
  }
}

function scoreBadgeClass(score: number | null): string {
  if (score == null) return "bg-muted text-muted-foreground"
  if (score >= 8) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
  if (score >= 6.5) return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
  if (score >= 5) return "bg-orange-500/15 text-orange-700 dark:text-orange-400"
  return "bg-red-500/15 text-red-700 dark:text-red-400"
}

function SignalBadge({ s }: { s: GradedSample }) {
  if (s.textCount > 0)
    return (
      <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
        💬 {s.textCount} nhận xét
      </span>
    )
  if (s.stampCount > 0)
    return (
      <span className="shrink-0 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-400">
        📌 {s.stampCount} dấu
      </span>
    )
  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      chỉ có điểm
    </span>
  )
}

const SAMPLE_STEPS = ["Chọn bài mẫu", "AI suy barem", "Duyệt & lưu"]

export function RubricBaremDialog({ sessionId, open, onOpenChange, initialRubric, onSaved }: Props) {
  const [tab, setTab] = useState<"answer" | "sample">("answer")
  const [answer, setAnswer] = useState("")
  const [maxScore, setMaxScore] = useState(10)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [barem, setBarem] = useState<GradingBarem | null>(null)
  const [pending, startTransition] = useTransition()
  const pollRef = useRef<number | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  // Realtime là kênh chính; polling chỉ chạy khi realtime lỗi hoặc >10s không có event.
  const lastRtAt = useRef(0)
  const rtFailed = useRef(false)
  const triesRef = useRef(0)
  const watchRequestId = useRef<string | null>(null)
  const watchKind = useRef<"answer" | "sample">("answer")

  // Tab 1: tải đáp án từ file
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [fileChip, setFileChip] = useState<{ name: string; tables: number; chars: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Tab 2: bài chấm mẫu
  const [samples, setSamples] = useState<GradedSample[]>([])
  const [samplesLoaded, setSamplesLoaded] = useState(false)
  const [samplesLoading, setSamplesLoading] = useState(false)
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null)
  const [sampleStep, setSampleStep] = useState<1 | 2 | 3>(1)
  const [selfCheck, setSelfCheck] = useState<BaremSelfCheck | null>(null)

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

  useEffect(() => {
    if (open) {
      setBarem(parseGradingBarem(initialRubric))
      const m = parseGradingBarem(initialRubric)?.max_score
      if (m) setMaxScore(m)
      setGenError(null)
      setGenerating(false)
      setAnswer("")
      setTab("answer")
      setFileChip(null)
      setDragOver(false)
      setSamples([])
      setSamplesLoaded(false)
      setSelectedSampleId(null)
      setSampleStep(1)
      setSelfCheck(null)
    }
    return () => {
      stopWatch()
    }
  }, [open, initialRubric])

  // Tải danh sách bài mẫu khi mở tab 2 lần đầu.
  useEffect(() => {
    if (open && tab === "sample" && !samplesLoaded && !samplesLoading) {
      loadSamples()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, samplesLoaded])

  async function loadSamples() {
    setSamplesLoading(true)
    try {
      const res = await listGradedSamplesAction(sessionId)
      if (res.ok) {
        setSamples(res.samples ?? [])
        setSamplesLoaded(true)
      } else {
        toast.error(res.error ?? "Không tải được danh sách bài mẫu.")
      }
    } catch {
      toast.error("Không tải được danh sách bài mẫu.")
    } finally {
      setSamplesLoading(false)
    }
  }

  /** Đọc self_check_json (cột do agent khác thêm) — thất bại thì bỏ qua, không vỡ luồng chính. */
  async function fetchSelfCheck(requestId: string) {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("ai_barem_requests")
        .select("self_check_json")
        .eq("id", requestId)
        .maybeSingle()
      if (error || !data) return
      const sc = normalizeSelfCheck((data as { self_check_json: unknown }).self_check_json)
      if (sc) setSelfCheck(sc)
    } catch {
      // Cột chưa có — bỏ qua.
    }
  }

  function applyBaremRow(
    row: { status: string; barem_json: unknown; error_message: string | null } | null,
    fallbackMax: number,
  ) {
    if (!row) return
    if (row.status === "done" && row.barem_json) {
      stopWatch()
      const p = normalizeBarem(row.barem_json, fallbackMax)
      setGenerating(false)
      if (p) {
        setBarem(p)
        setMaxScore(p.max_score)
        if (watchKind.current === "sample") {
          setSampleStep(3)
          if (watchRequestId.current) fetchSelfCheck(watchRequestId.current)
        }
        toast.success("AI đã soạn xong tiêu chí — bác kiểm tra và chỉnh sửa nhé")
      } else {
        setGenError("AI trả về dữ liệu không đúng định dạng. Thử lại.")
      }
    } else if (row.status === "error") {
      stopWatch()
      setGenerating(false)
      setGenError(row.error_message || "AI tạo tiêu chí thất bại.")
    }
  }

  async function pollBaremOnce(requestId: string, fallbackMax: number) {
    triesRef.current += 1
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from("ai_barem_requests")
        .select("status,barem_json,error_message")
        .eq("id", requestId)
        .maybeSingle()
      const row = data as { status: string; barem_json: unknown; error_message: string | null } | null
      applyBaremRow(row, fallbackMax)
      if (row && row.status !== "done" && row.status !== "error" && triesRef.current > 72) {
        stopWatch()
        setGenerating(false)
        setGenError("Quá thời gian chờ AI (3 phút). Thử lại sau.")
      }
    } catch {
      // thử lại ở tick sau
    }
  }

  function pollBaremRequest(requestId: string) {
    stopWatch()
    watchRequestId.current = requestId
    lastRtAt.current = 0
    rtFailed.current = false
    triesRef.current = 0
    const fallbackMax = maxScore
    const supabase = createClient()
    const ch = supabase
      .channel(`ai-barem-${requestId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ai_barem_requests", filter: `id=eq.${requestId}` },
        (p: { new?: { status: string; barem_json: unknown; error_message: string | null } }) => {
          lastRtAt.current = Date.now()
          if (p.new) applyBaremRow(p.new, fallbackMax)
        },
      )
      .subscribe((status: string) => {
        rtFailed.current = status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED"
      })
    channelRef.current = ch
    const tick = window.setInterval(() => {
      // Fallback: chỉ poll khi realtime lỗi hoặc quá 10s không có event.
      if (rtFailed.current || Date.now() - lastRtAt.current > 10000) {
        pollBaremOnce(requestId, fallbackMax).catch(() => {})
      }
    }, 2500)
    pollRef.current = tick
    pollBaremOnce(requestId, fallbackMax).catch(() => {})
  }

  function requestBarem() {
    if (!answer.trim()) {
      toast.error("Nhập đáp án mẫu trước đã bác.")
      return
    }
    setGenError(null)
    startTransition(async () => {
      const res = await requestAiBaremAction(sessionId, answer, maxScore)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      watchKind.current = "answer"
      setGenerating(true)
      pollBaremRequest(res.requestId)
    })
  }

  function requestSampleBarem() {
    if (!selectedSampleId) {
      toast.error("Chọn một bài mẫu trước đã bác.")
      return
    }
    setGenError(null)
    setSelfCheck(null)
    startTransition(async () => {
      const res = await requestAiBaremFromSampleAction(sessionId, selectedSampleId, maxScore)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      watchKind.current = "sample"
      setSampleStep(2)
      setGenerating(true)
      pollBaremRequest(res.requestId)
    })
  }

  async function handleAnswerFile(f: File | undefined | null) {
    if (!f) return
    try {
      const r = await extractAnswerFromFile(f)
      setAnswer(r.text)
      setFileChip({ name: f.name, tables: r.tables, chars: r.chars })
      toast.success(`Đã đọc ${f.name} — ${r.tables} bảng, ${r.chars.toLocaleString("vi-VN")} ký tự`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không đọc được file")
    }
  }

  function updateCriterion(i: number, patch: Partial<BaremCriterion>) {
    setBarem((p) =>
      p ? { ...p, criteria: p.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) } : p,
    )
  }

  // Sửa điểm 1 khung: giữ đúng số bác nhập, các khung còn lại tự cân theo tỉ lệ.
  function updateCriterionPoints(i: number, raw: number) {
    setBarem((p) => {
      if (!p) return p
      const pts = rebalanceOnEdit(
        p.criteria.map((c) => c.points),
        i,
        raw,
        p.max_score,
      )
      return { ...p, criteria: p.criteria.map((c, j) => ({ ...c, points: pts[j] })) }
    })
  }

  function addCriterion() {
    setBarem((p) => {
      if (!p) return p
      const pts = rebalanceOnAdd(
        p.criteria.map((c) => c.points),
        p.max_score,
        1,
      )
      const kept = p.criteria.map((c, j) => ({ ...c, points: pts[j] }))
      return {
        ...p,
        criteria: [...kept, { name: "", points: pts[pts.length - 1], expect: [], notes: "" }],
      }
    })
  }

  function removeCriterion(i: number) {
    setBarem((p) => {
      if (!p) return p
      const pts = rebalanceOnRemove(
        p.criteria.map((c) => c.points),
        i,
        p.max_score,
      )
      return {
        ...p,
        criteria: p.criteria.filter((_, j) => j !== i).map((c, j) => ({ ...c, points: pts[j] })),
      }
    })
  }

  // Đổi thang điểm: toàn bộ tiêu chí co/giãn theo tỉ lệ, tổng luôn khớp.
  function changeMaxScore(v: number) {
    const next = Math.max(1, Math.min(10, Number(v) || 10))
    setMaxScore(next)
    setBarem((p) => {
      if (!p || p.criteria.length === 0) return p
      const pts = rebalanceOnMaxScore(
        p.criteria.map((c) => c.points),
        next,
      )
      return {
        ...p,
        max_score: next,
        criteria: p.criteria.map((c, j) => ({ ...c, points: pts[j] })),
      }
    })
  }

  const totalPoints = barem?.criteria.reduce((s, c) => s + (Number(c.points) || 0), 0) ?? 0

  function saveBarem() {
    if (!barem || barem.criteria.length === 0) {
      toast.error("Chưa có tiêu chí nào.")
      return
    }
    if (totalPoints !== barem.max_score) {
      toast.error(`Tổng điểm tiêu chí (${totalPoints}) phải bằng ${barem.max_score}.`)
      return
    }
    if (barem.criteria.some((c) => !c.name.trim())) {
      toast.error("Mỗi tiêu chí cần có tên.")
      return
    }
    const json = JSON.stringify({ ...barem, max_score: barem.max_score })
    startTransition(async () => {
      try {
        await saveSessionAiRubricAction(sessionId, json, barem.max_score)
        toast.success("Đã lưu tiêu chí chấm")
        onSaved(json)
        onOpenChange(false)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không lưu được")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tiêu chí chấm</DialogTitle>
          <DialogDescription>
            Chọn 1 trong 2 cách: dán hoặc tải đáp án mẫu, hoặc để AI suy tiêu chí từ một bài đã chấm tay.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v === "sample" ? "sample" : "answer")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="answer">Từ đáp án mẫu</TabsTrigger>
            <TabsTrigger value="sample">Từ bài chấm mẫu</TabsTrigger>
          </TabsList>

          {/* TAB 1 — đáp án mẫu */}
          <TabsContent value="answer" className="flex flex-col gap-3 mt-2">
            <div>
              <div className="text-xs font-semibold mb-1">Đáp án mẫu</div>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  handleAnswerFile(e.dataTransfer.files?.[0])
                }}
                className={cn("rounded-md transition", dragOver && "ring-2 ring-primary ring-offset-2")}
              >
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Dán đáp án mẫu vào đây, hoặc kéo-thả file .docx/.pdf…"
                  className="min-h-24 text-xs"
                />
              </div>
              {fileChip && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground">
                  <span>
                    📄 {fileChip.name} · {fileChip.tables} bảng · {fileChip.chars.toLocaleString("vi-VN")} ký tự
                  </span>
                  <button
                    type="button"
                    onClick={() => setFileChip(null)}
                    aria-label="Bỏ file"
                    title="Bỏ file (giữ lại chữ đã đọc)"
                    className="hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <div className="text-xs font-semibold mb-1">Thang điểm</div>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={maxScore}
                  onChange={(e) => changeMaxScore(Number(e.target.value))}
                  className="w-20 h-8 text-xs"
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.pdf"
                className="hidden"
                onChange={(e) => {
                  handleAnswerFile(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={pending || generating}
              >
                <Upload className="size-3" />
                Tải đáp án
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1" onClick={requestBarem} disabled={pending || generating}>
                {generating ? <Loader2 className="size-3 animate-spin" /> : <Bot className="size-3" />}
                {generating ? "AI đang soạn…" : "AI chia barem"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Bảng và điểm ghi sẵn trong file sẽ được AI giữ nguyên.
            </p>
          </TabsContent>

          {/* TAB 2 — bài chấm mẫu */}
          <TabsContent value="sample" className="flex flex-col gap-3 mt-2">
            <div className="flex items-center gap-1">
              {SAMPLE_STEPS.map((label, i) => {
                const n = (i + 1) as 1 | 2 | 3
                const active = sampleStep === n
                const doneStep = sampleStep > n
                return (
                  <div key={label} className="flex items-center gap-1.5 flex-1 last:flex-none">
                    <span
                      className={cn(
                        "size-5 rounded-full grid place-items-center text-[10px] font-bold shrink-0",
                        active
                          ? "bg-primary text-primary-foreground"
                          : doneStep
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {n}
                    </span>
                    <span className={cn("text-[11px] whitespace-nowrap", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {label}
                    </span>
                    {n < 3 && <div className="flex-1 h-px bg-border mx-1" />}
                  </div>
                )
              })}
            </div>

            {samplesLoading ? (
              <p className="text-xs text-muted-foreground py-4 text-center flex items-center justify-center gap-2">
                <Loader2 className="size-3.5 animate-spin" /> Đang tải danh sách bài mẫu…
              </p>
            ) : samples.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                Chấm tay 1 bài bất kỳ trước, rồi quay lại đây nhé.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                {samples.map((s) => {
                  const selected = selectedSampleId === s.submissionId
                  return (
                    <label
                      key={s.submissionId}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md border p-2.5 cursor-pointer transition text-xs",
                        selected ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="graded-sample"
                        className="accent-primary size-3.5 shrink-0"
                        checked={selected}
                        onChange={() => {
                          setSelectedSampleId(s.submissionId)
                          setSampleStep(1)
                        }}
                      />
                      <span className="font-medium flex-1 truncate">{s.groupLabel}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 font-bold tabular-nums",
                          scoreBadgeClass(s.score),
                        )}
                      >
                        {s.score != null ? `${s.score}đ` : "—"}
                      </span>
                      <SignalBadge s={s} />
                    </label>
                  )
                })}
              </div>
            )}

            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <div className="text-xs font-semibold mb-1">Thang điểm</div>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={maxScore}
                  onChange={(e) => changeMaxScore(Number(e.target.value))}
                  className="w-20 h-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={requestSampleBarem}
                disabled={pending || generating || !selectedSampleId}
              >
                {generating && sampleStep === 2 ? <Loader2 className="size-3 animate-spin" /> : <Bot className="size-3" />}
                {generating && sampleStep === 2 ? "AI đang suy…" : "AI suy barem từ bài mẫu"}
              </Button>
            </div>

            {selfCheck && (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-xs",
                  selfCheck.match
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-amber-500/40 bg-amber-500/10",
                )}
              >
                {selfCheck.match ? (
                  <p>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Tự kiểm khớp ✓</span>
                    <span className="text-muted-foreground">
                      {" "}— Tay chấm {selfCheck.teacher_score} · AI chấm lại {selfCheck.ai_rescore} · chênh{" "}
                      {selfCheck.diff}
                    </span>
                  </p>
                ) : (
                  <p>
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      ⚠ Chênh {selfCheck.diff} — nên xem lại barem
                    </span>
                    <span className="text-muted-foreground">
                      {" "}(tay chấm {selfCheck.teacher_score}, AI chấm lại {selfCheck.ai_rescore})
                    </span>
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {generating && (
          <p className="text-[11px] text-muted-foreground">
            {watchKind.current === "sample"
              ? "AI đang đọc bài mẫu và suy tiêu chí — thường mất dưới 2 phút. Cứ để popup mở."
              : "AI đang đọc đáp án và chia tiêu chí — thường mất dưới 1 phút. Cứ để popup mở."}
          </p>
        )}
        {genError && <p className="text-[11px] text-destructive">{genError}</p>}

        {barem && (
          <div className="border-t pt-3 mt-1">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold">Tiêu chí chấm (mẫu A)</div>
              <div className="text-right">
                <div
                  className={`text-xs font-bold tabular-nums ${totalPoints === barem.max_score ? "text-primary" : "text-destructive"}`}
                >
                  Tổng: {totalPoints}/{barem.max_score}
                </div>
                <div className="text-[10px] text-muted-foreground">Điểm tự cân khi bác sửa từng khung</div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {barem.criteria.map((c, i) => (
                <div key={i} className="rounded-md border p-2 flex flex-col gap-1.5 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Input
                      value={c.name}
                      onChange={(e) => updateCriterion(i, { name: e.target.value })}
                      placeholder={`Tiêu chí ${i + 1}`}
                      className="h-8 text-xs flex-1"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={c.points}
                      onChange={(e) => updateCriterionPoints(i, Number(e.target.value))}
                      className="h-8 text-xs w-16"
                      aria-label="Điểm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeCriterion(i)}
                      aria-label="Xóa tiêu chí"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    value={c.expect.join("\n")}
                    onChange={(e) =>
                      updateCriterion(i, { expect: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })
                    }
                    placeholder="Các ý cần có (mỗi ý một dòng)"
                    className="min-h-14 text-xs"
                  />
                  <Input
                    value={c.notes}
                    onChange={(e) => updateCriterion(i, { notes: e.target.value })}
                    placeholder="Ghi chú trừ điểm (tuỳ chọn)"
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 mt-2" onClick={addCriterion}>
              <Plus className="size-3" /> Thêm tiêu chí
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button size="sm" onClick={saveBarem} disabled={pending || !barem}>
            {pending ? <Loader2 className="size-3 animate-spin" /> : null} Lưu tiêu chí
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
