"use client"

import { useMemo, useState } from "react"
import { PLANS, type Plan } from "@/lib/plans"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/empty-state"
import { formatDateShort } from "@/lib/utils-format"
import { Users } from "lucide-react"
import { AccountStatusButtons } from "@/app/admin/account-status-buttons"
import { AccountPlanSelect } from "@/app/admin/account-plan-select"

export type AdminAccountRow = {
  id: string
  email: string
  createdAt: string | null
  lastSignInAt: string | null
  plan: Plan
  role: "user" | "admin"
  status: "active" | "disabled"
}

export function AccountsTable({ accounts }: { accounts: AdminAccountRow[] }) {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () => (q ? accounts.filter((a) => a.email.toLowerCase().includes(q)) : accounts),
    [accounts, q],
  )
  const byPlan: Record<Plan, AdminAccountRow[]> = {
    free: filtered.filter((a) => a.plan === "free"),
    pro: filtered.filter((a) => a.plan === "pro"),
    school: filtered.filter((a) => a.plan === "school"),
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm email…"
        aria-label="Tìm email tài khoản"
        className="max-w-sm"
      />
      {q && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} kết quả cho “{query.trim()}”
        </p>
      )}
      {PLANS.map((plan) => (
        <PlanBlock key={plan.id} title={plan.name} planId={plan.id} rows={byPlan[plan.id]} />
      ))}
    </div>
  )
}

function PlanBlock({
  title,
  planId,
  rows,
}: {
  title: string
  planId: Plan
  rows: AdminAccountRow[]
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-baseline justify-between gap-3">
        <h2 className="font-heading font-semibold">Gói {title}</h2>
        <p className="text-xs text-muted-foreground">{rows.length} tài khoản</p>
      </div>
      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={Users}
            title={`Chưa có tài khoản gói ${planId}`}
            description="Khi có giáo viên đăng ký hoặc được đổi sang gói này, email sẽ hiện ở đây."
            className="py-8 border-0 bg-transparent"
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead>Đăng nhập gần nhất</TableHead>
              <TableHead>Gói</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Quyền</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.email}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.createdAt ? formatDateShort(row.createdAt) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.lastSignInAt ? formatDateShort(row.lastSignInAt) : "—"}
                </TableCell>
                <TableCell>
                  <AccountPlanSelect userId={row.id} email={row.email} currentPlan={row.plan} />
                </TableCell>
                <TableCell>
                  <Badge variant={row.status === "disabled" ? "destructive" : "secondary"}>
                    {row.status === "disabled" ? "Đã chấm dứt" : "Đang hoạt động"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={row.role === "admin" ? "default" : "outline"}>
                    {row.role === "admin" ? "Admin" : "User"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <AccountStatusButtons
                    userId={row.id}
                    email={row.email}
                    status={row.status}
                    locked={row.role === "admin"}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
