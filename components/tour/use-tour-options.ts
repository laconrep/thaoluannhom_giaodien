"use client"

import { useEffect, useState } from "react"
import type { Options } from "react-joyride"
import { tourOptions } from "./tour-config"

function readDark() {
  if (typeof document === "undefined") return false
  return document.documentElement.classList.contains("dark")
}

function readWidth() {
  if (typeof window === "undefined") return 380
  return Math.min(380, Math.max(260, window.innerWidth - 24))
}

export function useTourOptions(): Partial<Options> {
  const [dark, setDark] = useState(false)
  const [width, setWidth] = useState(380)

  useEffect(() => {
    const root = document.documentElement
    const sync = () => {
      setDark(readDark())
      setWidth(readWidth())
    }
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ["class"] })
    window.addEventListener("resize", sync)
    return () => {
      obs.disconnect()
      window.removeEventListener("resize", sync)
    }
  }, [])

  return {
    ...tourOptions,
    width,
    disableFocusTrap: true,
    backgroundColor: dark ? "#1c2a2e" : "#ffffff",
    textColor: dark ? "#f4f6f6" : "#1a2b2e",
    arrowColor: dark ? "#1c2a2e" : "#ffffff",
    overlayColor: dark ? "#000000b3" : "#00000080",
    primaryColor: dark ? "#5ec8c4" : "#2a8f8a",
  }
}
