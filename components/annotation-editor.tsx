"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import type { AnnotationItem, SubmissionFile } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SubmissionText } from "@/components/submission-text"
import { GroupMembersDialog } from "@/components/group-members-dialog"
import {
  AnnotationToolbar,
  TOOLBAR_COLORS as COLORS,
  TOOLBAR_STAMPS as STAMPS,
  type AnnotationTool,
} from "@/components/annotation/annotation-toolbar"
import { FileViewer } from "@/components/annotation/file-viewer"
import { useFreshFileUrl } from "@/hooks/use-fresh-file-url"
import { isSignUrl } from "@/lib/file-url"
import { useFullscreen } from "@/lib/use-fullscreen"
import { cn } from "@/lib/utils"
import { isRichTextEmpty } from "@/lib/rich-text"
import {
  Type,
  Trash2,
  X,
  Check,
  MoveDiagonal,
  ChevronLeft,
  ChevronRight,
  FileText,
  File as FileIcon,
  Loader2,
} from "lucide-react"

type Tool = AnnotationTool
type TextItem = Extract<AnnotationItem, { kind: "text" }>

function fileIcon(kind: string) {
  if (kind === "docx") return FileText
  return FileIcon
}

// Ảnh thu nhỏ ở thanh chọn file: signed URL lưu trong DB hết hạn sau 7 ngày
// → xin cấp URL mới như ảnh chính trong khung chấm.
function FileThumbImg({ f, rotation }: { f: SubmissionFile; rotation: number }) {
  const fresh = useFreshFileUrl(f.url)
  return (
    <Image
      src={fresh || "/placeholder.svg"}
      alt={f.name}
      fill
      sizes="40px"
      className="object-cover"
      style={{ transform: `rotate(${rotation}deg)` }}
    />
  )
}

