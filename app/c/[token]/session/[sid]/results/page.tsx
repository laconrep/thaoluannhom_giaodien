import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { SessionRow } from "@/lib/types"
import { ResultsViewer } from "./results-viewer"

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ token: string; sid: string }>
}) {
  const { token, sid } = await params
  const supabase = await createClient()

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name")
    .eq("share_token", token)
    .maybeSingle()
  if (!cls) notFound()

  const { data: session } = await supabase
    .from("sessions")
    .select("id, class_id, title, kind, allow_download, results_shared_at")
    .eq("id", sid)
    .eq("class_id", cls.id)
    .maybeSingle()
  if (!session) notFound()
  if (!session.results_shared_at) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/20">
        <div className="max-w-md text-center space-y-4 p-8 bg-card rounded-xl shadow-sm border">
          <div className="size-16 rounded-full bg-muted mx-auto flex items-center justify-center text-3xl">
            ⏳
          </div>
          <h1 className="text-xl font-semibold">Kết quả chưa được chia sẻ</h1>
          <p className="text-muted-foreground text-sm">
            Giáo viên chưa mở chia sẻ kết quả cho phiên thảo luận này. Em vui lòng quay lại sau.
          </p>
        </div>
      </div>
    )
  }

  // Bảo mật 24/10/2026 (GĐ3): trang này CHỈ gửi danh sách tên lớp xuống client
  // (để hiện màn chọn tên). Bài nộp/điểm/nhận xét của từng em được lấy qua
  // server action getOwnResultsAction — server đối chiếu device_token rồi chỉ
  // trả đúng bài của em đó, không bao giờ gửi device_token hay bài của bạn
  // khác xuống trình duyệt.
  const { data: students } = await supabase
    .from("students")
    .select("id, slot_number, name")
    .eq("class_id", cls.id)
    .order("slot_number", { ascending: true })

  return (
    <ResultsViewer
      classId={cls.id as string}
      className={cls.name as string}
      session={session as unknown as SessionRow}
      students={(students ?? []) as { id: string; slot_number: number; name: string | null }[]}
    />
  )
}
