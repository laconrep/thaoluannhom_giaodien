"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Presentation, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { powerpointContentType, resolveSignedUploadUrl } from "@/lib/storage-upload"

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

function xhrPut(
  url: string,
  body: XMLHttpRequestBodyInit,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
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
    xhr.send(body)
  })
}

async function uploadToStorage(opts: {
  signedUrl?: string
  path: string
  token: string
  file: File
  onProgress: (percent: number) => void
}) {
  const supabase = createClient()
  const typedFile = new File([opts.file], opts.file.name, {
    type: powerpointContentType(opts.file.name, opts.file.type),
  })
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ""
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const authToken = session?.access_token || anonKey
  const headers: Record<string, string> = {}
  if (authToken) headers.Authorization = `Bearer ${authToken}`
  if (anonKey) headers.apikey = anonKey

  const uploadUrl = resolveSignedUploadUrl(opts.signedUrl, opts.path, opts.token)
  if (uploadUrl) {
    const form = new FormData()
    form.append("cacheControl", "3600")
    form.append("", typedFile)
    try {
      await xhrPut(uploadUrl, form, headers, opts.onProgress)
      return
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 400) {
        await xhrPut(
          uploadUrl,
          typedFile,
          { ...headers, "Content-Type": typedFile.type },
          opts.onProgress,
        )
        return
      }
      throw error
    }
  }

  opts.onProgress(40)
  const signed = await supabase.storage
    .from("presentations")
    .uploadToSignedUrl(opts.path, opts.token, typedFile)
  if (!signed.error) {
    opts.onProgress(100)
    return
  }

  const direct = await supabase.storage.from("presentations").upload(opts.path, typedFile, {
    upsert: true,
    contentType: typedFile.type,
  })
  if (direct.error) {
    throw new Error(signed.error.message || direct.error.message)
  }
  opts.onProgress(100)
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

  const handleFileSelect = async (file: File) => {
    if (!/\.pptx?$/i.test(file.name)) {
      toast.error("Chỉ hỗ trợ file PowerPoint (.ppt hoặc .pptx)")
      return
    }
    if (file.size === 0 || file.size > 200 * 1024 * 1024) {
      toast.error("File PowerPoint phải từ 1 byte đến 200 MB")
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
    setProgress(0)
    setUploadingName(file.name)
    try {
      await fetch("/api/storage/ensure-bucket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: "presentations" }),
      }).catch(() => null)

      const response = await fetch("/api/presentations/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          fileName: file.name,
          fileSize: file.size,
          fileType: powerpointContentType(file.name, file.type),
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
      if (!data?.upload?.token || !data?.upload?.path) {
        throw new Error("Không tạo được đường dẫn tải lên kho lưu trữ.")
      }

      await uploadToStorage({
        signedUrl: data.upload.signedUrl,
        path: data.upload.path,
        token: data.upload.token,
        file,
        onProgress: setProgress,
      })

      setPresentation(data.presentation)
      onUploadSuccess(data.presentation)
      toast.success(`Tải lên thành công: ${data.presentation.slideCount} slide`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Lỗi khi tải lên"
      toast.error(errorMessage)
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
