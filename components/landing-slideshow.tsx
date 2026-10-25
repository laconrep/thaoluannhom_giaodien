"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

type Slide =
  | { type: "video"; src: string; poster: string; caption: string }
  | { type: "image"; src: string; caption: string }

// Demo thật từ app: clip trình chiếu + drawer phiên, popup AI chia barem,
// dialog giao bài, bảng bài làm HS (tên HS đã che).
const SLIDES: Slide[] = [
  {
    type: "video",
    src: "/landing/slideshow/video-03.mp4",
    poster: "/landing/slideshow/video-03-poster.jpg",
    caption: "Trình chiếu + drawer phiên ngay trên PowerPoint",
  },
  {
    type: "image",
    src: "/landing/slideshow/barem.jpg",
    caption: "AI chia barem từ đáp án mẫu",
  },
  {
    type: "image",
    src: "/landing/slideshow/giao-bai.jpg",
    caption: "Giao bài tập về nhà kèm file",
  },
  {
    type: "image",
    src: "/landing/slideshow/bai-lam.jpg",
    caption: "Bài làm học sinh nộp về",
  },
]

export function LandingSlideshow() {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]
  const isVideo = slide.type === "video"

  const next = () => setIndex((i) => (i + 1) % SLIDES.length)
  const prev = () => setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length)

  // Ảnh tự chuyển mỗi 6s; slide video thì để clip chạy hết rồi mới chuyển.
  useEffect(() => {
    if (isVideo) return
    const t = setInterval(next, 6000)
    return () => clearInterval(t)
  }, [index, isVideo])

  return (
    <div className="rounded-3xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 p-[1.5px] shadow-[0_0_36px_rgba(59,130,246,0.30)]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[calc(1.5rem-1.5px)] bg-slate-950">
        {slide.type === "video" ? (
          <video
            key={slide.src}
            src={slide.src}
            poster={slide.poster}
            autoPlay
            muted
            playsInline
            onEnded={next}
            ref={(el) => {
              if (el) el.muted = true
            }}
            className="h-full w-full object-contain"
          />
        ) : (
          <img
            key={slide.src}
            src={slide.src}
            alt={slide.caption}
            className="h-full w-full object-contain"
          />
        )}

        <button
          type="button"
          onClick={prev}
          aria-label="Ảnh trước"
          className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-black/70"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Ảnh sau"
          className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-black/70"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>

        <span className="absolute bottom-3 left-3 max-w-[70%] rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
          {slide.caption}
        </span>
        <span className="absolute bottom-3 right-3 flex gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.caption}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Chuyển tới ảnh ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </span>
      </div>
    </div>
  )
}
