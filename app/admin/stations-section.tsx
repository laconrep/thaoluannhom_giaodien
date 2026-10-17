import { Server } from "lucide-react"
import { isMissingSchemaError } from "@/lib/ai/schema-error"
import type { BackendStationRow, TeacherBackendMapRow } from "@/lib/types"
import type { createAdminClient } from "@/lib/supabase/admin"
import { StationManager } from "@/app/admin/station-manager"
import { StationAssignTable } from "@/app/admin/station-assign-table"

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

const FARM_MIGRATION_HINT =
  "Chưa có bảng trạm chấm. Chạy supabase-migrations/006_farm_stations.sql trong SQL Editor."

export async function StationsSection({
  admin,
  accounts,
}: {
  admin: AdminClient
  accounts: { id: string; email: string }[]
}) {
  const [{ data: stations, error: stationsError }, { data: mapping, error: mapError }] =
    await Promise.all([
      admin
        .from("backend_stations")
        .select("id, label, status, notes, created_at")
        .order("created_at", { ascending: true }),
      admin.from("teacher_backend_map").select("teacher_id, station_id, updated_at"),
    ])

  if (isMissingSchemaError(stationsError) || isMissingSchemaError(mapError)) {
    return (
      <section className="mx-auto max-w-6xl px-4 pb-8">
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground flex gap-3">
          <Server className="size-4 mt-0.5 shrink-0" />
          <p>{FARM_MIGRATION_HINT}</p>
        </div>
      </section>
    )
  }

  const stationRows = (stations ?? []) as BackendStationRow[]
  const mapRows = (mapping ?? []) as TeacherBackendMapRow[]
  const mapByTeacher = new Map(mapRows.map((r) => [r.teacher_id, r.station_id]))
  const countByStation = new Map<string, number>()
  for (const r of mapRows) countByStation.set(r.station_id, (countByStation.get(r.station_id) ?? 0) + 1)

  return (
    <section className="mx-auto max-w-6xl px-4 pb-8 flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="font-heading text-xl md:text-2xl font-bold flex items-center gap-2">
          <Server className="size-5" /> Trạm chấm (farm)
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Mỗi trạm là một tài khoản Muse riêng. Job chấm của giáo viên được gán về trạm của họ;
          giáo viên chưa gán trạm thì job về trạm chính. Trạm tạm dừng: dừng hook của trạm đó.
        </p>
        {(stationsError || mapError) && (
          <p className="text-sm text-destructive">
            Không đọc đủ dữ liệu trạm: {stationsError?.message ?? mapError?.message}
          </p>
        )}
      </header>

      <StationManager stations={stationRows} countByStation={Object.fromEntries(countByStation)} />
      <StationAssignTable accounts={accounts} stations={stationRows} mapByTeacher={Object.fromEntries(mapByTeacher)} />
    </section>
  )
}
