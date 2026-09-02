"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Joyride, EVENTS, STATUS, type EventData, type Step } from "react-joyride"
import { RESTART_EVENT, rosterTourSeen, setRosterTourSeen } from "./tour-store"
import {
  tourLocale,
  rosterListStep,
  rosterLeaderStep,
  rosterNextStep,
} from "./tour-config"
import { useTourOptions } from "./use-tour-options"

// Tour phân nhóm progressive: hint xuất hiện theo hành động thật của giáo viên —
// vào trang (danh sách HS) → kéo ≥1 HS vào nhóm (hint nhóm trưởng) → gán leader
// (hint chuyển tab). Hoàn tất bước cuối → setRosterTourSeen().
type Stage = "idle" | "list" | "leader" | "next" | "done"

type RosterTourProps = {
  ready: boolean
  hasMembers: boolean
  hasLeader: boolean
}

export function RosterTour({ ready, hasMembers, hasLeader }: RosterTourProps) {
  const [stage, setStage] = useState<Stage>("idle")
  const [run, setRun] = useState(false)
  const prevStageRef = useRef<Stage>("idle")
  const [enabled, setEnabled] = useState(false)
  const tourOptions = useTourOptions()

  useEffect(() => {
    setEnabled(!rosterTourSeen())
  }, [])

  // Vào trang (đã có nhóm, chưa xem tour) → hint danh sách học sinh.
  useEffect(() => {
    if (!enabled || !ready) return
    if (stage === "idle") setStage("list")
  }, [enabled, ready, stage])

  // Kéo ≥1 HS vào nhóm → hint nhóm trưởng.
  useEffect(() => {
    if (!enabled) return
    if (hasMembers && (stage === "idle" || stage === "list")) setStage("leader")
  }, [hasMembers, enabled, stage])

  // Gán nhóm trưởng → hint chuyển tab.
  useEffect(() => {
    if (!enabled) return
    if (hasLeader && (stage === "idle" || stage === "list" || stage === "leader")) {
      setStage("next")
    }
  }, [hasLeader, enabled, stage])

  // Bật hint khi chuyển stage (Joyride remount theo key). Không tự bật lại khi
  // người dùng đã đóng hint ở cùng stage — chỉ bật khi có hành động mới.
  // Không gate theo `enabled` để replay (nút "Hướng dẫn") vẫn chạy sau khi đã xem;
  // khi chưa xem, stage chỉ rời "idle" qua auto-start, còn khi đã xem stage chỉ
  // đổi qua RESTART_EVENT.
  useEffect(() => {
    if (stage === prevStageRef.current) return
    prevStageRef.current = stage
    if (stage === "list" || stage === "leader" || stage === "next") setRun(true)
  }, [stage])

  // Replay từ nút "Hướng dẫn" trên header.
  useEffect(() => {
    if (typeof window === "undefined") return
    const onRestart = () => {
      setStage(hasLeader ? "next" : hasMembers ? "leader" : "list")
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
    if (data.status !== STATUS.FINISHED) return
    if (stage === "next") {
      setRosterTourSeen()
      setEnabled(false)
      setStage("done")
    }
  }

  if (stage === "done") return null

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
