"use client"

import { useEffect, useRef, useState } from "react"
import { Eye, FileText, Loader2, Paperclip, Play, Save, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RichTextEditor } from "@/components/rich-text-editor"
import {
  DurationSettings,
  durationToSeconds,
  type DurationValue,
} from "@/components/timer-panel"
import { PromptView, effectivePromptSource, promptHasText } from "@/components/prompt-view"
import { saveSessionPromptAction, startSessionAction } from "@/app/actions"
import type { SessionRow, SubmissionFile, SubmissionFileKind } from "@/lib/types"

const ACCEPT = ".pdf,.doc,.docx,.txt"

function kindForFile(file: File): SubmissionFileKind {
  const name = file.name.toLowerCase()
  if (name.endsWith(".pdf")) return "pdf"
  if (name.endsWith(".doc") || name.endsWith(".docx")) return "docx"
  return "other"
}

/** Tải 1 file đề lên bucket submissions (thư mục prompts/<sessionId>/) — cùng cơ chế upload bài nộp của HS. */
async function uploadPromptFile(sessionId: string, file: File): Promise<SubmissionFile> {
  try {
    await fetch("/api/storage/ensure-bucket", { method: "POST" })
  } catch {
    // Bỏ qua: lỗi thật sẽ lộ ở bước upload bên dưới.
  }
  const ext = file.name.split(".").pop() ?? "bin"
  const path = `prompts/${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const urlRes = await fetch("/api/submissions/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  })
  const urlBody = await urlRes.json().catch(() => ({}))
  if (!urlRes.ok || !urlBody?.upload?.token) {
    throw new Error(urlBody?.error ?? "Không tạo được đường dẫn tải lên.")
  }
  const uploadUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/submissions/${urlBody.upload.path}?token=${encodeURIComponent(urlBody.upload.token)}`
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    urlBody.upload.token
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file,
  })
  if (!putRes.ok) throw new Error(`Không tải được tệp ${file.name}. Vui lòng thử lại.`)
  const signedRes = await fetch("/api/submissions/signed-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  })
  const signedBody = await signedRes.json().catch(() => ({}))
  if (!signedRes.ok || !signedBody?.signedUrl) {
    throw new Error(signedBody?.error ?? "Không tạo được link tệp.")
  }
  return {
    url: signedBody.signedUrl as string,
    name: file.name,
    kind: kindForFile(file),
    mime: file.type || "application/octet-stream",
    rotation: 0,
  }
}

