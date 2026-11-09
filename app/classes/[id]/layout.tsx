import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getVerifiedAuthFromHeaders } from "@/lib/auth-headers"
import { TeacherShell } from "@/components/teacher-shell"
import { ClassTabs } from "./class-tabs"
import { Users } from "lucide-react"
import { ensureActiveUser } from "@/lib/account-status"

export default async function ClassLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // T2: lấy định danh từ header nội bộ do middleware xác thực — không gọi getUser() nữa.
  const auth = await getVerifiedAuthFromHeaders()
  if (!auth) redirect("/auth/login")
  await ensureActiveUser(auth.id)

  const supabase = await createClient()
  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, capacity, teacher_id, share_token")
    .eq("id", id)
    .single()

  if (!cls || cls.teacher_id !== auth.id) notFound()

  return (
    <TeacherShell email={auth.email}>
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 pt-2.5 pb-2.5">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <h1 className="font-heading text-lg md:text-xl font-bold leading-tight">
                {cls.name}
              </h1>
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1 bg-muted/60 rounded-full px-2 py-0.5">
                <Users className="size-3" aria-hidden="true" />
                Sĩ số {cls.capacity}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="sticky top-[45px] z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4">
          <ClassTabs classId={cls.id} />
        </div>
      </div>
      <div className="bg-muted/40 min-h-[calc(100svh-160px)]">
        <section className="mx-auto max-w-7xl px-4 py-4">{children}</section>
      </div>
    </TeacherShell>
  )
}
