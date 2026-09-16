"use client"

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Placeholder from "@tiptap/extension-placeholder"
import Image from "@tiptap/extension-image"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  MAX_SUBMISSION_IMAGE_BYTES,
  SUBMISSION_IMAGE_ACCEPT,
  SUBMISSION_IMAGE_MIME_TYPES,
  submissionMediaPath,
  submissionMediaSignedUploadUrl,
} from "@/lib/submission-media"

export type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  /** false: chặn dán nội dung từ nơi khác (nút chèn ảnh vẫn hoạt động). */
  allowPaste?: boolean
  placeholder?: string
  minHeight?: string | number
  className?: string
  /** Bối cảnh đặt ảnh trong bucket submission-media. Thiếu thì ẩn nút chèn ảnh. */
  uploadContext?: { sessionId: string; targetId: string }
}

type ToolbarButtonProps = {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

function ToolbarButton({ label, active, disabled, onClick, children }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant={active ? "secondary" : "ghost"}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

// Trình soạn thảo HTML cho bài nộp (bảng + ảnh).
// `value` ⇄ `onChange` giữ HTML ra ngoài, không nhúng ảnh base64.
export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  allowPaste = true,
  placeholder,
  minHeight = 320,
  className,
  uploadContext,
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange)
  const allowPasteRef = useRef(allowPaste)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    allowPasteRef.current = allowPaste
  }, [allowPaste])

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({ underline: false }),
      Underline,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Image.configure({ allowBase64: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "submission-rich-text rich-text-editor__content",
      },
    },
    onUpdate: ({ editor: current }) => {
      onChangeRef.current(current.isEmpty ? "" : current.getHTML())
    },
  })

  // Bật/tắt theo `disabled` mà không cần khởi tạo lại editor.
  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  // Đồng bộ khi giá trị bên ngoài đổi (ví dụ tải lại bài cũ), tránh vòng lặp onChange.
  useEffect(() => {
    if (!editor) return
    const next = value || ""
    const currentHtml = editor.isEmpty ? "" : editor.getHTML()
    if (next === currentHtml) return
    editor.commands.setContent(next, { emitUpdate: false })
  }, [editor, value])

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null
      return {
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        underline: current.isActive("underline"),
        strike: current.isActive("strike"),
        h1: current.isActive("heading", { level: 1 }),
        h2: current.isActive("heading", { level: 2 }),
        h3: current.isActive("heading", { level: 3 }),
        bulletList: current.isActive("bulletList"),
        orderedList: current.isActive("orderedList"),
        inTable: current.isActive("table"),
        canMergeCells: current.can().mergeCells(),
        canSplitCell: current.can().splitCell(),
        canUndo: current.can().undo(),
        canRedo: current.can().redo(),
      }
    },
  })

  async function handleImageFile(file: File | undefined) {
    if (!file) return
    if (!SUBMISSION_IMAGE_MIME_TYPES.includes(file.type)) {
      toast.error("Chỉ hỗ trợ ảnh PNG, JPG, WEBP hoặc GIF.")
      return
    }
    if (file.size > MAX_SUBMISSION_IMAGE_BYTES) {
      toast.error(`Ảnh tối đa ${Math.round(MAX_SUBMISSION_IMAGE_BYTES / 1024 / 1024)} MB.`)
      return
    }
    if (!uploadContext) {
      toast.error("Chưa xác định được vị trí lưu ảnh.")
      return
    }

    setUploadingImage(true)
    try {
      const path = submissionMediaPath({
        sessionId: uploadContext.sessionId,
        targetId: uploadContext.targetId,
        fileName: file.name,
      })
      const res = await fetch("/api/submissions/inline-image-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.upload?.token || !body?.publicUrl) {
        throw new Error(body?.error ?? "Không tạo được đường dẫn tải ảnh.")
      }

      const uploadRes = await fetch(submissionMediaSignedUploadUrl(body.upload.path, body.upload.token), {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })
      if (!uploadRes.ok) throw new Error("Tải ảnh lên kho lưu trữ thất bại.")

      editor?.chain().focus().setImage({ src: body.publicUrl, alt: file.name }).run()
    } catch (error: any) {
      toast.error(error?.message || "Có lỗi khi chèn ảnh.")
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const isDisabled = disabled || !editor
  const imageDisabled = isDisabled || uploadingImage || !uploadContext
  const minHeightValue = typeof minHeight === "number" ? `${minHeight}px` : minHeight

  return (
    <div
      className={cn("rich-text-editor", className)}
      data-disabled={isDisabled ? "true" : undefined}
      style={{ "--rte-min-height": minHeightValue } as CSSProperties}
    >
      <div className="rich-text-editor__toolbar" role="toolbar" aria-label="Định dạng văn bản">
        <ToolbarButton
          label="Đậm"
          active={state?.bold}
          disabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label="Nghiêng"
          active={state?.italic}
          disabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label="Gạch chân"
          active={state?.underline}
          disabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Gạch ngang"
          active={state?.strike}
          disabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough />
        </ToolbarButton>

        <span className="rich-text-editor__separator" aria-hidden="true" />

        <ToolbarButton
          label="Tiêu đề lớn"
          active={state?.h1}
          disabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 />
        </ToolbarButton>
        <ToolbarButton
          label="Tiêu đề vừa"
          active={state?.h2}
          disabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 />
        </ToolbarButton>
        <ToolbarButton
          label="Tiêu đề nhỏ"
          active={state?.h3}
          disabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 />
        </ToolbarButton>

        <span className="rich-text-editor__separator" aria-hidden="true" />

        <ToolbarButton
          label="Danh sách chấm"
          active={state?.bulletList}
          disabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label="Danh sách số"
          active={state?.orderedList}
          disabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>

        <span className="rich-text-editor__separator" aria-hidden="true" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant={state?.inTable ? "secondary" : "ghost"}
              aria-label="Bảng"
              title="Bảng"
              disabled={isDisabled}
            >
              <TableIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem
              onSelect={() =>
                editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
            >
              <TableIcon /> Chèn bảng 3 × 3
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!state?.inTable}
              onSelect={() => editor?.chain().focus().addRowBefore().run()}
            >
              Thêm hàng bên trên
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!state?.inTable}
              onSelect={() => editor?.chain().focus().addRowAfter().run()}
            >
              Thêm hàng bên dưới
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!state?.inTable}
              onSelect={() => editor?.chain().focus().deleteRow().run()}
            >
              Xoá hàng
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!state?.inTable}
              onSelect={() => editor?.chain().focus().addColumnBefore().run()}
            >
              Thêm cột bên trái
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!state?.inTable}
              onSelect={() => editor?.chain().focus().addColumnAfter().run()}
            >
              Thêm cột bên phải
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!state?.inTable}
              onSelect={() => editor?.chain().focus().deleteColumn().run()}
            >
              Xoá cột
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!state?.inTable}
              onSelect={() => editor?.chain().focus().toggleHeaderRow().run()}
            >
              Bật/tắt hàng tiêu đề
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!state?.canMergeCells}
              onSelect={() => editor?.chain().focus().mergeCells().run()}
            >
              Gộp ô đang chọn
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!state?.canSplitCell}
              onSelect={() => editor?.chain().focus().splitCell().run()}
            >
              Tách ô
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={!state?.inTable}
              onSelect={() => editor?.chain().focus().deleteTable().run()}
            >
              <Trash2 /> Xoá bảng
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarButton
          label={uploadingImage ? "Đang tải ảnh" : "Chèn ảnh"}
          disabled={imageDisabled}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadingImage ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        </ToolbarButton>

        <span className="rich-text-editor__separator" aria-hidden="true" />

        <ToolbarButton
          label="Hoàn tác"
          disabled={isDisabled || !state?.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 />
        </ToolbarButton>
        <ToolbarButton
          label="Làm lại"
          disabled={isDisabled || !state?.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 />
        </ToolbarButton>
      </div>

      <div className="rich-text-editor__body">
        <EditorContent editor={editor} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={SUBMISSION_IMAGE_ACCEPT}
        className="hidden"
        onChange={(event) => handleImageFile(event.target.files?.[0])}
      />
    </div>
  )
}
