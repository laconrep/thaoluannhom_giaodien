"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import type { BackendStationRow } from "@/lib/types"
import {
  createStationAction,
  deleteStationAction,
  setStationStatusAction,
} from "@/app/admin/farm-actions"

export function StationManager({
  stations,
  countByStation,
}: {
  stations: BackendStationRow[]
  countByStation: Record<string, number>
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [id, setId] = useState("")
  const [label, setLabel] = useState("")
  const [notes, setNotes] = useState("")

  function run(fn: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Thao tác thất bại.")
      }
    })
  }

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-4">
      <h3 className="font-semibold text-sm">Danh sách trạm</h3>

      <ul className="flex flex-col gap-2">
        {stations.map((s) => {
          const teachers = countByStation[s.id] ?? 0
          const paused = s.status === "paused"
          return (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">
                  {s.label} <span className="text-muted-foreground font-normal">· {s.id}</span>
                </span>
                {s.notes && <span className="text-xs text-muted-foreground truncate">{s.notes}</span>}
              </div>
              <Badge variant={paused ? "secondary" : "default"} className="ml-auto">
                {paused ? "Tạm dừng" : "Hoạt động"}
              </Badge>
              <Badge variant="outline">{teachers} giáo viên</Badge>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="sm" variant="outline" disabled={pending}>
                    {paused ? "Kích hoạt" : "Tạm dừng"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {paused ? "Kích hoạt trạm?" : "Tạm dừng trạm?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {paused
                        ? `Trạm "${s.label}" sẽ nhận job chấm trở lại.`
                        : `Trạm "${s.label}" sẽ không nhận job mới. Nhớ dừng hook của trạm này.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        run(() => setStationStatusAction(s.id, paused ? "active" : "paused"))
                      }
                    >
                      Xác nhận
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {s.id !== "local" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" size="sm" variant="destructive" disabled={pending}>
                      Xóa
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xóa trạm "{s.label}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Chỉ xóa được khi không còn giáo viên nào gán vào trạm này.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                      <AlertDialogAction onClick={() => run(() => deleteStationAction(s.id))}>
                        Xóa trạm
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </li>
          )
        })}
        {stations.length === 0 && (
          <li className="text-sm text-muted-foreground">Chưa có trạm nào.</li>
        )}
      </ul>

      <form
        className="flex flex-wrap items-end gap-2 border-t pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(async () => {
            await createStationAction(id, label, notes)
            setId("")
            setLabel("")
            setNotes("")
          })
        }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="station-id">ID trạm</label>
          <Input
            id="station-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="vd: tram-b"
            className="h-8 text-sm w-36"
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="station-label">Tên trạm</label>
          <Input
            id="station-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="vd: Trạm B — cô Lan"
            className="h-8 text-sm w-48"
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="station-notes">Ghi chú</label>
          <Input
            id="station-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tùy chọn"
            className="h-8 text-sm w-48"
            disabled={pending}
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Đang thêm…" : "Thêm trạm"}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