export function AssignTaskDialog({
  open,
  onOpenChange,
  session,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: SessionRow
}) {
  const [step, setStep] = useState<"edit" | "preview">("edit")
  const [text, setText] = useState("")
  const [fileMeta, setFileMeta] = useState<SubmissionFile | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [source, setSource] = useState<"text" | "file">("text")
  const [duration, setDuration] = useState<DurationValue>({
    unlimited: true,
    minutes: 0,
    seconds: 0,
  })
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Mở popup: nạp lại đề đã lưu (nếu có) + thời lượng hiện tại của phiên.
  useEffect(() => {
    if (!open) return
    setStep("edit")
    setText(session.prompt_text ?? "")
    setFileMeta(session.prompt_file ?? null)
    setPendingFile(null)
    setSource(
      effectivePromptSource(session.prompt_text, session.prompt_file, session.prompt_source) ??
        "text",
    )
    const d = session.duration_seconds ?? 0
    setDuration(
      d <= 0
        ? { unlimited: true, minutes: 0, seconds: 0 }
        : { unlimited: false, minutes: Math.floor(d / 60), seconds: d % 60 },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session.id])

  const hasText = promptHasText(text)
  const shownFile = pendingFile
    ? { name: pendingFile.name, isNew: true }
    : fileMeta
      ? { name: fileMeta.name, isNew: false }
      : null

  async function handleSave() {
    if (!hasText && !pendingFile && !fileMeta) {
      toast.error("Chưa có nội dung đề — hãy gõ/dán nội dung hoặc đính kèm file Word/PDF/TXT.")
      return
    }
    setBusy(true)
    try {
      let finalFile = fileMeta
      if (pendingFile) {
        finalFile = await uploadPromptFile(session.id, pendingFile)
        setFileMeta(finalFile)
        setPendingFile(null)
      }
      const finalText = hasText ? text : null
      const both = !!finalText && !!finalFile
      const finalSource = both ? source : finalFile ? "file" : "text"
      const saved = await saveSessionPromptAction(session.id, {
        text: finalText,
        file: finalFile,
        source: finalSource,
      })
      if (!saved.ok) throw new Error(saved.error ?? "Không lưu được đề bài.")
      setSource(finalSource)
      setStep("preview")
      toast.success("Đã lưu đề — kiểm tra bản xem trước rồi bấm Bắt đầu để giao cho học sinh.")
    } catch (e: any) {
      toast.error(e?.message ?? "Không lưu được đề bài.")
    } finally {
      setBusy(false)
    }
  }

  async function handleStart() {
    setBusy(true)
    try {
      // Lưu lại nguồn đề GV đang chọn ở bản xem trước (khi có cả chữ lẫn file).
      const saved = await saveSessionPromptAction(session.id, {
        text: hasText ? text : null,
        file: fileMeta,
        source,
      })
      if (!saved.ok) throw new Error(saved.error ?? "Không lưu được đề bài.")
      await startSessionAction(session.id, durationToSeconds(duration))
      toast.success("Đã giao bài cho học sinh.")
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message ?? "Không bắt đầu được phiên.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Giao bài — {session.title}</DialogTitle>
          <DialogDescription>
            Soạn đề bằng cách gõ/dán nội dung hoặc đính kèm file Word, PDF, TXT. Học sinh chỉ
            thấy đề sau khi thầy/cô bấm Bắt đầu.
          </DialogDescription>
        </DialogHeader>

        {step === "edit" && (
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
            <div>
              <p className="text-sm font-medium mb-1.5">Nội dung bài tập (gõ hoặc dán vào)</p>
              <RichTextEditor
                value={text}
                onChange={setText}
                allowPaste
                placeholder="Gõ hoặc dán nội dung bài tập vào đây..."
                minHeight={220}
                uploadContext={{ sessionId: session.id, targetId: "prompt" }}
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-1.5">Hoặc đính kèm file đề</p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) setPendingFile(f)
                  e.target.value = ""
                }}
              />
              {shownFile ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <FileText className="size-5 text-primary shrink-0" aria-hidden="true" />
                  <span className="text-sm truncate flex-1">
                    {shownFile.name}
                    {shownFile.isNew && (
                      <span className="text-xs text-muted-foreground"> (chưa tải lên)</span>
                    )}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Đổi file
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Gỡ file đính kèm"
                    onClick={() => {
                      setPendingFile(null)
                      setFileMeta(null)
                    }}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-md border-2 border-dashed border-border bg-muted/20 hover:bg-muted/40 transition p-4 flex items-center justify-center gap-2 text-sm"
                >
                  <Paperclip className="size-4" aria-hidden="true" />
                  Thêm file Word / PDF / TXT
                </button>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">
                Có cả nội dung chữ và file thì ở bước xem trước, thầy/cô chọn một bản để giao
                cho học sinh.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Đóng
              </Button>
              <Button type="button" onClick={handleSave} disabled={busy} className="gap-1">
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                Lưu
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Thanh tiêu đề cố định: set giờ + Bắt đầu/Hủy luôn ở trên cùng khi cuộn xem đề */}
            <div className="shrink-0 rounded-md border bg-card p-2.5 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-heading font-semibold text-sm flex items-center gap-1.5 mr-auto">
                  <Eye className="size-4" aria-hidden="true" />
                  Xem trước đề bài
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setStep("edit")}
                  disabled={busy}
                  className="gap-1"
                >
                  <X className="size-4" aria-hidden="true" />
                  Hủy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleStart}
                  disabled={busy}
                  className="gap-1"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Play className="size-4" aria-hidden="true" />
                  )}
                  Bắt đầu
                </Button>
              </div>
              <DurationSettings value={duration} onChange={setDuration} />
              {hasText && fileMeta && (
                <div className="flex items-center gap-2 flex-wrap rounded-md bg-accent/15 border border-accent/40 px-2.5 py-2">
                  <span className="text-xs">
                    Đề có cả bản chữ và file đính kèm — chọn bản giao cho học sinh:
                  </span>
                  <div className="flex gap-1 ml-auto">
                    <button
                      type="button"
                      onClick={() => setSource("text")}
                      className={`text-xs px-2 py-1 rounded border ${
                        source === "text"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      Bản chữ
                    </button>
                    <button
                      type="button"
                      onClick={() => setSource("file")}
                      className={`text-xs px-2 py-1 rounded border ${
                        source === "file"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      Bản file
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pt-3 min-h-0">
              <PromptView
                text={hasText ? text : null}
                file={fileMeta}
                source={source}
                maxHeight="none"
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
