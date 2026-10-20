"use client"

import { useEffect, useState } from "react"

// Link Canva HS dán thường là link rút gọn — phải qua /api/canva/resolve để
// đổi thành URL nhúng chuẩn rồi mới cho vào iframe. Cache theo link gốc trong
// phiên làm việc để chuyển file qua lại không gọi API lại.
// Lỗi resolve → trả về chính link gốc (iframe vẫn thử hiện; Canva có thể chặn
// nhúng link chưa chuẩn hoá, khi đó GV dùng nút "Mở Canva gốc").
const cache = new Map<string, string>()

export function useCanvaEmbedUrl(
  rawUrl: string | undefined,
): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() =>
    rawUrl ? cache.get(rawUrl) : undefined,
  )

  useEffect(() => {
    if (!rawUrl) {
      setUrl(undefined)
      return
    }
    const hit = cache.get(rawUrl)
    if (hit) {
      setUrl(hit)
      return
    }
    let cancelled = false
    setUrl(undefined)
    fetch("/api/canva/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: rawUrl }),
    })
      .then((r) => r.json())
      .then((b) => {
        if (cancelled) return
        const embed =
          b?.ok && b.embedUrl ? (b.embedUrl as string) : rawUrl
        cache.set(rawUrl, embed)
        setUrl(embed)
      })
      .catch(() => {
        if (!cancelled) setUrl(rawUrl)
      })
    return () => {
      cancelled = true
    }
  }, [rawUrl])

  return url
}
