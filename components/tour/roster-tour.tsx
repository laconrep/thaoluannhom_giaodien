"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Joyride, EVENTS, type EventData, type Step } from "react-joyride"
import {
  RESTART_EVENT,
  rosterHintSeen,
  setRosterHintSeen,
  type RosterHint,
} from "./tour-store"
import {
  tourLocale,
  rosterListStep,
  rosterLeaderStep,
  rosterNextStep,
} from "./tour-config"
import { useTourOptions } from "./use-tour-options"

// Tour phân nhóm progressive: từng hint chỉ tự hiện 1 lần.
// Vào trang (danh sách HS) → kéo ≥1 HS vào nhóm (hint nhóm trưởng) → gán leader
// (hint chuyển tab). Đóng/hoàn tất hint nào thì ghi cờ hint đó, lần sau không bật lại.
type Stage = "idle" | "list" | "leader" | "next" | "done"

type RosterTourProps = {
  ready: boolean
  hasMembers: boolean
  hasLeader: boolean
}

const INITIAL_SEEN: Record<RosterHint, boolean> = {
  list: true,
  leader: true,
  next: true,
}

export function RosterTour({ ready, hasMembers, hasLeader }: RosterTourProps) {
  const [stage, setStage] = useState<Stage>("idle")
  const [run, setRun] = useState(false)
  const prevStageRef = useRef<Stage>("idle")
  const [seen, setSeenState] = useState<Record<RosterHint, boolean>>(INITIAL_SEEN)
  const [hydrated, setHydrated] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const tourOptions = useTourOptions()

  useEffect(() => {
    setSeenState({
      list: rosterHintSeen("list"),
      leader: rosterHintSeen("leader"),
      next: rosterHintSeen("next"),
    })
    setHydrated(true)
  }, [])

  function markHint(hint: RosterHint) {
    setRosterHintSeen(hint)
    setSeenState((cur) => ({ ...cur, [hint]: true }))
  }

  const pending = !seen.list || !seen.leader || !seen.next
  const enabled = replaying || pending

  // Vào trang: chỉ bật hint chưa xem, khớp trạng thái lớp hiện tại.
  useEffect(() => {
    if (!hydrated || replaying || !ready || stage !== "idle") return
    if (hasLeader && !seen.next) setStage("next")
    else if (hasMembers && !seen.leader) setStage("leader")
    else if (!hasMembers && !seen.list) setStage("list")
  }, [hydrated, ready, hasMembers, hasLeader, seen, stage, replaying])

  // Kéo ≥1 HS vào nhóm → hint nhóm trưởng (nếu chưa xem).
  useEffect(() => {
    if (!hydrated || replaying || !hasMembers || seen.leader) return
    if (stage === "idle" || stage === "list") setStage("leader")
  }, [hydrated, hasMembers, seen.leader, stage, replaying])

  // Gán nhóm trưởng → hint chuyển tab (nếu chưa xem).
  useEffect(() => {
    if (!hydrated || replaying || !hasLeader || seen.next) return
    if (stage === "idle" || stage === "list" || stage === "leader") setStage("next")
  }, [hydrated, hasLeader, seen.next, stage, replaying])

  // Bật hint khi chuyển stage. Không tự bật lại khi người dùng đã đóng hint
  // ở cùng stage — chỉ bật khi có hành động mới hoặc replay.
  useEffect(() => {
    if (stage === prevStageRef.current) return
    prevStageRef.current = stage
    if (stage === "list" || stage === "leader" || stage === "next") setRun(true)
  }, [stage])

  // Replay từ nút "Hướng dẫn" trên header.
  useEffect(() => {
    if (typeof window === "undefined") return
    const onRestart = () => {
      const next: Stage = hasLeader ? "next" : hasMembers ? "leader" : "list"
      setReplaying(true)
      setStage(next)
      setRun(false)
      window.setTimeout(() => setRun(true), 80)
    }
    window.addEventListener(RESTART_EVENT, onRestart)
    return () => window.removeEventListener(RESTART_EVENT, onRestart)
  }, [hasMembers, hasLeader])

  const steps = useMemo<Step[]>(() => {
    switch (stage) {
      case "list":
        return [rosterListStep()]
      case "leader":
        return [rosterLeaderStep()]
      case "next":
        return [rosterNextStep()]
      default:
        return []
    }
  }, [stage])

  function handleEvent(data: EventData) {
    if (data.type !== EVENTS.TOUR_END) return
    setRun(false)
    if (replaying) {
      setReplaying(false)
      return
    }
    if (stage === "list" || stage === "leader" || stage === "next") {
      markHint(stage)
    }
    if (stage === "next") setStage("done")
  }

  if (!hydrated || !enabled || stage === "idle" || stage === "done") return null

  return (
    <Joyride
      key={`roster-${stage}`}
      steps={steps}
      run={run}
      scrollToFirstStep={false}
      locale={tourLocale}
      options={tourOptions}
      onEvent={handleEvent}
    />
  )
}
