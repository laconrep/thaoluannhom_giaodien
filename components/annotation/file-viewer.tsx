"use client"

import { useEffect, useState, type RefObject } from "react"
import { Button } from "@/components/ui/button"
import { PdfPages } from "@/components/pdf-pages"
import { cn } from "@/lib/utils"
import type { SubmissionFile } from "@/lib/types"
import { Download, File as FileIcon, Loader2 } from "lucide-react"
import { useFreshFileUrl } from "@/hooks/use-fresh-file-url"
import { useCanvaEmbedUrl } from "@/hooks/use-canva-embed-url"
import { isB2Url, isSignUrl } from "@/lib/file-url"

export function officeEmbed(url: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
}

/**
 * PowerPoint qua Office viewer: mỗi số slide là 1 URL khác nhau — đổi URL là
 * trình xem khởi động lại từ đầu, máy yếu phải chờ lâu như quét lại file.
 * Vá bằng "hồ khung": luôn nạp sẵn slide hiện tại + slide kề trước/sau vào
 * các iframe xếp chồng (khung kề để ẩn bằng visibility, vẫn nạp bình thường);
 * lật slide chỉ đổi khung nào đang hiện → TỨC THÌ, không nạp gì lúc lật.
 * Nhảy xa (bấm chip số slide) thì slide đích nạp mới 1 lần, các slide kề nó
 * lại được nạp ngầm ngay sau đó.
 */
function PptxSlidePool({
  src,
  name,
  slide,
  annotateLocked,
}: {
  src: string
  name: string
  slide: number
  annotateLocked: boolean
}) {
  const [mounted, setMounted] = useState<number[]>(() => [slide])
  useEffect(() => {
    setMounted((cur) => {
      const want = [slide - 1, slide, slide + 1].filter((n) => n >= 1)
      const kept = cur.filter((n) => want.includes(n))
      const merged = Array.from(new Set([...kept, ...want])).sort(
        (a, b) => a - b,
      )
      return merged.join() === cur.join() ? cur : merged
    })
  }, [slide])

  return (
    <div className="w-[1000px] h-[78vh] relative mx-auto">
      {mounted.map((n) => (
        <iframe
          key={n}
          src={`${officeEmbed(src)}&wdSlideIndex=${n}`}
          title={name}
          allow="fullscreen"
          aria-hidden={n !== slide}
          className={cn(
            "absolute inset-0 w-full h-full rounded-md",
            // Khóa iframe khi đang chấm: chuột không xuyên qua, chỉ đặt dấu
            annotateLocked && "pointer-events-none",
          )}
          style={{ visibility: n === slide ? "visible" : "hidden" }}
        />
      ))}
      <div
        className="absolute top-2 right-2 z-20"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Button asChild variant="outline" size="sm" className="gap-1">
          <a href={src} target="_blank" rel="noreferrer" download>
            <Download className="size-3.5" />
            Tải tệp
          </a>
        </Button>
      </div>
    </div>
  )
}

export type FileViewerProps = {
  file: SubmissionFile
  isImage: boolean
  isPdf: boolean
  isDocx: boolean
  isPptx: boolean
  isCanva: boolean
  currentRotation: number
  fileIndex: number
  docxBoxRef: RefObject<HTMLDivElement | null>
  docxLoading: boolean
  docxError: boolean
  annotateLocked: boolean
  /** Slide/trang hiện tại cho file nhúng (PPTX/Canva) — app ra lệnh khung xem
   * mở đúng slide này (PPTX: wdSlideIndex, Canva: #N) để dấu theo đúng slide. */
  slide?: number
}

/**
 * Render nội dung file bài nộp theo từng loại.
 * LƯU Ý: ảnh bài chấm giữ thẻ <img> thay vì next/image vì tọa độ annotation
 * được tính theo kích thước tự nhiên của ảnh — next/image can thiệp layout
 * sẽ làm lệch dấu chấm.
 */
