"use client"

import { useState, useTransition } from "react"
import { setAccountStatusAction } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function AccountStatusButtons({
  userId,
  email,
  status,
  locked,
}: {
  userId: string
  email: string
  status: "active" | "disabled"
  locked?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const nextStatus = status === "disabled" ? "active" : "disabled"
  const label = status === "disabled" ? "Kích hoạt" : "Chấm dứt"
  const confirmTitle = status === "disabled" ? "Kích hoạt tài khoản?" : "Chấm dứt tài khoản?"
  const confirmBody =
    status === "disabled"
      ? `${email} sẽ đăng nhập và dùng lại được.`
      : `${email} sẽ không đăng nhập được cho đến khi được kích hoạt lại.`

  if (locked) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={status === "disabled" ? "default" : "destructive"}
            disabled={pending}
          >
            {pending ? "Đang xử lý…" : label}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className={status === "active" ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
              onClick={() => {
                setError(null)
                startTransition(async () => {
                  try {
                    await setAccountStatusAction(userId, nextStatus)
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Không thực hiện được.")
                  }
                })
              }}
            >
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
