import { requireAdmin } from "@/lib/admin"
import { ensureActiveUser } from "@/lib/account-status"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin()
  await ensureActiveUser(user.id)
  return <>{children}</>
}
