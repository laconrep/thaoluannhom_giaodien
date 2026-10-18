import { useCallback, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { AnnotationItem, AnnotationRow } from "@/lib/types"

/**
 * Tải lười cột `data` (nét vẽ, nặng) của annotation.
 *
 * Trang chỉ select annotation KHÔNG kèm `data`; khi giáo viên mở editor chấm bài,
 * gọi `ensureData(ann)` để tải riêng 1 query. Kết quả cache theo annotation id.
 *
 * An toàn dữ liệu (T3.3):
 * - Nếu realtime đã giao hàng mới (ann.data có sẵn) thì dùng luôn, không fetch.
 * - Nếu trong lúc fetch có bản realtime mới hơn (updated_at đổi) thì bỏ kết quả
 *   fetch, giữ bản realtime — không bao giờ ghi đè nét vẽ mới bằng bản cũ.
 */
export function useLazyAnnotationData() {
  const [cache, setCache] = useState<Record<string, AnnotationItem[]>>({})
  const loadingRef = useRef<Record<string, boolean>>({})

  const ensureData = useCallback((ann: Pick<AnnotationRow, "id" | "updated_at"> & { data?: AnnotationItem[] | null } | null | undefined) => {
    if (!ann || ann.data !== undefined || loadingRef.current[ann.id]) return
    loadingRef.current[ann.id] = true
    const startedAt = ann.updated_at
    const annId = ann.id
    createClient()
      .from("annotations")
      .select("data, updated_at")
      .eq("id", annId)
      .single()
      .then(({ data }: { data: { data: AnnotationItem[] | null; updated_at: string } | null }) => {
        // Có bản mới hơn đến trong lúc tải (vd máy khác vừa lưu) → giữ bản mới, bỏ bản này.
        if (!data || data.updated_at !== startedAt) return
        const items: AnnotationItem[] = data.data ?? []
        setCache((m) => (m[annId] !== undefined ? m : { ...m, [annId]: items }))
      })
      .catch(() => {
        // Lỗi mạng: lần mở sau thử lại (loadingRef đã reset ở finally).
      })
      .finally(() => {
        loadingRef.current[annId] = false
      })
  }, [])

  /** Nét vẽ để đưa vào editor: ưu tiên data có sẵn (realtime), sau đó là cache. */
  const dataFor = useCallback(
    (ann: { id: string; data?: AnnotationItem[] | null } | null | undefined): AnnotationItem[] => {
      if (!ann) return []
      if (ann.data !== undefined && ann.data !== null) return ann.data
      return cache[ann.id] ?? []
    },
    [cache],
  )

  /** true = editor được phép vẽ + lưu (không có gì phải chờ, hoặc đã tải xong). */
  const isReady = useCallback(
    (ann: { id: string; data?: AnnotationItem[] | null } | null | undefined): boolean => {
      if (!ann) return true
      if (ann.data !== undefined && ann.data !== null) return true
      return cache[ann.id] !== undefined
    },
    [cache],
  )

  return { ensureData, dataFor, isReady }
}
