"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createClassAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { defaultGroupCount } from "@/lib/utils"
import { setSeen, TOUR_DASHBOARD_SEEN_KEY, STOP_EVENT, RESTART_EVENT } from "@/components/tour/tour-store"

export function CreateClassCard() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Số nhóm gợi ý theo sĩ số (~6 HS/nhóm) — đổi sĩ số thì gợi ý theo, trừ khi
  // giáo viên đã sửa tay số nhóm.
  const [capacity, setCapacity] = useState(48)
  const [numGroups, setNumGroups] = useState(() => defaultGroupCount(48))
  const [numGroupsTouched, setNumGroupsTouched] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const onRestart = () => setOpen(false)
    window.addEventListener(RESTART_EVENT, onRestart)
    return () => window.removeEventListener(RESTART_EVENT, onRestart)
  }, [])

  if (!open) {
    return (
      <div data-tour="create-class">
        <Button
          size="lg"
          onClick={() => {
            setSeen(TOUR_DASHBOARD_SEEN_KEY)
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent(STOP_EVENT))
            }
            setOpen(true)
          }}
          className="gap-2"
        >
          <Plus className="size-4" aria-hidden="true" />
          Tạo lớp mới
        </Button>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tạo lớp mới</CardTitle>
        <CardDescription>
          Sĩ số là số chỗ cho học sinh. Mỗi học sinh sẽ có một ô riêng dùng cho mọi buổi học.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={async (fd) => {
            setError(null)
            startTransition(async () => {
              try {
                const result = await createClassAction(fd)
                if (!result.ok) {
                  setError(result.error)
                  return
                }
                toast.success(`Đã tạo lớp ${String(fd.get("name") ?? "").trim() || "mới"}`)
                router.push(`/classes/${result.classId}/roster`)
              } catch (caught) {
                const digest = (caught as { digest?: string } | null)?.digest ?? ""
                if (digest.startsWith("NEXT_REDIRECT")) return
                const message =
                  caught instanceof Error ? caught.message : "Không thể tạo lớp. Vui lòng thử lại."
                setError(message)
              }
            })
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Tên lớp</FieldLabel>
              <Input id="name" name="name" placeholder="Ví dụ: 12A1 - Văn" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="capacity">Sĩ số</FieldLabel>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                max={80}
                value={capacity}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(80, Number(e.target.value) || 1))
                  setCapacity(v)
                  if (!numGroupsTouched) setNumGroups(defaultGroupCount(v))
                }}
                required
              />
              <FieldDescription>Mặc định 48. Có thể điều chỉnh sau.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="numGroups">Số nhóm cố định</FieldLabel>
              <Input
                id="numGroups"
                name="numGroups"
                type="number"
                min={2}
                max={12}
                value={numGroups}
                onChange={(e) => {
                  setNumGroupsTouched(true)
                  setNumGroups(Math.max(2, Math.min(12, Number(e.target.value) || 2)))
                }}
                required
              />
              <FieldDescription>
                Khoảng 6 học sinh/nhóm, tự gợi ý theo sĩ số. Đổi được sau ở tab Danh sách &amp;
                nhóm.
              </FieldDescription>
            </Field>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending && <Spinner className="mr-2" />}
                Tạo lớp
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Hủy
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
