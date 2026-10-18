"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Pen,
  Highlighter,
  Underline,
  Type,
  Undo2,
  Trash2,
  Save,
  Check,
  RotateCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Stamp,
  Hand,
  Eye,
  Users,
  MoreHorizontal,
} from "lucide-react"

export const TOOLBAR_COLORS = [
  { name: "Đỏ", value: "#dc2626" },
  { name: "Xanh", value: "#2563eb" },
  { name: "Vàng", value: "#eab308" },
  { name: "Đen", value: "#111827" },
]

export const TOOLBAR_STAMPS: { mark: string; label: string; color: string }[] = [
  { mark: "✓", label: "Tốt", color: "#16a34a" },
  { mark: "★", label: "Xuất sắc", color: "#ca8a04" },
  { mark: "⚠", label: "Xem lại", color: "#ea580c" },
  { mark: "✗", label: "Sai", color: "#dc2626" },
]

export type AnnotationTool = "pen" | "highlight" | "underline" | "text" | "stamp" | "pan"

function ToolBtn({
  active,
  onClick,
  children,
  label,
  disabled,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        "size-8 rounded-full grid place-items-center transition shrink-0",
        active
          ? "bg-primary text-primary-foreground shadow"
          : disabled
            ? "text-muted-foreground/40 cursor-not-allowed"
            : "hover:bg-muted text-foreground/80",
      )}
    >
      {children}
    </button>
  )
}

export type AnnotationToolbarProps = {
  title: string
  hasText: boolean
  currentIdx: number
  textFontSize: number
  setTextFontSize: (fn: (s: number) => number) => void
  tool: AnnotationTool
  onSwitchTool: (t: AnnotationTool) => void
  canAnnotate: boolean
  stampIdx: number
  setStampIdx: (i: number) => void
  color: string
  setColor: (c: string) => void
  onUndo: () => void
  canUndo: boolean
  onClear: () => void
  isImage: boolean
  onRotate: (delta: number) => void
  zoomText: string | null
  setZoomText: (t: string | null) => void
  zoomLevel: number
  onCommitZoom: () => void
  onNudgeZoom: (delta: number) => void
  score: string
  setScore: (s: string) => void
  maxScore: number
  saving: boolean
  /** T3.3: true = chặn nút Lưu (đang tải lười nét vẽ) */
  saveDisabled?: boolean
  onSave: () => void
  showMembers: boolean
  onOpenMembers: () => void
}

/**
 * Thanh công cụ nổi của màn hình chấm bài.
 * Mobile: chỉ hiện cụm công cụ chính + nút "⋯" để mở rộng phần còn lại.
 */
