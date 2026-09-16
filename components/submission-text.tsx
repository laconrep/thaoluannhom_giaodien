"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { isHtmlContent, sanitizeSubmissionHtml, toPlainText } from "@/lib/rich-text"

type SubmissionTextProps = {
  value: string | null | undefined
  className?: string
  /** Chỉ hiển thị văn bản thuần, bỏ bảng/ảnh — dùng cho chỗ hiển thị nhỏ. */
  plain?: boolean
  /** Cắt bớt theo số ký tự, chỉ áp dụng khi hiển thị thuần. */
  maxChars?: number
  /** Hiển thị khi không có nội dung (mặc định không render gì). */
  fallback?: React.ReactNode
}

// Render nội dung bài nộp cho cả 2 dạng lưu trữ:
//  - HTML (bài mới, có bảng/ảnh): sanitize rồi render.
//  - Plain text (bài cũ): giữ nguyên xuống dòng như trước đây.
export function SubmissionText({
  value,
  className,
  plain = false,
  maxChars,
  fallback = null,
}: SubmissionTextProps) {
  const raw = value ?? ""
  const isHtml = useMemo(() => isHtmlContent(raw), [raw])
  const html = useMemo(() => (isHtml ? sanitizeSubmissionHtml(raw) : ""), [isHtml, raw])

  if (!raw.trim()) return <>{fallback}</>

  if (plain) {
    const text = maxChars ? toPlainText(raw).slice(0, maxChars) : toPlainText(raw)
    return <div className={cn("whitespace-pre-wrap", className)}>{text}</div>
  }

  if (!isHtml) {
    return <div className={cn("whitespace-pre-wrap", className)}>{raw}</div>
  }

  return (
    <div
      className={cn("submission-rich-text", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
