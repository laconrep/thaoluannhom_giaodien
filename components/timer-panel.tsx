"use client"

import { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Clock, Play, RotateCcw, StopCircle } from "lucide-react"
import { useCountdown, formatClock } from "@/lib/use-countdown"
import { toast } from "sonner"
import {
  endSessionAction,
  reopenSessionAction,
  startSessionAction,
} from "@/app/actions"

type Status = "idle" | "running" | "ended"

const PRESETS = [1, 3, 5, 10, 15]
const UNLIMITED = 0

function isUnlimitedDuration(seconds: number) {
  return seconds <= 0
}

export function TimerPanel({
  sessionId,
  status,
  endsAt,
  durationSeconds,
  onChanged,
}: {
  sessionId: string
  status: Status
  endsAt: string | null
  durationSeconds: number
  onChanged?: (session: any) => void
}) {
  const [unlimited, setUnlimited] = useState(() => isUnlimitedDuration(durationSeconds))
  const [minutes, setMinutes] = useState<number>(() =>
    isUnlimitedDuration(durationSeconds) ? 0 : Math.floor(durationSeconds / 60),
  )
  const [seconds, setSeconds] = useState<number>(() =>
    isUnlimitedDuration(durationSeconds) ? 0 : durationSeconds % 60,
  )
  const [, startTransition] = useTransition()

  const left = useCountdown(endsAt, status)
  const runningUnlimited = status === "running" && !endsAt

  // Sync minutes/seconds when durationSeconds changes from props (e.g. when session reset)
  useEffect(() => {
    if (status !== "running") {
      const nextUnlimited = isUnlimitedDuration(durationSeconds)
      setUnlimited(nextUnlimited)
      setMinutes(nextUnlimited ? 0 : Math.floor(durationSeconds / 60))
      setSeconds(nextUnlimited ? 0 : durationSeconds % 60)
    }
  }, [durationSeconds, status])

  // Schedule auto-end exactly at ends_at timestamp (not driven by `left` which can lag)
  useEffect(() => {
    if (status !== "running" || !endsAt) return
    const ms = new Date(endsAt).getTime() - Date.now()
    const endOptimistic = { status: "ended", ends_at: null }
    const doEnd = () => {
      if (onChanged) onChanged(endOptimistic)
      startTransition(async () => {
        try {
          const next = await endSessionAction(sessionId)
          if (next) onChanged?.(next)
        } catch (err) {
          toast.error(`Không thể kết thúc phiên: ${(err as Error)?.message ?? "lỗi không xác định"}`)
        }
      })
    }
    if (ms <= 0) {
      doEnd()
      return
    }
    const id = setTimeout(doEnd, ms + 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, endsAt, sessionId])

  const totalConfigured = unlimited ? UNLIMITED : minutes * 60 + seconds
  const totalRemaining = left
  const totalInitial =
    status === "running" && endsAt
      ? Math.max(totalConfigured, totalRemaining, 1)
      : totalConfigured || 1
  const progressPct =
    runningUnlimited || (status !== "running" && unlimited)
      ? 100
      : status === "running"
        ? Math.max(0, Math.min(100, (totalRemaining / totalInitial) * 100))
        : status === "ended"
          ? 0
          : 100

  const clockValue =
    status === "running"
      ? runningUnlimited
        ? "Không hạn"
        : formatClock(left)
      : status === "ended"
        ? "00:00"
        : unlimited
          ? "Không hạn"
          : formatClock(totalConfigured)

  const isLow = status === "running" && !runningUnlimited && left > 0 && left <= 15

  function runAction(action: Promise<any>, optimistic: any, revert: any) {
    if (onChanged) onChanged(optimistic)
    startTransition(async () => {
      try {
        const next = await action
        if (next) onChanged?.(next)
      } catch (err) {
        toast.error(`Không thể thực hiện: ${(err as Error)?.message ?? "lỗi không xác định"}`)
        if (onChanged) onChanged(revert)
      }
    })
  }

  function handleStart() {
    const dur = unlimited ? UNLIMITED : Math.max(5, minutes * 60 + seconds)
    const now = new Date()
    const optimistic = {
      status: "running",
      duration_seconds: dur,
      started_at: now.toISOString(),
      ends_at: unlimited ? null : new Date(now.getTime() + dur * 1000).toISOString(),
    }
    runAction(startSessionAction(sessionId, dur), optimistic, { status, ends_at: endsAt, duration_seconds: durationSeconds })
  }

  function handleEnd() {
    runAction(endSessionAction(sessionId), { status: "ended", ends_at: null }, { status, ends_at: endsAt })
  }
  function handleReopen() {
    const duration = unlimited ? UNLIMITED : Math.max(5, minutes * 60 + seconds)
    const now = new Date()
    const optimistic = {
      status: "running",
      duration_seconds: duration,
      started_at: now.toISOString(),
      ends_at: unlimited ? null : new Date(now.getTime() + duration * 1000).toISOString(),
    }
    runAction(reopenSessionAction(sessionId, duration), optimistic, { status, ends_at: endsAt, duration_seconds: durationSeconds })
  }
  function applyPreset(mins: number) {
    setUnlimited(false)
    setMinutes(mins)
    setSeconds(0)
  }
  function applyUnlimited() {
    setUnlimited(true)
    setMinutes(0)
    setSeconds(0)
  }

  return (
    <div className="rounded-md border bg-card p-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Clock
          className={`size-4 ${isLow ? "text-destructive animate-pulse" : "text-primary"}`}
          aria-hidden="true"
        />
        <div
          className={`flex-1 text-center font-mono text-xl tabular-nums font-semibold ${
            isLow ? "text-destructive" : ""
          }`}
        >
          {clockValue}
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isLow ? "bg-destructive" : status === "ended" ? "bg-muted-foreground/30" : "bg-primary"
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {status !== "running" && (
        <>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={180}
              value={unlimited ? "" : minutes}
              placeholder={unlimited ? "—" : undefined}
              onChange={(e) => {
                setUnlimited(false)
                setMinutes(Math.max(0, Math.min(180, Number(e.target.value) || 0)))
              }}
              className="h-8 text-xs text-center"
              aria-label="Phút"
            />
            <span className="text-xs text-muted-foreground">phút</span>
            <Input
              type="number"
              min={0}
              max={59}
              value={unlimited ? "" : seconds}
              placeholder={unlimited ? "—" : undefined}
              onChange={(e) => {
                setUnlimited(false)
                setSeconds(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
              }}
              className="h-8 text-xs text-center"
              aria-label="Giây"
            />
            <span className="text-xs text-muted-foreground">giây</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => applyPreset(m)}
                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  !unlimited && minutes === m && seconds === 0
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 hover:bg-muted"
                }`}
              >
                {m}p
              </button>
            ))}
            <button
              type="button"
              onClick={applyUnlimited}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                unlimited
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 hover:bg-muted"
              }`}
              title="Không thời hạn"
              aria-label="Không thời hạn"
            >
              Không hạn
            </button>
          </div>
        </>
      )}

      {status === "idle" && (
        <Button size="sm" onClick={handleStart} className="gap-1">
          <Play className="size-4" aria-hidden="true" />
          Bắt đầu
        </Button>
      )}

      {status === "running" && (
        <Button size="sm" variant="destructive" onClick={handleEnd} className="gap-1 w-full">
          <StopCircle className="size-3" aria-hidden="true" />
          Hết giờ
        </Button>
      )}

      {status === "ended" && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-center text-muted-foreground">Đã kết thúc</span>
          <Button size="sm" variant="outline" onClick={handleReopen} className="gap-1">
            <RotateCcw className="size-3" aria-hidden="true" />
            Mở lại phiên
          </Button>
        </div>
      )}
    </div>
  )
}
