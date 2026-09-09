"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Joyride, EVENTS, type EventData, type Step } from "react-joyride"
import {
  RESTART_EVENT,
  isHintSeen,
  setSeen,
  ROSTER_LIST_SEEN_KEY,
  ROSTER_LEADER_SEEN_KEY,
  ROSTER_NEXT_SEEN_KEY,
} from "./tour-store"
import {
  tourLocale,
  rosterListStep,
  rosterLeaderStep,
  rosterNextStep,
} from "./tour-config"
import { useTourOptions } from "./use-tour-options"

type Stage = "idle" | "list" | "leader" | "next" | "done"

type RosterTourProps = {
  ready: boolean
  hasMembers: boolean
  hasLeader: boolean
}

export function RosterTour({ ready, hasMembers, hasLeader }: RosterTourProps) {
  const [stage, setStage] = useState<Stage>("idle")
  const [run, setRun] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const replayingRef = useRef(false)
  const prevStageRef = useRef<Stage>("idle")
  const tourOptions = useTourOptions()

  useEffect(() => {
    replayingRef.current = replaying
  }, [replaying])

  useEffect(() => {
    if (!ready || replayingRef.current) return
    if (hasLeader) {
      if (!isHintSeen(ROSTER_NEXT_SEEN_KEY)) {
        setSeen(ROSTER_LIST_SEEN_KEY)
        setSeen(ROSTER_LEADER_SEEN_KEY)
        setStage("next")
      } else {
        setStage("done")
      }
      return
    }
    if (hasMembers) {
      if (!isHintSeen(ROSTER_LEADER_SEEN_KEY)) {
        setSeen(ROSTER_LIST_SEEN_KEY)
        setStage("leader")
      } else {
        setStage("done")
      }
      return
    }
    if (!isHintSeen(ROSTER_LIST_SEEN_KEY)) setStage("list")
    else setStage("done")
  }, [ready, hasMembers, hasLeader])

  useEffect(() => {
    if (stage === prevStageRef.current) return
    prevStageRef.current = stage
    if (stage === "list" || stage === "leader" || stage === "next") setRun(true)
  }, [stage])

  useEffect(() => {
    if (typeof window === "undefined") return
    const onRestart = () => {
      setReplaying(true)
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
    if (!replayingRef.current) {
      if (stage === "list") setSeen(ROSTER_LIST_SEEN_KEY)
      else if (stage === "leader") setSeen(ROSTER_LEADER_SEEN_KEY)
      else if (stage === "next") setSeen(ROSTER_NEXT_SEEN_KEY)
    }
    setReplaying(false)
    setStage("done")
  }

  if (stage === "done" || stage === "idle") return null

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
