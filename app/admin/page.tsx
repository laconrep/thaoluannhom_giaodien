import { requireAdmin } from "@/lib/admin"
import { AdminShell } from "@/components/admin-shell"
import { PLANS, PLAN_DEFAULT, type Plan } from "@/lib/plans"
import { Badge } from "@/components/ui/badge"
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

type AccountStatus = "active" | "disabled"
type AccountRole = "user" | "admin"

type AccountRow = {
  id: string
  email: string
  createdAt: string | null
  lastSignInAt: string | null
  plan: Plan
  role: AccountRole
  status: AccountStatus
}

function asPlan(value: unknown): Plan {
  if (value === "free" || value === "pro" || value === "school") return value
  return PLAN_DEFAULT
}

function asStatus(value: unknown): AccountStatus {
  return value === "disabled" ? "disabled" : "active"
}

function asRole(value: unknown, email: string): AccountRole {
  if (value === "admin") return "admin"
  if (email.trim().toLowerCase() === "gagabux95@gmail.com") return "admin"
  return "user"
}

export default async function AdminPage() {
  const { user, admin } = await requireAdmin()

  if (!admin) {
    return (
      <AdminShell email={user.email}>
        <section className="mx-auto max-w-6xl px-4 py-8">
          <EmptyState
            icon={Users}
            title="Không đọc được danh sách tài khoản"
            description="Thiếu quyền service role. Cần SUPABASE_SERVICE_ROLE_KEY để liệt kê email từ auth.users."
          />
        </section>
      </AdminShell>
    )
  }

  const [{ data: authData, error: authError }, { data: profiles, error: profileError }] =
    await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("profiles").select("id, plan, role, status, updated_at"),
    ])

  if (authError) {
    return (
      <AdminShell email={user.email}>
        <section className="mx-auto max-w-6xl px-4 py-8">
          <EmptyState
            icon={Users}
            title="Không đọc được danh sách tài khoản"
            description={authError.message}
          />
        </section>
      </AdminShell>
    )
  }

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id as string, p]),
  )

  const accounts: AccountRow[] = (authData.users ?? []).map((u) => {
    const profile = profileById.get(u.id)
    const email = u.email ?? "(không có email)"
    return {
      id: u.id,
      email,
      createdAt: u.created_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
      plan: asPlan(profile?.plan),
      role: asRole(profile?.role, email),
      status: asStatus(profile?.status),
    }
  })

  const byPlan: Record<Plan, AccountRow[]> = {
    free: accounts.filter((a) => a.plan === "free"),
    pro: accounts.filter((a) => a.plan === "pro"),
    school: accounts.filter((a) => a.plan === "school"),
  }
  const disabledCount = accounts.filter((a) => a.status === "disabled").length

  return (
    <AdminShell email={user.email}>
      <section className="mx-auto max-w-6xl px-4 py-8 flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl md:text-3xl font-bold">Tài khoản</h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Email đăng ký theo gói. Có thể kích hoạt, chấm dứt hoặc đổi gói tài khoản.
          </p>
          {profileError && (
            <p className="text-sm text-destructive">
              Không đọc đủ profiles: {profileError.message}. Gói mặc định là free.
            </p>
          )}
        </header>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Tổng" value={accounts.length} />
          <StatCard label="Free" value={byPlan.free.length} />
          <StatCard label="Pro" value={byPlan.pro.length} />
          <StatCard label="School" value={byPlan.school.length} />
          <StatCard label="Đã chấm dứt" value={disabledCount} />
        </div>

        {PLANS.map((plan) => (
          <PlanBlock key={plan.id} title={plan.name} planId={plan.id} rows={byPlan[plan.id]} />
        ))}
      </section>
    </AdminShell>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-bold leading-tight mt-1">{value}</p>
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
  rows: AccountRow[]
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-baseline justify-between gap-3">
        <h2 className="font-heading font-semibold">
          Gói {title}
        </h2>
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
