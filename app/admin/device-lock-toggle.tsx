"use client"

import { useState, useTransition } from "react"
import { setNoDeviceLockAction } from "@/app/admin/actions"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export function DeviceLockToggle({
  userId,
  email,
  noDeviceLock,
}: {
  userId: string
  email: string
  noDeviceLock: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Hiển thị theo nghĩa "Khóa thiết bị": bật = đang khóa (mặc định)
  const locked = !noDeviceLock

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <Switch
          id={`devlock-${userId}`}
          checked={locked}
          disabled={pending}
          onCheckedChange={(checked) => {
            setError(null)
            startTransition(async () => {
              try {
                // checked=true nghĩa là đang khóa → no_device_lock=false
                await setNoDeviceLockAction(userId, !checked)
              } catch (e) {
                setError(e instanceof Error ? e.message : "Không thực hiện được.")
              }
            })
          }}
          aria-label={`Khóa thiết bị cho ${email}`}
        />
        <Label htmlFor={`devlock-${userId}`} className="text-xs text-muted-foreground">
          {pending ? "Đang lưu…" : locked ? "Đang khóa" : "Đã tắt"}
        </Label>
      </div>
      {error && <p className="text-xs text-destructive max-w-48">{error}</p>}
    </div>
  )
}
