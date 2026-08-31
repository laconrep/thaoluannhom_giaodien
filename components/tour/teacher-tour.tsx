"use client"

import { Joyride, EVENTS, STATUS, type EventData, type Step } from "react-joyride"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { getSeen, setSeen, RESTART_EVENT } from "./tour-store"
import { tourLocale, tourOptions } from "./tour-config"

type TeacherTourProps = {
  tourId: string
  steps: Step[]
  seenKey: string
  autoStart?: boolean
  autoStartWhen?: boolean
  onComplete?: () => void
  isSeen?: () => boolean
  markSeen?: () => void
}

export function TeacherTour({
  tourId,
  steps,
  seenKey,
  autoStart = false,
  autoStartWhen = true,
  onComplete,
  isSeen,
  markSeen,
}: TeacherTourProps) {
  const router = useRouter()
  const [run, setRun] = useState(false)
  const firstStepRef = useRef(false)
  const seen = useMemo(() => isSeen ?? (() => getSeen(seenKey)), [isSeen, seenKey])
  const markAsSeen = useMemo(() => markSeen ?? (() => setSeen(seenKey)), [markSeen, seenKey])

  // Tour theo ngữ cảnh: tự bật khi người dùng chưa xem + điều kiện sẵn sàng.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!autoStart) return
    if (seen()) return
    if (!autoStartWhen) return
    if (firstStepRef.current) return
    const timer = setTimeout(() => {
      firstStepRef.current = true
      setRun(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [autoStart, autoStartWhen, seen])

  // Nút "Hướng dẫn" ở header: mở lại tour của trang hiện tại.
  useEffect(() => {
    if (typeof window === "undefined") return
    const onRestart = () => setRun(true)
    window.addEventListener(RESTART_EVENT, onRestart)
    return () => window.removeEventListener(RESTART_EVENT, onRestart)
  }, [])

  function handleEvent(data: EventData) {
    if (data.type === EVENTS.STEP_AFTER) {
      const navigateTo = (data.step.data as { navigateTo?: string } | undefined)?.navigateTo
      if (navigateTo) {
        markAsSeen()
        setRun(false)
        router.push(navigateTo)
      }
    }
    if (data.type === EVENTS.TOUR_END) {
      setRun(false)
      if (data.status === STATUS.FINISHED) {
        markAsSeen()
        onComplete?.()
      }
    }
  }

  return (
    <Joyride
      key={tourId}
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      locale={tourLocale}
      options={tourOptions}
      onEvent={handleEvent}
    />
  )
}
