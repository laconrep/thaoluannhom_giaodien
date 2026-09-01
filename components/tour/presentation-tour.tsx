"use client"

import { useEffect, useMemo, useState } from "react"
import { Joyride, EVENTS, STATUS, type EventData, type Step } from "react-joyride"
import {
  getSeen,
  setSeen,
  PRESENTATION_TOUR_SEEN_KEY,
  RESTART_EVENT,
  TOUR_ONBOARDING_SEEN_KEY,
} from "./tour-store"
import {
  tourLocale,
  tourOptions,
  presentationEdgeStep,
  presentationTimerStep,
  presentationQrStep,
  presentationAllSessionsStep,
  presentationCreateSessionStep,
} from "./tour-config"

// Tour màn hình chiếu PowerPoint: từng hint xuất hiện theo hành động thật của
// giáo viên — mở drawer → chỉnh thời gian/QR → "Tất cả phiên" → "Tạo phiên mới".
type Stage = "idle" | "edge" | "drawer" | "all-sessions" | "create-session" | "done"

type PresentationTourProps = {
  active: boolean
  drawerOpen: boolean
  sessionPickerOpen: boolean
  createSessionOpen: boolean
}

export function PresentationTour({
  active,
  drawerOpen,
  sessionPickerOpen,
  createSessionOpen,
}: PresentationTourProps) {
  const [stage, setStage] = useState<Stage>("idle")
  const [run, setRun] = useState(false)
  const [replaying, setReplaying] = useState(false)

  // Tự chạy khi onboarding chưa xong + chưa xem tour màn chiếu. Khi replay
  // (nút "Hướng dẫn") được kích hoạt, cho phép chạy kể cả sau khi đã xem.
  const onboardingEnabled =
    typeof window !== "undefined" &&
    !getSeen(TOUR_ONBOARDING_SEEN_KEY) &&
    !getSeen(PRESENTATION_TOUR_SEEN_KEY)
  const enabled = onboardingEnabled || replaying

  // Vào màn chiếu → bắt đầu từ hint mép trái.
  useEffect(() => {
    if (!enabled) return
    if (active) setStage("edge")
    else setRun(false)
  }, [active, enabled])

  // Giáo viên mở drawer → chuyển sang hint chỉnh thời gian/QR.
  useEffect(() => {
    if (!enabled) return
    if (drawerOpen) setStage((s) => (s === "edge" || s === "idle" ? "drawer" : s))
  }, [drawerOpen, enabled])

  // Giáo viên bấm "Tất cả phiên" → hint "Tạo phiên mới".
  useEffect(() => {
    if (!enabled) return
    if (sessionPickerOpen) {
      setStage((s) => (s === "drawer" || s === "all-sessions" ? "create-session" : s))
    }
  }, [sessionPickerOpen, enabled])

  // Giáo viên bấm "Tạo phiên mới" → kết thúc tour màn chiếu.
  useEffect(() => {
    if (!enabled) return
    if (createSessionOpen && stage === "create-session") {
      setSeen(PRESENTATION_TOUR_SEEN_KEY)
      setReplaying(false)
      setRun(false)
      setStage("done")
    }
  }, [createSessionOpen, stage, enabled])

  // Replay từ nút "Hướng dẫn" trên header: reset về hint mép trái khi đang chiếu.
  useEffect(() => {
    if (typeof window === "undefined") return
    const onRestart = () => {
      if (!active) return
      setReplaying(true)
      setStage("edge")
      setRun(true)
    }
    window.addEventListener(RESTART_EVENT, onRestart)
    return () => window.removeEventListener(RESTART_EVENT, onRestart)
  }, [active])

  const steps = useMemo<Step[]>(() => {
    switch (stage) {
      case "edge":
        return [presentationEdgeStep()]
      case "drawer":
        return [presentationTimerStep(), presentationQrStep()]
      case "all-sessions":
        return [presentationAllSessionsStep()]
      case "create-session":
        return [presentationCreateSessionStep()]
      default:
        return []
    }
  }, [stage])

  useEffect(() => {
    if (!enabled) {
      setRun(false)
      return
    }
    let shouldRun = false
    if (stage === "edge") shouldRun = active && !drawerOpen
    else if (stage === "drawer") shouldRun = drawerOpen
    else if (stage === "all-sessions") shouldRun = drawerOpen && !sessionPickerOpen
    else if (stage === "create-session") shouldRun = sessionPickerOpen
    setRun(shouldRun)
  }, [stage, active, drawerOpen, sessionPickerOpen, enabled])

  function handleEvent(data: EventData) {
    if (data.type !== EVENTS.TOUR_END) return
    setRun(false)
    if (data.status === STATUS.SKIPPED) return
    // Nhánh multi-step (chỉnh thời gian + QR) kết thúc → dẫn sang "Tất cả phiên".
    if (stage === "drawer") setStage("all-sessions")
  }

  if (!enabled || stage === "done") return null

  return (
    <Joyride
      key={`presentation-${stage}`}
      steps={steps}
      run={run}
      continuous={stage === "drawer"}
      scrollToFirstStep={false}
      locale={tourLocale}
      options={tourOptions}
      onEvent={handleEvent}
    />
  )
}
