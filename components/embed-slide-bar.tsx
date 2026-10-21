"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Thanh chon slide/trang cho file nhung (PowerPoint qua Office viewer, Canva).
// App dung thanh nay RA LENH cho khung xem lat slide (PPTX: wdSlideIndex,
// Canva: #N) va doi bo dau cung luc — dau cham duoc luu rieng theo tung slide.
export function EmbedSlideBar({
  slide,
  onSlide,
  counts,
  noun,
  verb,
}: {
  slide: number
  onSlide: (n: number) => void
  /** So dau tren tung slide cua file hien tai. */
  counts: Map<number, number>
  /** "Slide" (PowerPoint) hoac "Trang" (Canva). */
  noun: string
  /** "đang chấm" (khung cham) hoac "đang xem" (trang ket qua). */
  verb: string
}) {
  const [draft, setDraft] = useState(String(slide))
  useEffect(() => {
    setDraft(String(slide))
  }, [slide])

  const commit = () => {
    const n = parseInt(draft, 10)
    if (Number.isFinite(n) && n >= 1) onSlide(n)
    else setDraft(String(slide))
  }
  const marked = Array.from(counts.entries())
    .filter(([, c]) => c > 0)
    .map(([n]) => n)
    .sort((a, b) => a - b)
  const curCount = counts.get(slide) ?? 0

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-[13px] shadow-sm">
      {/* Tất cả trên MỘT hàng ngang cho thanh mỏng, nhường chỗ cho bài chấm. */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="font-medium text-teal-900">
          {noun} {verb}:
        </span>
        <button
          type="button"
          onClick={() => onSlide(Math.max(1, slide - 1))}
          disabled={slide <= 1}
          className="rounded-md border border-teal-300 bg-white p-0.5 text-teal-800 hover:bg-teal-100 disabled:opacity-40"
          aria-label={`${noun} trước`}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
          }}
          inputMode="numeric"
          className="w-12 rounded-md border border-teal-300 bg-white px-1 py-0 text-center font-semibold text-teal-900"
          aria-label={`Số ${noun.toLowerCase()}`}
        />
        <button
          type="button"
          onClick={() => onSlide(slide + 1)}
          className="rounded-md border border-teal-300 bg-white p-0.5 text-teal-800 hover:bg-teal-100"
          aria-label={`${noun} tiếp`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <span className="text-teal-800">
          • {noun} này: <strong>{curCount} dấu</strong>
        </span>
        {marked.length > 0 && (
          <span className="flex flex-wrap items-center gap-1 text-[11px] text-teal-800">
            <span className="text-teal-300">|</span>
            <span>Đã có dấu ở {noun.toLowerCase()}:</span>
            {marked.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onSlide(n)}
                className={`rounded-full px-1.5 py-0 font-medium ${
                  n === slide
                    ? "bg-teal-600 text-white"
                    : "bg-white text-teal-800 ring-1 ring-teal-300 hover:bg-teal-100"
                }`}
              >
                {n}
              </button>
            ))}
            <span className="text-teal-600">(bấm số để nhảy tới)</span>
          </span>
        )}
      </div>
    </div>
  )
}
