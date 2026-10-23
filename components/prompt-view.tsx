"use client"

import { useEffect, useState } from "react"
import { FileDown, FileText, Loader2 } from "lucide-react"
import type { SubmissionFile } from "@/lib/types"
import { SubmissionText } from "@/components/submission-text"
import { useFreshFileUrl } from "@/hooks/use-fresh-file-url"
import { isRichTextEmpty } from "@/lib/rich-text"

export function promptHasText(text: string | null | undefined): boolean {
  return !!text && !isRichTextEmpty(text)
}

/** Nguồn đề hiệu lực: GV đã chọn thì theo GV, chưa chọn thì ưu tiên file nếu không có chữ. */
export function effectivePromptSource(
  text: string | null | undefined,
  file: SubmissionFile | null | undefined,
  source: "text" | "file" | null | undefined,
): "text" | "file" | null {
  const hasText = promptHasText(text)
  if (source === "file" && file) return "file"
  if (source === "text" && hasText) return "text"
  if (file && !hasText) return "file"
  if (hasText) return "text"
  if (file) return "file"
  return null
}

function officeEmbedUrl(url: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
}

function isTxtFile(file: SubmissionFile) {
  return file.mime === "text/plain" || /\.txt$/i.test(file.name)
}

function PromptFileView({ file }: { file: SubmissionFile }) {
  const freshUrl = useFreshFileUrl(file.url)
  const [txt, setTxt] = useState<string | null>(null)
  const [txtFailed, setTxtFailed] = useState(false)
  const txtFile = isTxtFile(file)

  useEffect(() => {
    if (!txtFile || !freshUrl) return
    let cancelled = false
    fetch(freshUrl)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.text()
      })
      .then((t) => {
        if (!cancelled) setTxt(t)
      })
      .catch(() => {
        if (!cancelled) setTxtFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [txtFile, freshUrl])

  if (!freshUrl) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Đang tải file đề…
      </div>
    )
  }

  if (file.kind === "pdf") {
    return <iframe src={freshUrl} title={file.name} className="w-full h-[55vh] border-0" />
  }

  if (file.kind === "docx") {
    return (
      <iframe
        src={officeEmbedUrl(freshUrl)}
        title={file.name}
        className="w-full h-[55vh] border-0"
      />
    )
  }

  if (txtFile) {
    if (txt !== null) {
      return (
        <pre className="whitespace-pre-wrap break-words font-sans text-base leading-relaxed p-4">
          {txt}
        </pre>
      )
    }
    if (!txtFailed) {
      return (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Đang tải nội dung file…
        </div>
      )
    }
  }

  return (
    <div className="p-4 flex items-center gap-3">
      <FileText className="size-8 text-primary shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <a
          href={freshUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          <FileDown className="size-4" aria-hidden="true" />
          Mở / tải file đề
        </a>
      </div>
    </div>
  )
}

/**
 * Khung hiện đề bài: co dãn theo độ dài nội dung, cao tối đa maxHeight
 * thì cuộn bên trong khung (dùng cho cả preview của GV và màn hình HS).
 */
export function PromptView({
  text,
  file,
  source,
  maxHeight = "62vh",
}: {
  text: string | null | undefined
  file: SubmissionFile | null | undefined
  source?: "text" | "file" | null | undefined
  maxHeight?: string
}) {
  const effective = effectivePromptSource(text, file, source)
  if (!effective) {
    return (
      <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
        Chưa có nội dung đề.
      </div>
    )
  }
  return (
    <div
      className="overflow-y-auto rounded-md border bg-background"
      style={{ maxHeight }}
    >
      {effective === "text" ? (
        <div className="p-4">
          <SubmissionText value={text ?? ""} />
        </div>
      ) : file ? (
        <PromptFileView file={file} />
      ) : null}
    </div>
  )
}
