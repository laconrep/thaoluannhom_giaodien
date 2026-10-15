"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getGroupMembersWithScoresAction,
  overrideStudentScoreAction,
} from "@/app/actions"
import { Dices, Square, Trophy, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"

type Member = { studentId: string; name: string; score: number | null }

// Thời gian chạy random chọn học sinh lên báo cáo.
const RANDOM_MS = 15000

function ScoreCell({
  member,
  sessionId,
  maxScore,
  onSaved,
}: {
  member: Member
  sessionId: string
  maxScore: number
  onSaved: (studentId: string, score: number | null) => void
}) {
  const [val, setVal] = useState(member.score?.toString() ?? "")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setVal(member.score?.toString() ?? "")
  }, [member.score])

  function commit() {
    const raw = val.trim()
    const num = raw === "" ? null : Number(raw)
    if (raw !== "" && !Number.isFinite(num)) {
      setVal(member.score?.toString() ?? "")
      return
    }
    const clamped = num === null ? null : Math.max(0, Math.min(maxScore, Math.round(num * 100) / 100))
    if (clamped === member.score) return
    startTransition(async () => {
      try {
        await overrideStudentScoreAction(sessionId, member.studentId, clamped)
        onSaved(member.studentId, clamped)
        toast.success(`Đã lưu điểm của ${member.name}`, { duration: 1500 })
      } catch {
        toast.error("Không lưu được điểm")
        setVal(member.score?.toString() ?? "")
      }
    })
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        className="w-[72px] h-8 text-sm text-center tabular-nums"
        type="number"
        min={0}
        max={maxScore}
        step={0.25}
        value={val}
        disabled={pending}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
          if (e.key === "Escape") setVal(member.score?.toString() ?? "")
        }}
        placeholder="—"
        aria-label={`Điểm của ${member.name}`}
      />
      <span className="text-xs text-muted-foreground">/{maxScore}</span>
    </div>
  )
}

export function GroupMembersDialog({
  open,
  onClose,
  sessionId,
  sessionGroupId,
  groupLabel,
  maxScore = 10,
}: {
  open: boolean
  onClose: () => void
  sessionId: string
  sessionGroupId: string
  groupLabel: string
  maxScore?: number
}) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const rollRef = useRef<{ timeout?: number; highlight: string | null }>({ highlight: null })

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setPickedId(null)
    setHighlightId(null)
    getGroupMembersWithScoresAction(sessionGroupId)
      .then(setMembers)
      .catch(() => toast.error("Không tải được danh sách thành viên"))
      .finally(() => setLoading(false))
  }, [open, sessionGroupId])

  // Dọn timer khi đóng popup / unmount.
  useEffect(() => {
    if (!open) {
      if (rollRef.current.timeout) window.clearTimeout(rollRef.current.timeout)
      rollRef.current = { highlight: null }
      setRolling(false)
    }
    return () => {
      if (rollRef.current.timeout) window.clearTimeout(rollRef.current.timeout)
    }
  }, [open ])

  function finishRoll() {
    if (rollRef.current.timeout) window.clearTimeout(rollRef.current.timeout)
    rollRef.current.timeout = undefined
    if (rollRef.current.highlight) {
      setPickedId(rollRef.current.highlight)
    }
    setRolling(false)
  }

  function startRandom() {
    if (members.length === 0 || rolling) return
    setRolling(true)
    setPickedId(null)
    const deadline = Date.now() + RANDOM_MS
    const tick = () => {
      const id = members[Math.floor(Math.random() * members.length)].studentId
      rollRef.current.highlight = id
      setHighlightId(id)
      if (Date.now() >= deadline) {
        finishRoll()
        return
      }
      // Chậm dần về cuối cho hồi hộp.
      const remain = deadline - Date.now()
      const gap = remain < 3000 ? 260 : 90
      rollRef.current.timeout = window.setTimeout(tick, gap)
    }
    tick()
  }

  if (!open) return null

  const picked = members.find((m) => m.studentId === pickedId) ?? null
  const highlight = members.find((m) => m.studentId === highlightId) ?? null
  const displayName = rolling ? (highlight?.name ?? "…") : (picked?.name ?? "Bấm Random để chọn")

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Thành viên ${groupLabel}`}
    >
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-lg border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="font-heading text-base font-bold">Thành viên — {groupLabel}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Điểm mỗi em mặc định bằng điểm nhóm. Sửa trực tiếp để cho điểm riêng.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="size-8 shrink-0" aria-label="Đóng">
            <X className="size-4" />
          </Button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Random chọn học sinh báo cáo */}
          <div className="rounded-lg border bg-muted/40 p-3 flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">Học sinh báo cáo</p>
            <p
              className={cn(
                "font-heading text-xl font-bold text-center min-h-[2rem]",
                !rolling && picked && "text-primary",
              )}
            >
              {!rolling && picked ? (
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="size-5 text-amber-500" />
                  {displayName}
                </span>
              ) : (
                displayName
              )}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={startRandom}
                disabled={rolling || members.length === 0}
                className="gap-1.5"
              >
                {rolling ? <Loader2 className="size-4 animate-spin" /> : <Dices className="size-4" />}
                {rolling ? "Đang chọn…" : "Random"}
              </Button>
              {rolling && (
                <Button size="sm" variant="secondary" onClick={finishRoll} className="gap-1.5">
                  <Square className="size-4" />
                  Dừng
                </Button>
              )}
            </div>
            {rolling && <p className="text-[11px] text-muted-foreground">Tự dừng sau 15 giây</p>}
          </div>

          {/* Danh sách + điểm */}
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Đang tải…
            </p>
          ) : members.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nhóm chưa có thành viên.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {members.map((m) => {
                const isPicked = m.studentId === pickedId
                const isHighlight = rolling && m.studentId === highlightId
                return (
                  <li
                    key={m.studentId}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors",
                      isPicked && "border-primary bg-primary/5",
                      isHighlight && "border-amber-500 bg-amber-500/10",
                    )}
                  >
                    <span className="text-sm font-medium truncate flex items-center gap-1.5">
                      {isPicked && !rolling && <Trophy className="size-4 text-amber-500 shrink-0" />}
                      {m.name}
                    </span>
                    <ScoreCell
                      member={m}
                      sessionId={sessionId}
                      maxScore={maxScore}
                      onSaved={(studentId, score) =>
                        setMembers((ms) =>
                          ms.map((x) => (x.studentId === studentId ? { ...x, score } : x)),
                        )
                      }
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
