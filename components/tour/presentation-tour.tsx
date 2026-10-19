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
  presentationEdgeStep,
  presentationTimerStep,
  presentationQrStep,
  presentationGradeStep,
} from "./tour-config"
import { useTourOptions } from "./use-tour-options"

// Tour màn hình chiếu PowerPoint (fullscreen): từng hint xuất hiện theo hành
// động thật của giáo viên — mở drawer → chỉnh thời gian/QR/chấm bài ngay trên
// màn chiếu. (Các bước "Tất cả phiên"/"Tạo phiên mới" thuộc UI chế độ nhúng,
// không tồn tại ở fullscreen nên đã gỡ khỏi tour này.)
type Stage = "idle" | "edge" | "drawer" | "done"

type PresentationTourProps = {
  active: boolean
  drawerOpen: boolean
}

export function PresentationTour({ active, drawerOpen }: PresentationTourProps) {
  const [stage, setStage] = useState<Stage>("idle")
  const [run, setRun] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const tourOptions = useTourOptions()
  // Đọc localStorage trong effect (không đọc lúc render) để tránh hydration mismatch.
  const [onboardingEnabled, setOnboardingEnabled] = useState(false)

  useEffect(() => {
    setOnboardingEnabled(
      !getSeen(TOUR_ONBOARDING_SEEN_KEY) && !getSeen(PRESENTATION_TOUR_SEEN_KEY),
    )
  }, [])

  // Tự chạy khi onboarding chưa xong + chưa xem tour màn chiếu. Khi replay
  // (nút "Hướng dẫn") được kích hoạt, cho phép chạy kể cả sau khi đã xem.
  const enabled = onboardingEnabled || replaying

  // Vào màn chiếu → bắt đầu từ hint mép trái. Không ghi đè stage khi replay
  // giữa chừng (drawer đang mở).
  useEffect(() => {
    if (!enabled) return
    if (active) setStage((s) => (s === "idle" || s === "done" ? "edge" : s))
    else setRun(false)
  }, [active, enabled])

  // Giáo viên mở drawer → chuyển sang hint chỉnh thời gian/QR/chấm bài.
  useEffect(() => {
    if (!enabled) return
    if (drawerOpen) setStage((s) => (s === "edge" || s === "idle" ? "drawer" : s))
  }, [drawerOpen, enabled])

  // Replay từ nút "Hướng dẫn" trên header: reset về hint mép trái khi đang chiếu.
  useEffect(() => {
    if (typeof window === "undefined") return
    const onRestart = () => {
      if (!active) return
      setReplaying(true)
      setStage(drawerOpen ? "drawer" : "edge")
      setRun(false)
      window.setTimeout(() => setRun(true), 120)
    }
    window.addEventListener(RESTART_EVENT, onRestart)
    return () => window.removeEventListener(RESTART_EVENT, onRestart)
  }, [active, drawerOpen])

  const steps = useMemo<Step[]>(() => {
    switch (stage) {
      case "edge":
        return [presentationEdgeStep()]
      case "drawer":
        return [presentationTimerStep(), presentationQrStep(), presentationGradeStep()]
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
    setRun(shouldRun)
  }, [stage, active, drawerOpen, enabled])

  function handleEvent(data: EventData) {
    if (data.type !== EVENTS.TOUR_END) return
    setRun(false)
    if (data.status === STATUS.SKIPPED) return
    // Nhánh multi-step (thời gian + QR + chấm bài) kết thúc → hoàn tất tour.
    if (stage === "drawer") {
      setSeen(PRESENTATION_TOUR_SEEN_KEY)
      setOnboardingEnabled(false)
      setReplaying(false)
      setStage("done")
    }
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
