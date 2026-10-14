"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"

// Chiều rộng CSS chuẩn cho mọi trang (chuẩn hóa để tọa độ annotation nhất quán).
const PAGE_CSS_WIDTH = 800
// Render gấp đôi để chữ nét trên màn hình độ phân giải cao.
const RENDER_SCALE = 2

/**
 * Render toàn bộ trang PDF thành canvas xếp dọc trong luồng tài liệu.
 * Annotation phủ lên toàn bộ khối này nên dấu bám theo từng trang khi cuộn,
 * giống luồng Word/ảnh.
 */
export function PdfPages({ url, name }: { url: string; name: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [numPages, setNumPages] = useState(0)

  useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    setLoading(true)
    setError(false)
    setNumPages(0)
    if (container) container.replaceChildren()

    ;(async () => {
      try {
        // Dynamic import để pdfjs chỉ load trên trình duyệt, tránh lỗi SSR.
        const pdfjs = await import("pdfjs-dist")
        // Worker tự host trong public/ để đúng version với pdfjs-dist đã cài.
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
        const res = await fetch(url)
        if (!res.ok) throw new Error("Không tải được PDF")
        const data = await res.arrayBuffer()
        if (cancelled) return
        const loadingTask = pdfjs.getDocument({ data })
        const pdf = await loadingTask.promise
        if (cancelled) {
          await loadingTask.destroy()
          return
        }
        setNumPages(pdf.numPages)
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) break
          const page = await pdf.getPage(i)
          if (cancelled) break
          const base = page.getViewport({ scale: 1 })
          const cssScale = PAGE_CSS_WIDTH / base.width
          const viewport = page.getViewport({ scale: cssScale * RENDER_SCALE })
          const canvas = document.createElement("canvas")
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          canvas.style.width = `${PAGE_CSS_WIDTH}px`
          canvas.style.height = "auto"
          canvas.style.display = "block"
          canvas.style.margin = "0 auto 16px auto"
          canvas.style.background = "#fff"
          canvas.style.borderRadius = "4px"
          canvas.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)"
          canvas.dataset.pdfPage = String(i)
          container?.appendChild(canvas)
          await page.render({ canvas, viewport }).promise
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      container?.replaceChildren()
    }
  }, [url])

  if (error) {
    // Fallback: giữ cách xem cũ bằng iframe khi render thất bại.
    return (
      <div className="w-[1000px] h-[78vh] relative mx-auto">
        <iframe src={url} title={name} className="w-full h-full rounded-md" />
        <div className="absolute top-2 right-2">
          <Button asChild variant="outline" size="sm" className="gap-1">
            <a href={url} target="_blank" rel="noreferrer" download>
              <Download className="size-3.5" />
              Tải PDF
            </a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full py-2">
      {loading && (
        <p className="py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Đang mở PDF{numPages > 0 ? ` (${numPages} trang)` : ""}…
        </p>
      )}
      <div ref={containerRef} className="w-full" />
    </div>
  )
}
