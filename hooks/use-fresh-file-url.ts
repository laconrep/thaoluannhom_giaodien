"use client"

import { useEffect, useState } from "react"
import { parseSignUrl } from "@/lib/file-url"

// Signed URL lưu trong DB có hạn 7 ngày — mở chấm sau hạn là ảnh vỡ.
// Hook đổi URL ký cũ lấy URL mới qua API; URL thường giữ nguyên.
// Khi đang chờ cấp mới, trả về undefined để UI hiện placeholder thay vì ảnh vỡ.
export function useFreshFileUrl(rawUrl: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() =>
    parseSignUrl(rawUrl) ? undefined : rawUrl,
  )

  useEffect(() => {
    const parsed = parseSignUrl(rawUrl)
    if (!parsed) {
      setUrl(rawUrl)
      return
    }
    let cancelled = false
    setUrl(undefined)
    fetch("/api/submissions/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: parsed.path, bucket: parsed.bucket }),
    })
      .then((r) => r.json())
      .then((b) => {
        if (cancelled) return
        // Cấp mới thất bại (mạng/lỗi) → dùng URL gốc, còn hơn trắng trang.
        setUrl(b?.ok && b.signedUrl ? (b.signedUrl as string) : rawUrl)
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