export function AnnotationToolbar(props: AnnotationToolbarProps) {
  const {
    title,
    hasText,
    currentIdx,
    textFontSize,
    setTextFontSize,
    tool,
    onSwitchTool,
    canAnnotate,
    stampIdx,
    setStampIdx,
    color,
    setColor,
    onUndo,
    canUndo,
    onClear,
    isImage,
    onRotate,
    zoomText,
    setZoomText,
    zoomLevel,
    onCommitZoom,
    onNudgeZoom,
    score,
    setScore,
    maxScore,
    saving,
    saveDisabled = false,
    onSave,
    showMembers,
    onOpenMembers,
  } = props
  const [showMore, setShowMore] = useState(false)

  return (
    <div className="bg-card/95 backdrop-blur border rounded-lg shadow-md px-1.5 py-1 flex items-center gap-1 flex-nowrap max-w-[95vw] overflow-x-auto no-scrollbar">
      <span className="truncate max-w-[16ch] md:max-w-[30ch] text-xs text-muted-foreground shrink-0">
        {title}
      </span>

      <div className="h-6 w-px bg-border shrink-0" />

      {/* Cụm công cụ chính — luôn hiện */}
      <div className="flex items-center gap-0.5 shrink-0">
        <ToolBtn active={tool === "pen"} onClick={() => onSwitchTool("pen")} label="Bút" disabled={!canAnnotate}>
          <Pen className="size-4" />
        </ToolBtn>
        <ToolBtn active={tool === "stamp"} onClick={() => onSwitchTool("stamp")} label="Chấm bài" disabled={!canAnnotate}>
          <Stamp className="size-4" />
        </ToolBtn>
        <ToolBtn active={tool === "pan"} onClick={() => onSwitchTool("pan")} label="Kéo">
          <Hand className="size-4" />
        </ToolBtn>
        <button
          type="button"
          onClick={() => setShowMore((s) => !s)}
          aria-label={showMore ? "Thu gọn công cụ" : "Thêm công cụ"}
          title={showMore ? "Thu gọn" : "Thêm công cụ"}
          className="size-8 rounded-full grid place-items-center transition hover:bg-muted text-foreground/80 md:hidden shrink-0"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      <div className="h-6 w-px bg-border shrink-0" />

      {/* Cụm mở rộng — desktop luôn hiện, mobile hiện khi bấm ⋯ */}
      <div className={cn("items-center gap-1 shrink-0", showMore ? "flex" : "hidden", "md:flex")}>
        {currentIdx === -1 && hasText && (
          <span className="inline-flex items-center gap-1 pl-1.5 border-l border-border shrink-0">
            <Eye className="size-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Cỡ chữ</span>
            <button onClick={() => setTextFontSize((s) => Math.max(12, s - 2))} className="px-1.5 hover:bg-muted rounded">A−</button>
            <span className="tabular-nums text-xs text-foreground">{textFontSize}</span>
            <button onClick={() => setTextFontSize((s) => Math.min(200, s + 2))} className="px-1.5 hover:bg-muted rounded">A+</button>
          </span>
        )}
        <div className="flex items-center gap-0.5">
          <ToolBtn active={tool === "highlight"} onClick={() => onSwitchTool("highlight")} label="Tô màu" disabled={!canAnnotate}>
            <Highlighter className="size-4" />
          </ToolBtn>
          <ToolBtn active={tool === "underline"} onClick={() => onSwitchTool("underline")} label="Gạch chân" disabled={!canAnnotate}>
            <Underline className="size-4" />
          </ToolBtn>
          <ToolBtn active={tool === "text"} onClick={() => onSwitchTool("text")} label="Chèn chữ" disabled={!canAnnotate}>
            <Type className="size-4" />
          </ToolBtn>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Stamps picker (chỉ khi tool = stamp) */}
        {tool === "stamp" && (
          <>
            <div className="flex items-center gap-0.5">
              {TOOLBAR_STAMPS.map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setStampIdx(i)}
                  className={cn(
                    "px-2 h-8 rounded-md text-xs font-semibold whitespace-nowrap transition",
                    stampIdx === i ? "ring-2 ring-offset-1 ring-primary" : "hover:bg-muted",
                  )}
                  style={{ color: s.color }}
                  title={`Chấm bài ${s.label}`}
                >
                  {s.mark} {s.label}
                </button>
              ))}
            </div>
            <div className="h-6 w-px bg-border" />
          </>
        )}

        {/* Colors (chỉ khi không phải stamp) */}
        {tool !== "stamp" && tool !== "pan" && (
          <>
            <div className="flex items-center gap-1">
              {TOOLBAR_COLORS.map((c) => {
                const active = color === c.value
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    aria-label={c.name}
                    title={c.name}
                    className={cn(
                      "size-6 rounded-full transition shadow-sm grid place-items-center",
                      active ? "ring-2 ring-offset-1 ring-foreground scale-110" : "hover:scale-110",
                    )}
                    style={{ backgroundColor: c.value }}
                  >
                    {active ? (
                      <Check
                        className="size-3"
                        style={{ color: c.value === "#eab308" ? "#111827" : "#ffffff" }}
                      />
                    ) : null}
                  </button>
                )
              })}
            </div>
            <div className="h-6 w-px bg-border" />
          </>
        )}

        {/* Undo / clear / rotate */}
        <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} className="size-8 rounded-full text-foreground" aria-label="Hoàn tác">
          <Undo2 className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onClear} className="size-8 rounded-full text-foreground" aria-label="Xóa hết">
          <Trash2 className="size-4" />
        </Button>
        {isImage && (
          <>
            <Button variant="ghost" size="icon" onClick={() => onRotate(-90)} className="size-8 rounded-full text-foreground" aria-label="Xoay trái">
              <RotateCcw className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onRotate(90)} className="size-8 rounded-full text-foreground" aria-label="Xoay phải">
              <RotateCw className="size-4" />
            </Button>
          </>
        )}

        <div className="h-6 w-px bg-border" />

        {/* Zoom */}
        <Button variant="ghost" size="icon" onClick={() => onNudgeZoom(-0.25)} className="size-8 rounded-full text-foreground" aria-label="Thu nhỏ">
          <ZoomOut className="size-4" />
        </Button>
        <div className="flex items-center" title="Nhập % zoom rồi Enter (phím 0 = 100%)">
          <Input
            className="w-[54px] h-7 text-xs text-center tabular-nums px-1"
            value={zoomText ?? String(Math.round(zoomLevel * 100))}
            onChange={(e) => setZoomText(e.target.value)}
            onBlur={onCommitZoom}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
              if (e.key === "Escape") setZoomText(null)
            }}
            aria-label="Mức zoom phần trăm"
          />
          <span className="text-xs text-muted-foreground pl-0.5 pr-1">%</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onNudgeZoom(0.25)} className="size-8 rounded-full text-foreground" aria-label="Phóng to">
          <ZoomIn className="size-4" />
        </Button>
      </div>

      <div className="h-6 w-px bg-border shrink-0" />

      {/* Score + Save + Members — luôn hiện */}
      <div className="flex items-center gap-1 shrink-0">
        <Input
          className="w-14 h-8 text-sm text-foreground"
          type="number"
          min={0}
          max={maxScore}
          step={0.25}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="—"
          aria-label="Điểm"
        />
        <span className="text-xs text-muted-foreground">/{maxScore}</span>
      </div>
      <Button onClick={onSave} disabled={saving || saveDisabled} size="sm" className="rounded-full gap-1.5 h-8 px-3 shrink-0">
        <Save className="size-3.5" />
        {saving ? "Lưu..." : "Lưu"}
      </Button>
      {showMembers && (
        <Button
          onClick={onOpenMembers}
          size="sm"
          variant="outline"
          className="rounded-full gap-1.5 h-8 px-3 shrink-0"
          title="Xem thành viên nhóm, random gọi báo cáo, sửa điểm từng em"
        >
          <Users className="size-3.5" />
          <span className="hidden sm:inline">Thành Viên</span>
        </Button>
      )}
    </div>
  )
}
