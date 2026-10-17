"use client"

import { useState, useTransition } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BackendStationRow } from "@/lib/types"
import { assignTeacherStationAction } from "@/app/admin/farm-actions"

export function StationAssignTable({
  accounts,
  stations,
  mapByTeacher,
}: {
  accounts: { id: string; email: string }[]
  stations: BackendStationRow[]
  mapByTeacher: Record<string, string>
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function onChange(teacherId: string, value: string) {
    setError(null)
    setPendingId(teacherId)
    startTransition(async () => {
      try {
        await assignTeacherStationAction(teacherId, value === "__default" ? null : value)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gán trạm thất bại.")
      } finally {
        setPendingId(null)
      }
    })
  }

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-3">
      <h3 className="font-semibold text-sm">Gán giáo viên → trạm</h3>
      <p className="text-xs text-muted-foreground">
        Giáo viên để "Trạm chính (mặc định)" thì job chấm về trạm chính của admin.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              <th className="py-2 pr-4 font-medium">Giáo viên</th>
              <th className="py-2 font-medium">Trạm chấm</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const current = mapByTeacher[a.id] ?? "__default"
              return (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 truncate max-w-64">{a.email}</td>
                  <td className="py-2">
                    <Select
                      value={current}
                      disabled={pendingId === a.id}
                      onValueChange={(v) => {
                        if (v !== current) onChange(a.id, v)
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs w-56" aria-label={`Trạm chấm của ${a.email}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default">Trạm chính (mặc định)</SelectItem>
                        {stations
                          .filter((s) => s.id !== "local")
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id} disabled={s.status === "paused"}>
                              {s.label} · {s.id}
                              {s.status === "paused" ? " (tạm dừng)" : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
