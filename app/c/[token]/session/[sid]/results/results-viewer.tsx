"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import type {
  SessionRow,
  SessionGroupRow,
  SessionSlotRow,
  SubmissionRow,
  AnnotationRow,
  SubmissionFile,
  AnnotationItem,
  StudentRow,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { SubmissionText } from "@/components/submission-text"
import { Users, Download, FileText, Presentation, File as FileIcon, RotateCw } from "lucide-react"
import { isRichTextEmpty } from "@/lib/rich-text"
import { useFreshFileUrl } from "@/hooks/use-fresh-file-url"
import { useCanvaEmbedUrl } from "@/hooks/use-canva-embed-url"
import { extractCanvaUrl } from "@/lib/canva"
import { EmbedSlideBar } from "@/components/embed-slide-bar"

function getFiles(sub?: SubmissionRow): SubmissionFile[] {
  if (!sub) return []
  const files = (sub.files ?? []) as SubmissionFile[]
  if (files.length > 0) return files
  if (sub.image_url) {
    return [{ url: sub.image_url, name: "bai-nop", kind: "image", mime: "image/*", rotation: 0 }]
  }
  return []
}

function officeUrl(url: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
}

// Ảnh thu nhỏ trong thanh chọn file: signed URL lưu trong DB hết hạn sau 7 ngày
// → xin cấp URL mới như ảnh chính.
function FileThumb({ f }: { f: SubmissionFile }) {
  const fresh = useFreshFileUrl(f.url)
  return (
    <Image
      src={fresh || "/placeholder.svg"}
      alt=""
      fill
      sizes="56px"
      className="object-cover"
      style={{ transform: `rotate(${f.rotation ?? 0}deg)` }}
    />
  )
}

