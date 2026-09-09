"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Joyride, EVENTS, STATUS, type EventData, type Step } from "react-joyride"
import {
  isHintSeen,
  setSeen,
  RESTART_EVENT,
  PRESENTATION_EDGE_SEEN_KEY,
  PRESENTATION_DRAWER_SEEN_KEY,
  PRESENTATION_ALL_SESSIONS_SEEN_KEY,
  PRESENTATION_CREATE_SESSION_SEEN_KEY,
} from "./tour-store"
import {
  tourLocale,
  presentationEdgeStep,
  presentationTimerStep,
  presentationQrStep,
  presentationAllSessionsStep,
  presentationCreateSessionStep,
} from "./tour-config"
import { useTourOptions } from "./use-tour-options"

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
  const replayingRef = useRef(false)
  const tourOptions = useTourOptions()

  useEffect(() => {
    replayingRef.current = replaying
  }, [replaying])

  useEffect(() => {
    if (replayingRef.current) return
    if (!active) {
      setRun(false)
      setStage("idle")
      return
    }

    if (sessionPickerOpen && !createSessionOpen) {
      setSeen(PRESENTATION_EDGE_SEEN_KEY)
      setSeen(PRESENTATION_ALL_SESSIONS_SEEN_KEY)
      if (!isHintSeen(PRESENTATION_CREATE_SESSION_SEEN_KEY)) setStage("create-session")
      else setStage("done")
      return
    }

    if (createSessionOpen) {
      setSeen(PRESENTATION_CREATE_SESSION_SEEN_KEY)
      setStage("done")
      return
    }

    if (drawerOpen) {
      setSeen(PRESENTATION_EDGE_SEEN_KEY)
      if (!isHintSeen(PRESENTATION_DRAWER_SEEN_KEY)) setStage("drawer")
      else if (!isHintSeen(PRESENTATION_ALL_SESSIONS_SEEN_KEY)) setStage("all-sessions")
      else setStage("done")
      return
    }

    if (!isHintSeen(PRESENTATION_EDGE_SEEN_KEY)) setStage("edge")
    else setStage("done")
  }, [active, drawerOpen, sessionPickerOpen, createSessionOpen])

  useEffect(() => {
    if (typeof window === "undefined") return
    const onRestart = () => {
      if (!active) return
      setReplaying(true)
      if (sessionPickerOpen) setStage("create-session")
      else if (drawerOpen) setStage("drawer")
      else setStage("edge")
      setRun(false)
      window.setTimeout(() => setRun(true), 120)
    }
    window.addEventListener(RESTART_EVENT, onRestart)
    return () => window.removeEventListener(RESTART_EVENT, onRestart)
  }, [active, drawerOpen, sessionPickerOpen])

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
    if (stage === "idle" || stage === "done") {
      setRun(false)
      return
    }
    let shouldRun = false
    if (stage === "edge") shouldRun = active && !drawerOpen
    else if (stage === "drawer") shouldRun = drawerOpen
    else if (stage === "all-sessions") shouldRun = drawerOpen && !sessionPickerOpen
    else if (stage === "create-session") shouldRun = sessionPickerOpen
    setRun(shouldRun)
  }, [stage, active, drawerOpen, sessionPickerOpen])

  function handleEvent(data: EventData) {
    if (data.type !== EVENTS.TOUR_END) return
    setRun(false)
    if (!replayingRef.current) {
      if (stage === "edge") setSeen(PRESENTATION_EDGE_SEEN_KEY)
      else if (stage === "drawer") setSeen(PRESENTATION_DRAWER_SEEN_KEY)
      else if (stage === "all-sessions") setSeen(PRESENTATION_ALL_SESSIONS_SEEN_KEY)
      else if (stage === "create-session") setSeen(PRESENTATION_CREATE_SESSION_SEEN_KEY)
    }

    if (stage === "drawer" && data.status !== STATUS.SKIPPED) {
      setStage("all-sessions")
      return
    }
    setReplaying(false)
    setStage("done")
  }

  if (stage === "done" || stage === "idle") return null

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
