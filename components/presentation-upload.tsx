"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Presentation, Upload, X } from "lucide-react"
import { toast } from "sonner"
import {
  MAX_PRESENTATION_BYTES,
  formatMegabytes,
  friendlyStorageError,
  powerpointContentType,
  resolveSignedUploadUrl,
} from "@/lib/storage-upload"

type SignedSlot = {
  path: string
  token: string
  signedUrl?: string
}

function parseStorageError(status: number, body: string): string {
  try {
    const json = JSON.parse(body) as { message?: string; error?: string; statusCode?: string }
    const msg = json.message || json.error
    if (msg) return msg
  } catch {
    /* ignore */
  }
  if (body) return body.slice(0, 300)
  return `HTTP ${status}`
}

function storageAuthHeaders(): Record<string, string> {
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ""
  if (!anonKey) return {}
  return {
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
  }
}

function xhrPut(
  url: string,
  body: XMLHttpRequestBodyInit,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.timeout = 0
    Object.entries(headers).forEach(([key, value]) => {
      if (value) xhr.setRequestHeader(key, value)
    })
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return
      onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve()
        return
      }
      const err = new Error(
        `Không tải được file lên kho lưu trữ: ${parseStorageError(xhr.status, xhr.responseText)}`,
      ) as Error & { status?: number }
      err.status = xhr.status
      reject(err)
    }
    xhr.onerror = () => reject(new Error("Không tải được file lên kho lưu trữ."))
    xhr.onabort = () => reject(new Error("Đã hủy tải lên."))
    xhr.ontimeout = () => reject(new Error("Tải lên quá hạn."))
    xhr.send(body)
  })
}

async function fetchSignedSlot(sessionId: string): Promise<SignedSlot> {
  const response = await fetch("/api/presentations/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.upload?.token || !data?.upload?.path) {
    throw new Error(data?.error || "Không tạo được đường dẫn tải lên kho lưu trữ.")
  }
  return {
    path: data.upload.path,
    token: data.upload.token,
    signedUrl: data.upload.signedUrl,
  }
}

async function uploadToStorage(slot: SignedSlot, file: File, onProgress: (percent: number) => void) {
  const uploadUrl = resolveSignedUploadUrl(slot.signedUrl, slot.path, slot.token)
  if (!uploadUrl) {
    throw new Error("Không tạo được đường dẫn tải lên kho lưu trữ.")
  }
  await xhrPut(
    uploadUrl,
    file,
    {
      ...storageAuthHeaders(),
      "Content-Type": powerpointContentType(file.name, file.type),
      "x-upsert": "true",
    },
    onProgress,
  )
}

async function registerPresentation(opts: {
  sessionId: string
  file: File
  storagePath: string
}) {
  const response = await fetch("/api/presentations/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: opts.sessionId,
      fileName: opts.file.name,
      fileSize: opts.file.size,
      fileType: powerpointContentType(opts.file.name, opts.file.type),
      storagePath: opts.storagePath,
    }),
  })
  if (!response.ok) {
    let error: string
    try {
      const errorData = await response.json()
      error = errorData.error || `Upload failed with status ${response.status}`
    } catch {
      error = `Upload failed with status ${response.status}`
    }
    throw new Error(error)
  }
  const data = await response.json()
  if (!data?.presentation) {
    throw new Error("Không lưu được thông tin bài trình chiếu.")
  }
  return data.presentation
}

function UploadProgressRing({ percent }: { percent: number }) {
  const size = 56
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className="relative mx-auto mb-2 size-14" aria-label={`Đang tải lên ${percent}%`}>
      <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-primary"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums">
        {percent}%
      </span>
    </div>
  )
}

export function PresentationUpload({
  sessionId,
  onUploadSuccess,
}: {
  sessionId: string
  onUploadSuccess: (presentation: any) => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadingName, setUploadingName] = useState<string | null>(null)
  const [presentation, setPresentation] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const slotRef = useRef<Promise<SignedSlot> | null>(null)

  function prefetchSlot() {
    slotRef.current = fetchSignedSlot(sessionId).catch((error) => {
      slotRef.current = null
      throw error
    })
    return slotRef.current
  }

  useEffect(() => {
    prefetchSlot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const handleFileSelect = async (file: File) => {
    if (!/\.pptx?$/i.test(file.name)) {
      toast.error("Chỉ hỗ trợ file PowerPoint (.ppt hoặc .pptx)")
      return
    }
    if (file.size === 0 || file.size > MAX_PRESENTATION_BYTES) {
      toast.error(`File PowerPoint phải từ 1 byte đến 200 MB. File hiện tại: ${formatMegabytes(file.size)}.`)
      return
    }

    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    const isZip =
      head[0] === 0x50 && head[1] === 0x4b && [0x03, 0x05, 0x07].includes(head[2])
    const isOle =
      head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0
    if (!isZip && !isOle) {
      toast.error("File không đúng định dạng PowerPoint. Hãy chọn file .ppt hoặc .pptx hợp lệ.")
      return
    }

    setIsLoading(true)
    setProgress(1)
    setUploadingName(file.name)
    try {
      const slot = await (slotRef.current ?? prefetchSlot())
      slotRef.current = null
      prefetchSlot()

      const [presentationRow] = await Promise.all([
        registerPresentation({ sessionId, file, storagePath: slot.path }),
        uploadToStorage(slot, file, setProgress),
      ])

      setPresentation(presentationRow)
      onUploadSuccess(presentationRow)
      toast.success(`Tải lên thành công: ${presentationRow.slideCount} slide`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Lỗi khi tải lên"
      toast.error(friendlyStorageError(errorMessage, file.size))
      prefetchSlot()
    } finally {
      setIsLoading(false)
      setProgress(0)
      setUploadingName(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  return (
    <div className="space-y-4">
      {!presentation ? (
        <div
          className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            if (isLoading) {
              e.preventDefault()
              return
            }
            handleDrop(e)
          }}
          onClick={() => {
            if (isLoading) return
            fileInputRef.current?.click()
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                handleFileSelect(file)
              }
            }}
          />

          {isLoading ? (
            <UploadProgressRing percent={progress} />
          ) : (
            <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
          )}
          <p className="text-sm font-medium text-foreground truncate px-2">
            {isLoading
              ? uploadingName ?? "Đang tải lên..."
              : "Kéo file PowerPoint vào đây hoặc click để chọn"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isLoading ? "Đang tải lên..." : "Hỗ trợ .ppt và .pptx, tối đa 200 MB"}
          </p>
        </div>
      ) : (
        <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Presentation className="size-5 text-primary" />
            <div>
              <p className="text-sm font-medium">{presentation.fileName}</p>
              <p className="text-xs text-muted-foreground">{presentation.slideCount} slide</p>
            </div>
          </div>
          <Button
            onClick={() => setPresentation(null)}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
