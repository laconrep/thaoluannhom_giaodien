"use client"

import { useEffect, useState } from "react"
import { parseB2Url, parseSignUrl } from "@/lib/file-url"

// Signed URL lưu trong DB có hạn 7 ngày — mở chấm sau hạn là ảnh vỡ.
// Hook đổi URL ký cũ lấy URL mới qua API; URL thường giữ nguyên.
// Khi đang chờ cấp mới, trả về undefined để UI hiện placeholder thay vì ảnh vỡ.
//
// Từ 24/10/2026 route ký trả URL B2: URL B2 hết hạn cũng được đổi mới qua
// cùng route (tách path từ URL B2, bucket logic luôn là "submissions" vì
// mọi chỗ dùng hook này đều là file bài nộp / file đề prompts/ — bài giảng
// presentations có viewer riêng gọi route với bucket "presentations").
// URL Supabase cũ trong DB vẫn đổi được: tách path từ URL cũ, route ký mới
// trả URL B2 cho cùng object key (key giữ nguyên khi di dời sang B2).
export function useFreshFileUrl(rawUrl: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() =>
    parseSignUrl(rawUrl) || parseB2Url(rawUrl) ? undefined : rawUrl,
  )

  useEffect(() => {
    const parsed = parseSignUrl(rawUrl)
    const b2 = !parsed ? parseB2Url(rawUrl) : null
    if (!parsed && !b2) {
      setUrl(rawUrl)
      return
    }
    let cancelled = false
    setUrl(undefined)
    fetch("/api/submissions/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: parsed ? parsed.path : b2!.path,
        bucket: parsed ? parsed.bucket : "submissions",
      }),
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
