"use client"

import type { RefObject } from "react"
import { Button } from "@/components/ui/button"
import { PdfPages } from "@/components/pdf-pages"
import { cn } from "@/lib/utils"
import type { SubmissionFile } from "@/lib/types"
import { Download, File as FileIcon, Hand } from "lucide-react"

export function officeEmbed(url: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
}

export type FileViewerProps = {
  file: SubmissionFile
  isImage: boolean
  isPdf: boolean
  isDocx: boolean
  isPptx: boolean
  currentRotation: number
  fileIndex: number
  docxBoxRef: RefObject<HTMLDivElement | null>
  docxLoading: boolean
  docxError: boolean
  annotateLocked: boolean
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
    currentRotation,
    fileIndex,
    docxBoxRef,
    docxLoading,
    docxError,
    annotateLocked,
  } = props

  if (isImage) {
    return (
      <div className="relative p-2">
        <img
          src={file.url || "/placeholder.svg"}
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
          key={`pdf-${fileIndex}-${file.url}`}
          url={file.url}
          name={file.name}
        />
        <div
          className="absolute top-2 right-2 z-20"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Button asChild variant="outline" size="sm" className="gap-1">
            <a href={file.url} target="_blank" rel="noreferrer" download>
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
                src={officeEmbed(file.url)}
                title={file.name}
                className="w-full h-full rounded-md"
                allow="fullscreen"
              />
            </div>
          </div>
        )}
        <div className="absolute top-2 right-2 z-20" onPointerDown={(e) => e.stopPropagation()}>
          <Button asChild variant="outline" size="sm" className="gap-1">
            <a href={file.url} target="_blank" rel="noreferrer" download>
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
      <div className="w-[1000px] h-[78vh] relative mx-auto">
        <iframe
          src={officeEmbed(file.url)}
          title={file.name}
          allow="fullscreen"
          className={cn(
            "w-full h-full rounded-md",
            // Khóa iframe khi đang chấm: chuột không xuyên qua, chỉ đặt dấu
            annotateLocked && "pointer-events-none",
          )}
        />
        {annotateLocked && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-background/90 border shadow px-3 py-1 text-xs text-muted-foreground pointer-events-none max-w-[90%] text-center">
            <Hand className="size-3.5 shrink-0" />
            Dấu gắn theo khung xem (không theo slide) — chuyển slide thì bấm thùng rác để xóa dấu cũ
          </div>
        )}
        <div className="absolute top-2 right-2 z-20" onPointerDown={(e) => e.stopPropagation()}>
          <Button asChild variant="outline" size="sm" className="gap-1">
            <a href={file.url} target="_blank" rel="noreferrer" download>
              <Download className="size-3.5" />
              Tải tệp
            </a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[70vh] gap-3 min-w-[600px]">
      <FileIcon className="size-16 text-muted-foreground" />
      <p className="font-medium">{file.name}</p>
      <Button asChild variant="outline" className="gap-1">
        <a href={file.url} target="_blank" rel="noreferrer" download>
          <Download className="size-4" />
          Tải tệp về để xem
        </a>
      </Button>
    </div>
  )
}
