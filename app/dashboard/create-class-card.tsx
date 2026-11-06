"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClassAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Plus } from "lucide-react"
import { setSeen, TOUR_DASHBOARD_SEEN_KEY, STOP_EVENT, RESTART_EVENT } from "@/components/tour/tour-store"

export function CreateClassCard() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Luật BVDL cá nhân 91/2025, Điều 24: học sinh là trẻ em — chỉ nhập dữ
  // liệu khi đã được cha mẹ/người giám hộ đồng ý.
  const [guardianConsent, setGuardianConsent] = useState(false)

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
            fd.set("guardianConsent", guardianConsent ? "on" : "")
            startTransition(async () => {
              try {
                const result = await createClassAction(fd)
                if (!result.ok) {
                  setError(result.error)
                  return
                }
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
                defaultValue={48}
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
                defaultValue={8}
                required
              />
              <FieldDescription>
                Mỗi phiên thảo luận nhóm sẽ dùng cấu trúc này. Có thể thay đổi sau.
              </FieldDescription>
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                id="guardian-consent"
                checked={guardianConsent}
                onCheckedChange={(v) => setGuardianConsent(v === true)}
                className="mt-0.5"
              />
              <span>
                Tôi xác nhận đã thông báo và được cha mẹ/người giám hộ của học sinh đồng ý cho
                các em sử dụng ứng dụng (nhập tên, nộp bài, chấm điểm) theo{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Chính sách bảo mật
                </Link>
                .
              </span>
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending || !guardianConsent}>
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