export function AnnotationEditor({
  title,
  files,
  textContent,
  initialData,
  initialScore,
  dataReady = true,
  maxScore = 10,
  autoFullscreen = false,
  sessionId,
  sessionGroupId,
  groupLabel,
  onSave,
  onClose,
}: {
  title: string
  files: SubmissionFile[]
  textContent: string | null
  initialData: AnnotationItem[]
  initialScore: number | null
  /**
   * T3.3 — chốt an toàn tải lười: false = nét vẽ chưa tải xong.
   * Khi false: chặn vẽ (overlay) + chặn lưu, chống ghi đè mất nét vẽ cũ.
   * Mặc định true để các luồng cũ (đã có data) không đổi hành vi.
   */
  dataReady?: boolean
  maxScore?: number
  autoFullscreen?: boolean
  /** Có 2 prop này => luồng chấm theo nhóm => hiện nút "Thành Viên" */
  sessionId?: string
  sessionGroupId?: string | null
  groupLabel?: string
  onSave: (data: AnnotationItem[], score: number | null) => Promise<void> | void
  onClose: () => void
}) {
  const hasFiles = files.length > 0
  const hasText = !isRichTextEmpty(textContent)
  const [currentIdx, setCurrentIdx] = useState<number>(hasFiles ? 0 : -1)
  const [rotations, setRotations] = useState<number[]>(() =>
    files.map((f) => f.rotation ?? 0),
  )
  useEffect(() => {
    setRotations(files.map((f) => f.rotation ?? 0))
  }, [files])

  const [items, setItems] = useState<AnnotationItem[]>(initialData)
  // T3.3: data tải lười về SAU khi editor đã mở → nạp vào items.
  // Trong lúc chưa ready, overlay chặn tương tác nên không thể mất nét vẽ người dùng.
  useEffect(() => {
    if (dataReady) setItems(initialData)
    // Chỉ chạy khi dataReady đổi (false→true); không reset theo initialData để giữ nét đang vẽ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady])
  const [history, setHistory] = useState<AnnotationItem[][]>([])
  const [tool, setTool] = useState<Tool>("pen")
  const [color, setColor] = useState(COLORS[0].value)
  const [stampIdx, setStampIdx] = useState(0)
  const [score, setScore] = useState<string>(initialScore?.toString() ?? "")
  const [saving, setSaving] = useState(false)
  const [pendingText, setPendingText] = useState<{ x: number; y: number; text: string } | null>(
    null,
  )
  const [selectedTextIdx, setSelectedTextIdx] = useState<number | null>(null)
  const [presentationMode, setPresentationMode] = useState(false)
  const [textFontSize, setTextFontSize] = useState(18) // dành cho presentation chữ to
  const [zoomLevel, setZoomLevel] = useState(1) // 0.5 → 10
  const [zoomText, setZoomText] = useState<string | null>(null) // text đang nhập ở ô zoom
  const [membersOpen, setMembersOpen] = useState(false)
  const [showToolbar, setShowToolbar] = useState(true)
  const toolbarHideTimer = useRef<any>(null)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const docxBoxRef = useRef<HTMLDivElement | null>(null)
  const [docxWidth, setDocxWidth] = useState<number | null>(null)
  const [docxError, setDocxError] = useState(false)
  const [docxLoading, setDocxLoading] = useState(false)
  const panRef = useRef<{ active: boolean; startX: number; startY: number; scrollX: number; scrollY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    scrollX: 0,
    scrollY: 0,
  })

  const { isFullscreen, enter, exit, toggle: toggleFullscreen } = useFullscreen(rootRef)

  // Tự vào fullscreen khi mở (đúng ý GV: click nhóm → báo cáo full màn hình ngay).
  // Tránh gọi khi đã đang fullscreen sẵn (ví dụ nổi trên PowerPoint đang full) —
  // trình duyệt chỉ cho 1 phần tử fullscreen nên bỏ qua để khỏi phá trạng thái của PowerPoint.
  useEffect(() => {
    if (autoFullscreen && !document.fullscreenElement) {
      enter().catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Đóng editor: thoát fullscreen riêng của editor rồi mới gọi onClose để trả lại
  // fullscreen của PowerPoint (đang full phía dưới) đúng như mong đợi.
  function handleClose() {
    if (isFullscreen) {
      exit().catch(() => undefined)
    }
    onClose()
  }

  const currentFile = currentIdx >= 0 ? files[currentIdx] : null
  // Signed URL của file hiện tại hết hạn sau 7 ngày → xin cấp mới (cho đường fetch DOCX).
  const freshCurrentUrl = useFreshFileUrl(currentFile?.url)
  const currentRotation = currentIdx >= 0 ? rotations[currentIdx] ?? 0 : 0
  const isImage = currentFile?.kind === "image"
  const isPdf = currentFile?.kind === "pdf"
  const isDocx = currentFile?.kind === "docx"
  const isPptx = currentFile?.kind === "pptx"
  // PPT: khi đang dùng công cụ chấm (không phải bàn tay) thì khóa iframe để
  // không tương tác được với file, chuột chỉ dùng để đặt dấu/vẽ.
  const annotateLocked = isPptx && tool !== "pan"
  // PDF render từng trang bằng PDF.js ngay trong trang → chấm được như Word/ảnh.
  const canAnnotate = isImage || currentIdx === -1 || isDocx || isPptx || isPdf
  const annotationKey = currentIdx
  const showAnnotations = canAnnotate && !presentationMode

  // Render tệp .docx bằng docx-preview thành DOM thuần (thay iframe Office):
  // scroll trang tự nhiên theo viewport, dấu bám nội dung, chấm chính xác như ảnh.
  // Đo chiều rộng khối đã render để canh surface đúng bằng nội dung, giữ tọa độ
  // annotation khớp chính xác với vị trí click.
  useEffect(() => {
    const el = docxBoxRef.current
    if (!isDocx || !currentFile || !el) {
      setDocxWidth(null)
      setDocxError(false)
      return
    }
    let cancelled = false
    setDocxLoading(true)
    // File cũ có signed URL đã hết hạn: chờ URL mới rồi mới tải, tránh fetch link chết.
    if (isSignUrl(currentFile.url) && !freshCurrentUrl) {
      return
    }
    ;(async () => {
      try {
        const res = await fetch(freshCurrentUrl ?? currentFile.url)
        if (!res.ok) throw new Error("Không tải được tệp")
        const blob = await res.blob()
        if (cancelled) return
        // docx-preview chỉ tải khi thực sự mở file .docx (dynamic import).
        const { renderAsync } = await import("docx-preview")
        if (cancelled) return
        await renderAsync(blob, el, undefined, { className: "docx" })
        if (cancelled) return
        // Đo trang rộng nhất (wrapper là flex width:auto nên không đo được)
        let pageWidth = 0
        el.querySelectorAll<HTMLElement>("section.docx").forEach((s) => {
          pageWidth = Math.max(pageWidth, s.offsetWidth)
        })
        setDocxWidth(pageWidth || null)
        setDocxError(false)
      } catch {
        if (!cancelled) {
          setDocxError(true)
          setDocxWidth(null)
        }
      } finally {
        if (!cancelled) setDocxLoading(false)
      }
    })()
    return () => {
      cancelled = true
      if (el) el.replaceChildren()
    }
    // freshCurrentUrl nằm trong deps: URL mới được cấp (file cũ hết hạn) phải
    // chạy lại effect để tải file, nếu không sẽ kẹt ở trạng thái chờ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, freshCurrentUrl])

  const filteredItems = useMemo(() => {
    if (!canAnnotate) return []
    return items
      .map((it, origIdx) => ({ it, origIdx }))
      .filter(({ it }) => (it.fileIndex ?? -1) === annotationKey)
  }, [items, annotationKey, canAnnotate])

  const drawingRef = useRef<{
    active: boolean
    origIdx: number
    start: { x: number; y: number } | null
  }>({
    active: false,
    origIdx: -1,
    start: null,
  })

  const textDragRef = useRef<{
    mode: "move" | "resize" | null
    origIdx: number
    startX: number
    startY: number
    original: TextItem | null
  }>({ mode: null, origIdx: -1, startX: 0, startY: 0, original: null })

  useEffect(() => {
    setPendingText(null)
    setSelectedTextIdx(null)
    drawingRef.current = { active: false, origIdx: -1, start: null }
    panRef.current.active = false
    if (!canAnnotate) setTool("pan")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx])

  function pushHistory() {
    setHistory((h) => [...h, items])
  }
  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setItems(prev)
      return h.slice(0, -1)
    })
  }
  function clearAll() {
    if (!confirm("Xóa toàn bộ ghi chú trên tệp này?")) return
    pushHistory()
    setItems((cur) => cur.filter((it) => (it.fileIndex ?? -1) !== annotationKey))
    setSelectedTextIdx(null)
  }

  // Chuyển tọa độ client -> tọa độ trong hệ unscaled của surface
  function localXY(clientX: number, clientY: number) {
    const rect = surfaceRef.current!.getBoundingClientRect()
    return {
      x: (clientX - rect.left) / zoomLevel,
      y: (clientY - rect.top) / zoomLevel,
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (tool === "pan") {
      const vp = viewportRef.current
      if (!vp) return
      panRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        scrollX: vp.scrollLeft,
        scrollY: vp.scrollTop,
      }
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      return
    }

    if (!canAnnotate || pendingText) return
    setSelectedTextIdx(null)
    const { x, y } = localXY(e.clientX, e.clientY)

    if (tool === "text") {
      setPendingText({ x, y, text: "" })
      return
    }
    if (tool === "stamp") {
      pushHistory()
      const stamp = STAMPS[stampIdx]
      setItems((cur) => [
        ...cur,
        {
          kind: "stamp",
          label: stamp.mark,
          color: stamp.color,
          x,
          y,
          fontSize: 13,
          fileIndex: annotationKey,
        },
      ])
      return
    }
    pushHistory()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)

    if (tool === "pen") {
      const item: AnnotationItem = {
        kind: "path",
        color,
        width: 3,
        points: [{ x, y }],
        fileIndex: annotationKey,
      }
      setItems((cur) => {
        const n = [...cur, item]
        drawingRef.current = { active: true, origIdx: n.length - 1, start: { x, y } }
        return n
      })
    } else if (tool === "highlight") {
      const item: AnnotationItem = {
        kind: "highlight",
        color,
        x,
        y,
        w: 0,
        h: 0,
        fileIndex: annotationKey,
      }
      setItems((cur) => {
        const n = [...cur, item]
        drawingRef.current = { active: true, origIdx: n.length - 1, start: { x, y } }
        return n
      })
    } else if (tool === "underline") {
      const item: AnnotationItem = {
        kind: "underline",
        color,
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        fileIndex: annotationKey,
      }
      setItems((cur) => {
        const n = [...cur, item]
        drawingRef.current = { active: true, origIdx: n.length - 1, start: { x, y } }
        return n
      })
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (panRef.current.active) {
      const vp = viewportRef.current
      if (!vp) return
      vp.scrollLeft = panRef.current.scrollX - (e.clientX - panRef.current.startX)
      vp.scrollTop = panRef.current.scrollY - (e.clientY - panRef.current.startY)
      return
    }
    if (!drawingRef.current.active) return
    const { x, y } = localXY(e.clientX, e.clientY)
    const origIdx = drawingRef.current.origIdx
    setItems((cur) => {
      const next = [...cur]
      const item = next[origIdx]
      if (!item) return cur
      if (item.kind === "path") {
        next[origIdx] = { ...item, points: [...item.points, { x, y }] }
      } else if (item.kind === "highlight") {
        const s = drawingRef.current.start!
        next[origIdx] = {
          ...item,
          x: Math.min(s.x, x),
          y: Math.min(s.y, y),
          w: Math.abs(x - s.x),
          h: Math.abs(y - s.y),
        }
      } else if (item.kind === "underline") {
        next[origIdx] = { ...item, x2: x, y2: y }
      }
      return next
    })
  }

  function onPointerUp() {
    drawingRef.current = { active: false, origIdx: -1, start: null }
    panRef.current.active = false
  }

  function confirmText() {
    if (!pendingText) return
    const t = pendingText.text.trim()
    if (t) {
      pushHistory()
      setItems((cur) => {
        const next = [
          ...cur,
          {
            kind: "text" as const,
            color,
            x: pendingText.x,
            y: pendingText.y,
            text: t,
            fontSize: 20,
            fileIndex: annotationKey,
          },
        ]
        setSelectedTextIdx(next.length - 1)
        return next
      })
    }
    setPendingText(null)
  }

  function beginTextDrag(e: React.PointerEvent, origIdx: number, mode: "move" | "resize") {
    e.stopPropagation()
    const it = items[origIdx]
    if (!it || it.kind !== "text") return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pushHistory()
    setSelectedTextIdx(origIdx)
    textDragRef.current = {
      mode,
      origIdx,
      startX: e.clientX,
      startY: e.clientY,
      original: it as TextItem,
    }
  }

  function onTextPointerMove(e: React.PointerEvent) {
    const d = textDragRef.current
    if (!d.mode || d.origIdx < 0 || !d.original) return
    const dx = (e.clientX - d.startX) / zoomLevel
    const dy = (e.clientY - d.startY) / zoomLevel
    setItems((cur) => {
      const next = [...cur]
      const cur0 = next[d.origIdx]
      if (!cur0 || cur0.kind !== "text") return cur
      if (d.mode === "move") {
        next[d.origIdx] = { ...cur0, x: d.original!.x + dx, y: d.original!.y + dy }
      } else {
        const delta = (dx + dy) / 2
        const nf = Math.max(10, Math.min(120, Math.round(d.original!.fontSize + delta / 2)))
        next[d.origIdx] = { ...cur0, fontSize: nf }
      }
      return next
    })
  }

  function onTextPointerUp() {
    textDragRef.current = { mode: null, origIdx: -1, startX: 0, startY: 0, original: null }
  }

  function deleteSelectedText() {
    if (selectedTextIdx === null) return
    pushHistory()
    setItems((cur) => cur.filter((_, i) => i !== selectedTextIdx))
    setSelectedTextIdx(null)
  }

  function removeStamp(origIdx: number) {
    pushHistory()
    setItems((cur) => cur.filter((_, i) => i !== origIdx))
  }

  // Chuyển công cụ. Dấu trên file PPT gắn theo khung xem (không theo từng slide
  // vì slide nằm trong iframe của Microsoft, code không đọc được đang ở slide nào).
  // KHÔNG tự xóa dấu nữa — giáo viên bấm nút thùng rác để xóa khi chuyển slide.
  function switchTool(next: Tool) {
    setTool(next)
  }

  function changeFontSelected(delta: number) {
    if (selectedTextIdx === null) return
    pushHistory()
    setItems((cur) => {
      const next = [...cur]
      const it = next[selectedTextIdx]
      if (!it || it.kind !== "text") return cur
      next[selectedTextIdx] = {
        ...it,
        fontSize: Math.max(10, Math.min(120, it.fontSize + delta)),
      }
      return next
    })
  }

  function rotateCurrent(delta: number) {
    if (currentIdx < 0) return
    setRotations((r) => {
      const n = [...r]
      n[currentIdx] = (((n[currentIdx] ?? 0) + delta) % 360 + 360) % 360
      return n
    })
  }

  async function handleSave() {
    setSaving(true)
    const sc = score.trim() === "" ? null : Number(score)
    await onSave(items, Number.isFinite(sc as number) ? (sc as number) : null)
    setSaving(false)
  }

  // Zoom nhập tay: Enter/blur để áp dụng, Esc để hủy.
  function commitZoom() {
    const raw = (zoomText ?? "").trim().replace("%", "")
    const n = Number(raw)
    if (raw !== "" && Number.isFinite(n) && n > 0) {
      setZoomLevel(Math.max(0.5, Math.min(10, Math.round(n) / 100)))
    }
    setZoomText(null)
  }
  function nudgeZoom(delta: number) {
    setZoomText(null)
    setZoomLevel((z) => Math.max(0.5, Math.min(10, Math.round((z + delta) * 100) / 100)))
  }

  // Zoom bằng Ctrl + wheel
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoomText(null)
      setZoomLevel((z) => {
        const next = Math.max(0.5, Math.min(10, z - e.deltaY / 500))
        return Math.round(next * 100) / 100
      })
    }
    vp.addEventListener("wheel", onWheel, { passive: false })
    return () => vp.removeEventListener("wheel", onWheel)
  }, [])

  // Phím tắt
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "Escape") {
        if (membersOpen) {
          setMembersOpen(false)
          return
        }
        if (pendingText) setPendingText(null)
        else if (selectedTextIdx !== null) setSelectedTextIdx(null)
        else if (presentationMode) setPresentationMode(false)
        else if (isFullscreen) toggleFullscreen()
        else onClose()
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedTextIdx !== null &&
        !pendingText
      ) {
        deleteSelectedText()
      }
      if (e.key === "ArrowLeft" && files.length > 1) setCurrentIdx((i) => Math.max(0, i - 1))
      if (e.key === "ArrowRight" && files.length > 1)
        setCurrentIdx((i) => Math.min(files.length - 1, i + 1))
      if (e.key === "0") {
        setZoomText(null)
        setZoomLevel(1)
      }
      if (e.key === "+" || e.key === "=") nudgeZoom(0.25)
      if (e.key === "-") nudgeZoom(-0.25)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingText, selectedTextIdx, files.length, presentationMode, isFullscreen, membersOpen])

  // Tự ẩn toolbar sau vài giây không dùng
  function kickToolbar() {
    setShowToolbar(true)
    if (toolbarHideTimer.current) clearTimeout(toolbarHideTimer.current)
    toolbarHideTimer.current = setTimeout(() => setShowToolbar(false), 4000)
  }
  useEffect(() => {
    kickToolbar()
    return () => {
      if (toolbarHideTimer.current) clearTimeout(toolbarHideTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cursor =
    tool === "pan"
      ? "grab"
      : tool === "text"
        ? "text"
        : canAnnotate
          ? "crosshair"
          : "default"

  return (
    <div
      ref={rootRef}
      className={cn(
        "fixed inset-0 z-50 bg-background flex flex-col",
        isFullscreen && "inset-0",
        presentationMode && "presentation-mode",
      )}
      onMouseMove={kickToolbar}
    >
      {/* Nút đóng luôn hiển thị: quay về màn hình trước đó (PowerPoint / bảng) */}
      <Button
        variant="secondary"
        size="sm"
        onClick={handleClose}
        className="absolute top-3 left-3 z-40 gap-1.5 shadow-lg"
        aria-label="Đóng và quay lại"
        title="Đóng và quay lại"
      >
        <X className="size-4" />
        Quay lại
      </Button>

      {/* Floating toolbar pill */}
      {!presentationMode && (
        <div
          className={cn(
            "absolute top-3 left-1/2 -translate-x-1/2 z-30 transition-all duration-300",
            showToolbar ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none",
          )}
        >
          <AnnotationToolbar
            title={title}
            hasText={hasText}
            currentIdx={currentIdx}
            textFontSize={textFontSize}
            setTextFontSize={setTextFontSize}
            tool={tool}
            onSwitchTool={switchTool}
            canAnnotate={canAnnotate}
            stampIdx={stampIdx}
            setStampIdx={setStampIdx}
            color={color}
            setColor={setColor}
            onUndo={undo}
            canUndo={history.length > 0}
            onClear={clearAll}
            isImage={isImage}
            onRotate={rotateCurrent}
            zoomText={zoomText}
            setZoomText={setZoomText}
            zoomLevel={zoomLevel}
            onCommitZoom={commitZoom}
            onNudgeZoom={nudgeZoom}
            score={score}
            setScore={setScore}
            maxScore={maxScore}
            saving={saving}
            saveDisabled={!dataReady}
            onSave={handleSave}
            showMembers={!!sessionGroupId}
            onOpenMembers={() => setMembersOpen(true)}
          />
        </div>
      )}

      {/* Selected-text mini toolbar */}
      {selectedTextIdx !== null && items[selectedTextIdx]?.kind === "text" && !presentationMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-card/95 backdrop-blur border rounded-full shadow px-2.5 py-1.5 flex items-center gap-2 text-sm">
          <Type className="size-4 text-primary" />
          <span className="text-muted-foreground text-xs">Textbox</span>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => changeFontSelected(-2)}>
            A−
          </Button>
          <span className="min-w-8 text-center tabular-nums text-xs">
            {(items[selectedTextIdx] as TextItem).fontSize}
          </span>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => changeFontSelected(2)}>
            A+
          </Button>
          <Button variant="destructive" size="sm" className="h-7 gap-1" onClick={deleteSelectedText}>
            <Trash2 className="size-3" /> Xóa
          </Button>
        </div>
      )}

      {/* Presentation mode top bar */}
      {presentationMode && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2 bg-white/95 border rounded-full shadow px-3 py-1.5">
          <span className="font-heading text-sm font-semibold text-neutral-800">Trình chiếu</span>
          {currentIdx === -1 && (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-600 pl-2 border-l">
              Cỡ chữ
              <button onClick={() => setTextFontSize((s) => Math.max(14, s - 4))} className="px-1.5 hover:bg-muted rounded">A−</button>
              <span className="tabular-nums">{textFontSize}</span>
              <button onClick={() => setTextFontSize((s) => Math.min(200, s + 4))} className="px-1.5 hover:bg-muted rounded">A+</button>
            </span>
          )}
        </div>
      )}

      {/* File thumb strip */}
      {(files.length > 0 || hasText) && !presentationMode && (
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1 bg-card/95 backdrop-blur border rounded-lg p-1 shadow-sm max-w-[70vw] overflow-x-auto no-scrollbar">
          {hasText && (
            <button
              type="button"
              onClick={() => setCurrentIdx(-1)}
              className={cn(
                "shrink-0 rounded px-2 h-10 text-xs flex items-center gap-1",
                currentIdx === -1 ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted text-muted-foreground",
              )}
            >
              <FileText className="size-3.5" />
              Văn bản
            </button>
          )}
          {files.map((f, i) => {
            const selected = currentIdx === i
            const Icon = fileIcon(f.kind)
            return (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIdx(i)}
                className={cn(
                  "shrink-0 relative w-10 h-10 rounded overflow-hidden transition",
                  selected ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100",
                )}
                title={f.name}
              >
                {f.kind === "image" ? (
                  <span className="block relative w-full h-full">
                    <FileThumbImg f={f} rotation={rotations[i] ?? 0} />
                  </span>
                ) : (
                  <div className="w-full h-full bg-muted/60 grid place-items-center text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                )}
                <span className="absolute top-0 left-0 bg-background/80 rounded-br px-1 text-[9px] font-mono">
                  {i + 1}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* File nav arrows */}
      {files.length > 1 && !presentationMode && (
        <>
          <button
            type="button"
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx <= 0}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-card/90 hover:bg-card border shadow rounded-full p-2 disabled:opacity-40"
            aria-label="Trước"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentIdx((i) => Math.min(files.length - 1, i + 1))}
            disabled={currentIdx >= files.length - 1}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-card/90 hover:bg-card border shadow rounded-full p-2 disabled:opacity-40"
            aria-label="Sau"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}

      {/* MAIN VIEWPORT */}
      <div
        ref={viewportRef}
        className={cn(
          "flex-1 overflow-auto",
          presentationMode ? "bg-white p-8" : "bg-muted/30 p-6 pt-20 pb-20",
        )}
      >
        <div
          className="mx-auto"
          style={{
            width: "100%",
            transform: `scale(${zoomLevel})`,
            transformOrigin: "top center",
            transition: "transform 120ms ease-out",
          }}
        >
          <div
            ref={surfaceRef}
            key={`surface-${annotationKey}-${currentFile?.kind ?? "text"}`}
            className={cn(
              "relative bg-card rounded-md shadow-sm border",
              presentationMode && "bg-white shadow-none border-none",
              canAnnotate && tool !== "pan" ? "select-none touch-none" : "",
              "w-full",
            )}
            onPointerDown={canAnnotate || tool === "pan" ? onPointerDown : undefined}
            onPointerMove={(e) => {
              if (canAnnotate || tool === "pan") {
                onPointerMove(e)
                onTextPointerMove(e)
              }
            }}
            onPointerUp={() => {
              if (canAnnotate || tool === "pan") {
                onPointerUp()
                onTextPointerUp()
              }
            }}
            onPointerCancel={() => {
              if (canAnnotate || tool === "pan") {
                onPointerUp()
                onTextPointerUp()
              }
            }}
            style={{
              cursor,
              minHeight: presentationMode ? undefined : "70vh",
              width: isDocx ? (docxWidth ?? undefined) : undefined,
              margin: isDocx && docxWidth ? "0 auto" : undefined,
            }}
          >
            {/* T3.3: đang tải lười nét vẽ → chặn mọi tương tác vẽ cho đến khi data sẵn sàng */}
            {!dataReady && (
              <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-background/70 backdrop-blur-[1px] rounded-md">
                <Loader2 className="size-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Đang tải nét vẽ…</span>
              </div>
            )}
            {currentIdx === -1 ? (
              <div
                className={cn(
                  "leading-relaxed",
                  presentationMode ? "p-10 text-neutral-900" : "text-foreground",
                )}
                style={{
                  fontSize: presentationMode ? `${Math.max(24, textFontSize * 1.5)}px` : `${textFontSize}px`,
                  lineHeight: 1.55,
                  minHeight: presentationMode ? undefined : "70vh",
                  minWidth: presentationMode ? "90vw" : "100%",
                  padding: presentationMode ? undefined : "20mm",
                }}
              >
                <SubmissionText
                  value={textContent}
                  fallback={
                    <span className="text-muted-foreground">Nhóm này chưa nộp nội dung.</span>
                  }
                />
              </div>
            ) : currentFile ? (
              <FileViewer
                file={currentFile}
                isImage={isImage}
                isPdf={isPdf}
                isDocx={isDocx}
                isPptx={isPptx}
                currentRotation={currentRotation}
                fileIndex={currentIdx}
                docxBoxRef={docxBoxRef}
                docxLoading={docxLoading}
                docxError={docxError}
                annotateLocked={annotateLocked}
              />
            ) : (
              <div className="p-6 min-h-[70vh] min-w-[600px] grid place-items-center text-muted-foreground">
                Chưa có nội dung
              </div>
            )}

            {/* Annotations — remount theo file để stamp Word không dính sang PDF/PPT */}
            {showAnnotations && (
              <svg
                key={`ann-svg-${annotationKey}`}
                className="absolute inset-0 w-full h-full pointer-events-none"
                preserveAspectRatio="none"
              >
                {filteredItems.map(({ it, origIdx }) => {
                  if (it.kind === "path") {
                    const d = it.points
                      .map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`))
                      .join(" ")
                    return (
                      <path
                        key={origIdx}
                        d={d}
                        stroke={it.color}
                        strokeWidth={it.width}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    )
                  }
                  if (it.kind === "highlight") {
                    return (
                      <rect
                        key={origIdx}
                        x={it.x}
                        y={it.y}
                        width={it.w}
                        height={it.h}
                        fill={it.color}
                        opacity={0.3}
                      />
                    )
                  }
                  if (it.kind === "underline") {
                    return (
                      <line
                        key={origIdx}
                        x1={it.x1}
                        y1={it.y1}
                        x2={it.x2}
                        y2={it.y2}
                        stroke={it.color}
                        strokeWidth={3}
                        strokeLinecap="round"
                      />
                    )
                  }
                  return null
                })}
              </svg>
            )}

            {/* Text items */}
            {showAnnotations &&
              filteredItems.map(({ it, origIdx }) => {
                if (it.kind !== "text") return null
                const selected = selectedTextIdx === origIdx
                return (
                  <div
                    key={origIdx}
                    onPointerDown={(e) => beginTextDrag(e, origIdx, "move")}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedTextIdx(origIdx)
                    }}
                    className={cn(
                      "absolute whitespace-pre leading-none cursor-move transition-shadow",
                      selected
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-card rounded-sm"
                        : "hover:ring-1 hover:ring-primary/40 rounded-sm",
                    )}
                    style={{
                      left: it.x,
                      top: it.y - it.fontSize,
                      color: it.color,
                      fontSize: it.fontSize,
                      padding: "2px 4px",
                    }}
                  >
                    {it.text}
                    {selected && (
                      <button
                        type="button"
                        aria-label="Kéo để phóng to chữ"
                        onPointerDown={(e) => beginTextDrag(e, origIdx, "resize")}
                        className="absolute -right-2 -bottom-2 size-5 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-md cursor-nwse-resize"
                      >
                        <MoveDiagonal className="size-3" />
                      </button>
                    )}
                  </div>
                )
              })}

            {/* Stamps */}
            {showAnnotations &&
              filteredItems.map(({ it, origIdx }) => {
                if (it.kind !== "stamp") return null
                return (
                  <div
                    key={origIdx}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => removeStamp(origIdx)}
                    title="Click để xóa dấu"
                    className="absolute font-heading font-bold select-none drop-shadow-sm cursor-pointer leading-none"
                    style={{
                      left: it.x,
                      top: it.y - it.fontSize,
                      color: it.color,
                      fontSize: it.fontSize,
                    }}
                  >
                    {it.label[0]}
                  </div>
                )
              })}

            {pendingText && canAnnotate && (
              <div
                className="absolute z-10 flex items-start gap-1"
                style={{ left: pendingText.x, top: pendingText.y - 6 }}
              >
                <Input
                  autoFocus
                  value={pendingText.text}
                  onChange={(e) => setPendingText({ ...pendingText, text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmText()
                    if (e.key === "Escape") setPendingText(null)
                  }}
                  className="h-8 w-48"
                  placeholder="Ghi chú..."
                  style={{ color }}
                />
                <Button size="icon" className="size-8" onClick={confirmText} aria-label="Xác nhận">
                  <Check className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hint góc phải phím tắt */}
      {!presentationMode && isFullscreen && (
        <div className="absolute bottom-3 right-3 z-20 bg-card/80 backdrop-blur text-xs text-muted-foreground px-2.5 py-1 rounded border">
          <kbd className="font-mono">+/-</kbd> zoom · <kbd className="font-mono">Esc</kbd> thoát
        </div>
      )}

      {/* Popup thành viên nhóm */}
      {sessionGroupId && sessionId && (
        <GroupMembersDialog
          open={membersOpen}
          onClose={() => setMembersOpen(false)}
          sessionId={sessionId}
          sessionGroupId={sessionGroupId}
          groupLabel={groupLabel ?? title}
          maxScore={maxScore}
        />
      )}
    </div>
  )
}
