import { requireAdmin } from "@/lib/admin"
import { AdminShell } from "@/components/admin-shell"
import { PLAN_DEFAULT, type Plan } from "@/lib/plans"
import { EmptyState } from "@/components/empty-state"
import { Users } from "lucide-react"
import { AccountsTable, type AdminAccountRow } from "@/app/admin/accounts-table"

type AccountStatus = "active" | "disabled"
type AccountRole = "user" | "admin"

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

  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]))

  const accounts: AdminAccountRow[] = (authData.users ?? []).map((u) => {
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

  const freeCount = accounts.filter((a) => a.plan === "free").length
  const proCount = accounts.filter((a) => a.plan === "pro").length
  const schoolCount = accounts.filter((a) => a.plan === "school").length
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
          <StatCard label="Free" value={freeCount} />
          <StatCard label="Pro" value={proCount} />
          <StatCard label="School" value={schoolCount} />
          <StatCard label="Đã chấm dứt" value={disabledCount} />
        </div>

        <AccountsTable accounts={accounts} />
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
