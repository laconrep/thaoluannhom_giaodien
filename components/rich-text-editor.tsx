"use client"

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react"
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  /** false: chặn dán nội dung từ nơi khác (nút chèn ảnh vẫn hoạt động). */
  allowPaste?: boolean
  placeholder?: string
  minHeight?: string | number
  className?: string
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
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange)
  const allowPasteRef = useRef(allowPaste)

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
        canUndo: current.can().undo(),
        canRedo: current.can().redo(),
      }
    },
  })

  const isDisabled = disabled || !editor
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
    </div>
  )
}
