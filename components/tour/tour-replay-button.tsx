"use client"

import { Button } from "@/components/ui/button"
import { HelpCircle } from "lucide-react"
import { RESTART_EVENT } from "./tour-store"

export function TourReplayButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(RESTART_EVENT))
        }
      }}
      className="gap-2 px-2 sm:px-3"
      aria-label="Hướng dẫn"
      title="Hướng dẫn"
    >
      <HelpCircle className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">Hướng dẫn</span>
    </Button>
  )
}
