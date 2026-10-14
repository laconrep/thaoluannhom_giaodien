"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { requestAiBaremAction, saveSessionAiRubricAction } from "@/app/ai-grade-actions"
import { parseGradingBarem } from "@/lib/ai/rubric-format"
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
import type { GradingBarem, BaremCriterion } from "@/lib/types"
import { Bot, Loader2, Plus, Trash2 } from "lucide-react"

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

export function RubricBaremDialog({ sessionId, open, onOpenChange, initialRubric, onSaved }: Props) {
  const [answer, setAnswer] = useState("")
  const [maxScore, setMaxScore] = useState(10)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [barem, setBarem] = useState<GradingBarem | null>(null)
  const [pending, startTransition] = useTransition()
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      setBarem(parseGradingBarem(initialRubric))
      const m = parseGradingBarem(initialRubric)?.max_score
      if (m) setMaxScore(m)
      setGenError(null)
      setGenerating(false)
      setAnswer("")
    }
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [open, initialRubric])

  function pollBaremRequest(requestId: string) {
    const supabase = createClient()
    let tries = 0
    const tick = window.setInterval(async () => {
      tries++
      try {
        const { data } = await supabase
          .from("ai_barem_requests")
          .select("status,barem_json,error_message")
          .eq("id", requestId)
          .maybeSingle()
        const row = data as { status: string; barem_json: unknown; error_message: string | null } | null
        if (!row) return
        if (row.status === "done" && row.barem_json) {
          window.clearInterval(tick)
          pollRef.current = null
          const p = normalizeBarem(row.barem_json, maxScore)
          setGenerating(false)
          if (p) {
            setBarem(p)
            setMaxScore(p.max_score)
            toast.success("AI đã soạn xong tiêu chí — bác kiểm tra và chỉnh sửa nhé")
          } else {
            setGenError("AI trả về dữ liệu không đúng định dạng. Thử lại.")
          }
        } else if (row.status === "error") {
          window.clearInterval(tick)
          pollRef.current = null
          setGenerating(false)
          setGenError(row.error_message || "AI tạo tiêu chí thất bại.")
        } else if (tries > 72) {
          window.clearInterval(tick)
          pollRef.current = null
          setGenerating(false)
          setGenError("Quá thời gian chờ AI (3 phút). Thử lại sau.")
        }
      } catch {
        // thử lại ở tick sau
      }
    }, 2500)
    pollRef.current = tick
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
      setGenerating(true)
      pollBaremRequest(res.requestId)
    })
  }

  function updateCriterion(i: number, patch: Partial<BaremCriterion>) {
    setBarem((p) =>
      p ? { ...p, criteria: p.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) } : p,
    )
  }

  function addCriterion() {
    setBarem((p) =>
      p ? { ...p, criteria: [...p.criteria, { name: "", points: 1, expect: [], notes: "" }] } : p,
    )
  }

  function removeCriterion(i: number) {
    setBarem((p) => (p ? { ...p, criteria: p.criteria.filter((_, j) => j !== i) } : p))
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
            Nhập đáp án mẫu, nhờ AI chia thành các tiêu chí có trọng số, rồi chỉnh sửa trước khi lưu.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <div className="text-xs font-semibold mb-1">Đáp án mẫu</div>
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Dán đáp án mẫu của bài vào đây…"
              className="min-h-24 text-xs"
            />
          </div>
          <div className="flex items-end gap-2">
            <div>
              <div className="text-xs font-semibold mb-1">Thang điểm</div>
              <Input
                type="number"
                min={1}
                max={10}
                value={maxScore}
                onChange={(e) => setMaxScore(Math.max(1, Math.min(10, Number(e.target.value) || 10)))}
                className="w-20 h-8 text-xs"
              />
            </div>
            <Button size="sm" className="h-8 text-xs gap-1" onClick={requestBarem} disabled={pending || generating}>
              {generating ? <Loader2 className="size-3 animate-spin" /> : <Bot className="size-3" />}
              {generating ? "AI đang soạn…" : "AI chia barem"}
            </Button>
          </div>
          {generating && (
            <p className="text-[11px] text-muted-foreground">
              AI đang đọc đáp án và chia tiêu chí — thường mất dưới 1 phút. Cứ để popup mở.
            </p>
          )}
          {genError && <p className="text-[11px] text-destructive">{genError}</p>}

          {barem && (
            <div className="border-t pt-3 mt-1">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold">Tiêu chí chấm (mẫu A)</div>
                <div
                  className={`text-xs font-bold tabular-nums ${totalPoints === barem.max_score ? "text-primary" : "text-destructive"}`}
                >
                  Tổng: {totalPoints}/{barem.max_score}
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
                        onChange={(e) => updateCriterion(i, { points: Math.max(0, Number(e.target.value) || 0) })}
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
        </div>

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