export function ResultsViewer({
  classId,
  className,
  session,
  groups,
  slots,
  submissions,
  annotations,
  students,
  ownGroupByStudent,
  feedbacks,
}: {
  classId: string
  className: string
  session: SessionRow
  groups: SessionGroupRow[]
  slots: SessionSlotRow[]
  submissions: SubmissionRow[]
  annotations: AnnotationRow[]
  students: StudentRow[]
  ownGroupByStudent: Record<string, string>
  feedbacks: Record<string, string>
}) {
  const isGroup = session.kind === "group"
  const [activeFileIdx, setActiveFileIdx] = useState(0)
  const [viewRotation, setViewRotation] = useState(0)
  // Slide/trang hiện tại khi xem file nhúng (PPTX/Canva): dấu chấm được lưu
  // riêng theo từng slide — chọn slide nào thì iframe mở slide đó + hiện
  // đúng bộ dấu của slide đó.
  const [embedSlide, setEmbedSlide] = useState(1)

  // Nhận diện học sinh trên thiết bị này (cùng cơ chế với sảnh lớp và trang
  // nộp bài): ưu tiên device_token đã gắn với một học sinh; nếu chưa có thì
  // dùng tên đã chọn trước đó trên thiết bị. Mỗi học sinh chỉ xem được bài
  // của mình/nhóm mình.
  const [selfId, setSelfId] = useState<string | null>(null)
  const [identityReady, setIdentityReady] = useState(false)
  useEffect(() => {
    try {
      const dt = localStorage.getItem("device_token")
      let found: StudentRow | undefined
      if (dt) found = students.find((s) => !!s.device_token && s.device_token === dt)
      if (!found) {
        const saved =
          localStorage.getItem(`class_${classId}_student`) ||
          localStorage.getItem(`tln_self_${session.id}`)
        if (saved) found = students.find((s) => s.id === saved)
      }
      if (found) setSelfId(found.id)
    } catch {
      // localStorage không khả dụng — học sinh sẽ chọn tên thủ công.
    }
    setIdentityReady(true)
  }, [students, classId, session.id])

  const selfStudent = selfId ? students.find((s) => s.id === selfId) ?? null : null

  const subsByGroup = useMemo(() => {
    const m: Record<string, SubmissionRow> = {}
    for (const s of submissions) if (s.session_group_id) m[s.session_group_id] = s
    return m
  }, [submissions])

  const annsByGroup = useMemo(() => {
    const m: Record<string, AnnotationRow> = {}
    for (const a of annotations) if (a.session_group_id) m[a.session_group_id] = a
    return m
  }, [annotations])

  const subsBySlot = useMemo(() => {
    const m: Record<string, SubmissionRow> = {}
    for (const s of submissions) if (s.session_slot_id) m[s.session_slot_id] = s
    return m
  }, [submissions])

  const annsBySlot = useMemo(() => {
    const m: Record<string, AnnotationRow> = {}
    for (const a of annotations) if (a.session_slot_id) m[a.session_slot_id] = a
    return m
  }, [annotations])

  // Bài duy nhất học sinh được xem: nhóm của mình (phiên nhóm) hoặc ô của
  // mình (phiên cá nhân).
  const myGroup = isGroup && selfId ? groups.find((g) => g.id === ownGroupByStudent[selfId]) ?? null : null
  const mySlot = !isGroup && selfId ? slots.find((s) => s.student_id === selfId) ?? null : null
  const hasTarget = isGroup ? !!myGroup : !!mySlot
  const sub = isGroup
    ? myGroup
      ? subsByGroup[myGroup.id]
      : undefined
    : mySlot
      ? subsBySlot[mySlot.id]
      : undefined
  const ann = isGroup
    ? myGroup
      ? annsByGroup[myGroup.id]
      : undefined
    : mySlot
      ? annsBySlot[mySlot.id]
      : undefined
  const targetLabel = isGroup
    ? (myGroup?.label ?? "")
    : selfStudent?.name
      ? `Bài của ${selfStudent.name}`
      : "Bài của em"
  const feedback = sub ? feedbacks[sub.id] : undefined

  useEffect(() => {
    setEmbedSlide(1)
    setActiveFileIdx(0)
    setViewRotation(0)
  }, [sub?.id])

  // Bài nộp link Canva: thêm "file ảo" ở cuối — cùng vị trí như khung chấm
  // của giáo viên để dấu chấm (theo fileIndex) khớp nhau.
  const baseFiles = getFiles(sub)
  const canvaUrl = extractCanvaUrl(sub?.text_content)
  const files =
    canvaUrl && !baseFiles.some((f) => f.kind === "canva")
      ? [
          ...baseFiles,
          {
            url: canvaUrl,
            name: "Bài Canva",
            kind: "canva" as const,
            mime: "",
            rotation: 0,
          },
        ]
      : baseFiles
  const file = files[activeFileIdx]
  const isEmbedFile = file?.kind === "pptx" || file?.kind === "canva"
  const slideCounts = useMemo(() => {
    const m = new Map<number, number>()
    if (!isEmbedFile || !ann?.data) return m
    for (const it of ann.data as AnnotationItem[]) {
      if ((it.fileIndex ?? 0) !== activeFileIdx) continue
      const s = it.slide ?? 1
      m.set(s, (m.get(s) ?? 0) + 1)
    }
    return m
  }, [ann?.data, activeFileIdx, isEmbedFile])
  // Signed URL hết hạn sau 7 ngày → đổi lấy URL mới trước khi hiện.
  const freshFileUrl = useFreshFileUrl(file?.url)
  const canvaEmbedUrl = useCanvaEmbedUrl(
    file?.kind === "canva" ? file.url : undefined,
  )

  function pickSelf(studentId: string) {
    try {
      localStorage.setItem(`class_${classId}_student`, studentId)
    } catch {
      // bỏ qua nếu localStorage không khả dụng
    }
    setSelfId(studentId)
  }

  function resetSelf() {
    try {
      localStorage.removeItem(`class_${classId}_student`)
    } catch {
      // bỏ qua
    }
    setSelfId(null)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Users className="size-5 text-primary" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{className}</p>
            <h1 className="font-semibold truncate">{session.title}</h1>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">
            Kết quả thảo luận
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4">
        {!identityReady ? (
          <div className="bg-card rounded-lg border p-12 text-center">
            <p className="text-muted-foreground">Đang tải kết quả…</p>
          </div>
        ) : !selfId ? (
          <div className="bg-card rounded-lg border p-6 space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold">Em là ai?</h2>
              <p className="text-sm text-muted-foreground">
                Chọn đúng tên của em để xem bài làm, điểm và nhận xét của giáo viên dành cho{" "}
                {isGroup ? "nhóm em" : "em"}.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[60vh] overflow-auto">
              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickSelf(s.id)}
                  className="text-left p-3 rounded-lg border bg-card hover:bg-muted transition"
                >
                  <span className="font-medium block truncate">{s.name || `Học sinh ${s.slot_number}`}</span>
                  <span className="text-[11px] text-muted-foreground">Số thứ tự {s.slot_number}</span>
                </button>
              ))}
            </div>
          </div>
        ) : !hasTarget ? (
          <div className="bg-card rounded-lg border p-12 text-center space-y-3">
            <p className="text-muted-foreground">
              {isGroup
                ? "Em chưa thuộc nhóm nào trong phiên này nên chưa có kết quả để xem. Hãy báo giáo viên nếu em đã tham gia thảo luận."
                : "Em chưa có ô bài làm trong phiên này nên chưa có kết quả để xem. Hãy báo giáo viên nếu em đã nộp bài."}
            </p>
            <Button variant="outline" size="sm" onClick={resetSelf}>
              Chọn lại tên
            </Button>
          </div>
        ) : (
          <main className="min-w-0 space-y-3">
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">{targetLabel}</h2>
                  {ann?.score !== null && ann?.score !== undefined && (
                    <p className="text-sm mt-1">
                      Điểm: <span className="font-bold text-primary">{ann.score}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {file?.kind === "image" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setViewRotation((r) => (r + 90) % 360)}
                    >
                      <RotateCw className="size-4 mr-2" aria-hidden="true" />
                      Xoay ảnh
                    </Button>
                  )}
                  {session.allow_download && file?.url && file.kind !== "canva" && (
                    <Button asChild size="sm" variant="outline">
                      <a href={freshFileUrl ?? file.url} download={file.name}>
                        <Download className="size-4 mr-2" aria-hidden="true" />
                        Tải xuống
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {feedback && (
              <div className="bg-card rounded-lg border p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Nhận xét của giáo viên
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{feedback}</p>
              </div>
            )}

            {!isRichTextEmpty(sub?.text_content) && (
              <div className="bg-card rounded-lg border p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Phần viết
                </p>
                <SubmissionText
                  value={sub?.text_content}
                  className="text-lg leading-relaxed"
                />
              </div>
            )}

            {files.length > 0 && (
              <div className="bg-card rounded-lg border overflow-hidden">
                {files.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto p-2 border-b bg-muted/30">
                    {files.map((f, i) => (
                       <button
                         key={i}
                         onClick={() => {
                           setActiveFileIdx(i)
                           setViewRotation(0)
                         }}
                        className={`shrink-0 size-14 relative rounded border-2 overflow-hidden flex items-center justify-center ${
                          i === activeFileIdx ? "border-primary" : "border-transparent"
                        }`}
                      >
                        {f.kind === "image" ? (
                          <FileThumb f={f} />
                        ) : f.kind === "pptx" ? (
                          <Presentation className="size-5 text-muted-foreground" />
                        ) : f.kind === "docx" ? (
                          <FileText className="size-5 text-muted-foreground" />
                        ) : (
                          <FileIcon className="size-5 text-muted-foreground" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {isEmbedFile && (
                  <div className="p-2 border-b">
                    <EmbedSlideBar
                      slide={embedSlide}
                      onSlide={setEmbedSlide}
                      counts={slideCounts}
                      noun={file?.kind === "canva" ? "Trang" : "Slide"}
                      verb="đang xem"
                    />
                  </div>
                )}
                <div className="relative bg-muted/20 flex items-center justify-center min-h-[60vh]">
                  {file?.kind === "image" ? (
                    <>
                      <div
                        className="relative"
                        style={{ transform: `rotate(${((file.rotation ?? 0) + viewRotation) % 360}deg)` }}
                      >
                        <img
                          src={freshFileUrl || file.url || "/placeholder.svg"}
                          alt=""
                          className="max-w-full max-h-[75vh] object-contain"
                        />
                        {ann?.data && <AnnotationOverlay items={ann.data as AnnotationItem[]} fileIdx={activeFileIdx} />}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="absolute bottom-3 right-3 shadow-md"
                        onClick={() => setViewRotation((r) => (r + 90) % 360)}
                      >
                        <RotateCw className="size-4 mr-2" aria-hidden="true" />
                        Xoay ảnh
                      </Button>
                    </>
                  ) : file?.kind === "canva" ? (
                    <div className="relative w-full">
                      {canvaEmbedUrl ? (
                        <iframe src={`${canvaEmbedUrl}#${embedSlide}`} className="w-full h-[80vh]" title={file.name} />
                      ) : (
                        <p className="p-8 text-muted-foreground">Đang tải bài Canva…</p>
                      )}
                      {ann?.data && <AnnotationOverlay items={ann.data as AnnotationItem[]} fileIdx={activeFileIdx} slide={embedSlide} />}
                    </div>
                  ) : file?.kind === "pdf" ? (
                    <iframe src={freshFileUrl ?? file.url} className="w-full h-[80vh]" title={file.name} />
                  ) : file?.kind === "docx" || file?.kind === "pptx" ? (
                    <>
                      <iframe src={`${officeUrl(freshFileUrl ?? file.url)}${file?.kind === "pptx" ? `&wdSlideIndex=${embedSlide}` : ""}`} className="w-full h-[80vh]" title={file.name} />
                      {file?.kind === "pptx" && ann?.data && <AnnotationOverlay items={ann.data as AnnotationItem[]} fileIdx={activeFileIdx} slide={embedSlide} />}
                    </>
                  ) : (
                    <p className="p-8 text-muted-foreground">Không có file để xem</p>
                  )}
                </div>
              </div>
            )}

            {!sub && (
              <div className="bg-card rounded-lg border p-8 text-center">
                <p className="text-muted-foreground">
                  {isGroup ? "Nhóm của em chưa nộp bài trong phiên này." : "Em chưa nộp bài trong phiên này."}
                </p>
              </div>
            )}
          </main>
        )}
      </div>
    </div>
  )
}

function AnnotationOverlay({ items, fileIdx, slide }: { items: AnnotationItem[]; fileIdx: number; slide?: number }) {
  const relevant = items.filter(
    (it) =>
      (it.fileIndex ?? 0) === fileIdx &&
      (slide === undefined || (it.slide ?? 1) === slide),
  )
  return (
    <div className="pointer-events-none absolute inset-0">
      {relevant.map((it, i) => {
        if (it.kind === "text") {
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${it.x * 100}%`,
                top: `${it.y * 100}%`,
                color: it.color,
                fontSize: it.fontSize,
              }}
            >
              {it.text}
            </div>
          )
        }
        if (it.kind === "stamp") {
          return (
            <div
              key={i}
              className="absolute font-bold"
              style={{
                left: `${it.x * 100}%`,
                top: `${it.y * 100}%`,
                color: it.color,
                fontSize: it.fontSize,
              }}
            >
              {it.label[0]}
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
