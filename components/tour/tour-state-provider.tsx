"use client"

import { useState } from "react"
import { markTourSeenAction } from "@/app/tour-actions"
import { hydrateTourSeenState, registerTourSeenPersister } from "./tour-store"

// Đăng ký bộ ghi ngay khi module được nạp (trước mọi useEffect của component con)
// để không bỏ sót lần setSeen đầu tiên.
registerTourSeenPersister((key) => {
  void markTourSeenAction(key)
})

// Hydrate trạng thái tour từ server ngay trong lần render đầu (trước khi các
// component con đọc getSeen), sau đó đẩy mọi thay đổi lên server.
export function TourSeenProvider({
  initialState,
  children,
}: {
  initialState: Record<string, boolean>
  children: React.ReactNode
}) {
  // Lazy initializer chỉ chạy một lần, trước khi component con render.
  useState(() => {
    hydrateTourSeenState(initialState)
    return null
  })

  return <>{children}</>
}
