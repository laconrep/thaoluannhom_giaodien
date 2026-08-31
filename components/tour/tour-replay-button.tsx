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
      className="gap-2"
    >
      <HelpCircle className="size-4" aria-hidden="true" />
      Hướng dẫn
    </Button>
  )
}