export function FileViewer(props: FileViewerProps) {
  const {
    file,
    isImage,
    isPdf,
    isDocx,
    isPptx,
    isCanva,
    currentRotation,
    fileIndex,
    docxBoxRef,
    docxLoading,
    docxError,
    annotateLocked,
    slide = 1,
  } = props

  // Signed URL lưu trong DB hết hạn sau 7 ngày → đổi lấy URL mới trước khi hiện,
  // tránh ảnh vỡ khi chấm bài cũ. Áp dụng cả URL Supabase cũ lẫn URL B2 mới.
  const freshUrl = useFreshFileUrl(file.url)
  const refreshing = (isSignUrl(file.url) || isB2Url(file.url)) && !freshUrl
  const src = freshUrl ?? file.url

  // Bài Canva: đổi link HS dán thành URL nhúng chuẩn rồi mới hiện iframe.
  const canvaEmbedUrl = useCanvaEmbedUrl(isCanva ? file.url : undefined)

  if (isCanva) {
    if (!canvaEmbedUrl) {
      return (
        <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Đang tải bài Canva…
        </div>
      )
    }
    return (
      <div className="w-[1000px] h-[78vh] relative mx-auto">
        <iframe
          src={`${canvaEmbedUrl}#${slide}`}
          title={file.name}
          allow="fullscreen"
          className={cn(
            "w-full h-full rounded-md border bg-white",
            // Khóa iframe khi đang chấm (giống PPTX): chuột chỉ để đặt dấu.
            annotateLocked && "pointer-events-none",
          )}
        />
        <div className="absolute top-2 right-2 z-20" onPointerDown={(e) => e.stopPropagation()}>
          <Button asChild variant="outline" size="sm" className="gap-1">
            <a href={file.url} target="_blank" rel="noreferrer">
              Mở Canva gốc
            </a>
          </Button>
        </div>
      </div>
    )
  }

  if (refreshing) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Đang tải bài nộp…
      </div>
    )
  }

  if (isImage) {
    return (
      <div className="relative p-2">
        <img
          src={src || "/placeholder.svg"}
          alt={file.name}
          className="block max-w-[1200px] w-auto rounded-md pointer-events-none mx-auto"
          crossOrigin="anonymous"
          style={{ transform: `rotate(${currentRotation}deg)`, maxHeight: "80vh" }}
        />
      </div>
    )
  }

  if (isPdf) {
    return (
      <div className="w-full relative">
        <PdfPages
          key={`pdf-${fileIndex}-${src}`}
          url={src}
          name={file.name}
        />
        <div
          className="absolute top-2 right-2 z-20"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Button asChild variant="outline" size="sm" className="gap-1">
            <a href={src} target="_blank" rel="noreferrer" download>
              <Download className="size-3.5" />
              Tải PDF
            </a>
          </Button>
        </div>
      </div>
    )
  }

  if (isDocx) {
    return (
      <div id="docx-root" className="w-full">
        <div ref={docxBoxRef} />
        {docxLoading && !docxError && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Đang tải tệp Word...
          </p>
        )}
        {docxError && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
            <p className="text-sm text-muted-foreground">
              Không đọc được tệp .docx, mở qua trình xem của Office.
            </p>
            <div className="w-full h-[78vh]">
              <iframe
                src={officeEmbed(src)}
                title={file.name}
                className="w-full h-full rounded-md"
                allow="fullscreen"
              />
            </div>
          </div>
        )}
        <div className="absolute top-2 right-2 z-20" onPointerDown={(e) => e.stopPropagation()}>
          <Button asChild variant="outline" size="sm" className="gap-1">
            <a href={src} target="_blank" rel="noreferrer" download>
              <Download className="size-3.5" />
              Tải tệp
            </a>
          </Button>
        </div>
      </div>
    )
  }

  if (isPptx) {
    return (
      <PptxSlidePool
        key={src}
        src={src}
        name={file.name}
        slide={slide}
        annotateLocked={annotateLocked}
      />
    )
  }

  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[70vh] gap-3 min-w-[600px]">
      <FileIcon className="size-16 text-muted-foreground" />
      <p className="font-medium">{file.name}</p>
      <Button asChild variant="outline" className="gap-1">
        <a href={src} target="_blank" rel="noreferrer" download>
          <Download className="size-4" />
          Tải tệp về để xem
        </a>
      </Button>
    </div>
  )
}
