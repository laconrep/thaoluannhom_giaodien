import { redirect } from "next/navigation"
import Link from "next/link"
import { getVerifiedAuthFromHeaders } from "@/lib/auth-headers"
import { Button } from "@/components/ui/button"
import {
  GraduationCap,
  Users,
  Presentation,
  PenLine,
  BookOpen,
  ClipboardList,
  type LucideIcon,
} from "lucide-react"

// Khung phong cách viễn tưởng: vát góc (clip-path) thay cho bo tròn,
// viền gradient 1.5px + bóng glow ôm theo hình vát (drop-shadow).
const FRAME_CLIP =
  "[clip-path:polygon(14px_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%,0_14px)]"
const CHIP_CLIP =
  "[clip-path:polygon(6px_0,100%_0,100%_calc(100%-6px),calc(100%-6px)_100%,0_100%,0_6px)]"

type FeatureTone = {
  // Gradient của viền khung + vạch năng lượng.
  frame: string
  // Màu đốm sáng góc trên-phải bên trong khung.
  glow: string
  // Màu chip icon.
  chip: string
  // Bóng glow ôm theo hình vát (drop-shadow, không bị clip-path cắt).
  shadow: string
  shadowHover: string
}

function FeatureCard({
  tone,
  icon: Icon,
  title,
  desc,
}: {
  tone: FeatureTone
  icon: LucideIcon
  title: string
  desc: string
}) {
  return (
    <li
      className={`h-full min-w-0 ${FRAME_CLIP} bg-gradient-to-br p-[1.5px] ${tone.frame} ${tone.shadow} transition duration-300 hover:-translate-y-1 ${tone.shadowHover}`}
    >
      <div className="relative flex h-full flex-col gap-2.5 overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 p-4">
        {/* Ánh sáng nền + vệt sáng chéo, giữ chữ luôn đọc được. */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -right-10 -top-10 size-28 rounded-full opacity-25 blur-2xl ${tone.glow}`}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-transparent"
        />
        <span
          className={`relative grid size-10 shrink-0 place-items-center ${CHIP_CLIP} ${tone.chip}`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <p className="relative text-[15px] font-semibold leading-snug text-white">{title}</p>
        <span
          aria-hidden="true"
          className={`relative h-0.5 w-10 shrink-0 bg-gradient-to-r ${tone.frame}`}
        />
        <p className="relative text-[13px] leading-relaxed text-slate-300">{desc}</p>
      </div>
    </li>
  )
}

export default async function HomePage() {
  // Keep the public landing page renderable while Supabase environment
  // variables are being provisioned for a deployment.
  try {
    // T2: đọc định danh từ header nội bộ do middleware xác thực.
    const user = await getVerifiedAuthFromHeaders()
    if (user) redirect("/dashboard")
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Supabase server configuration is missing")) {
      throw error
    }
  }

  return (
    <main className="min-h-svh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <GraduationCap className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-semibold leading-tight">Lớp học Số</p>
              <p className="text-xs text-muted-foreground leading-snug max-w-72">
                Giáo viên quản lý thảo luận nhóm và bài tập về nhà hiệu quả
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/auth/login">Đăng nhập</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/sign-up">Đăng ký</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10 md:py-12 grid lg:grid-cols-2 gap-10 items-center">
        <div className="flex flex-col gap-4">
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-secondary px-3 py-1 text-xs font-medium">
            Thảo luận - Sửa bài - Chấm điểm
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-balance leading-tight">
            Quản lý thảo luận nhóm và bài tập về nhà,{" "}
            <span className="bg-gradient-to-r from-teal-600 via-blue-600 to-violet-600 bg-clip-text text-transparent">
              Chấm bài tự động
            </span>
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed text-pretty">
            Tạo lớp một lần, dùng cho cả năm học. Thảo luận nhóm, giao bài tập
            về nhà, chấm điểm tự động cho cả nhóm và cá nhân, xuất bảng điểm
            cuối kỳ.
          </p>
          <div className="flex gap-3 mt-2">
            <Button asChild size="lg">
              <Link href="/auth/sign-up">Bắt đầu miễn phí</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/auth/login">Tôi đã có tài khoản</Link>
            </Button>
          </div>
        </div>

        <video
          className="w-full rounded-2xl shadow-xl"
          src="/landing/slideshow/video-trang-dau.mp4"
          poster="/landing/slideshow/video-trang-dau-poster.jpg"
          aria-label="Video giới thiệu: tạo phiên thảo luận, chấm bài theo barem, giao bài và bảng điểm"
          autoPlay
          muted
          loop
          playsInline
        />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <FeatureCard
            tone={{
              frame: "from-cyan-400 to-blue-600",
              glow: "bg-cyan-400",
              chip: "bg-cyan-400/20 text-cyan-300",
              shadow: "drop-shadow-[0_0_14px_rgba(34,211,238,0.30)]",
              shadowHover: "hover:drop-shadow-[0_0_22px_rgba(34,211,238,0.50)]",
            }}
            icon={Users}
            title="Danh sách lớp và nhóm"
            desc="Tạo lớp, nhập hoặc để học sinh tự ghi tên vào ô của mình. Chia nhóm cố định."
          />
          <FeatureCard
            tone={{
              frame: "from-violet-500 to-fuchsia-600",
              glow: "bg-violet-500",
              chip: "bg-violet-400/20 text-violet-300",
              shadow: "drop-shadow-[0_0_14px_rgba(167,139,250,0.30)]",
              shadowHover: "hover:drop-shadow-[0_0_22px_rgba(167,139,250,0.50)]",
            }}
            icon={Presentation}
            title="Phiên thảo luận nhóm"
            desc="Mỗi nhóm chụp ảnh nộp bài, giáo viên thấy tất cả trên một màn chiếu."
          />
          <FeatureCard
            tone={{
              frame: "from-teal-400 to-emerald-600",
              glow: "bg-teal-400",
              chip: "bg-teal-400/20 text-teal-300",
              shadow: "drop-shadow-[0_0_14px_rgba(45,212,191,0.30)]",
              shadowHover: "hover:drop-shadow-[0_0_22px_rgba(45,212,191,0.50)]",
            }}
            icon={PenLine}
            title="Sửa bài trực tiếp"
            desc="Gõ textbox, gạch chân, vẽ bút, chấm điểm. Lưu vĩnh viễn."
          />
          <FeatureCard
            tone={{
              frame: "from-amber-400 to-rose-500",
              glow: "bg-amber-400",
              chip: "bg-amber-400/20 text-amber-300",
              shadow: "drop-shadow-[0_0_14px_rgba(251,191,36,0.30)]",
              shadowHover: "hover:drop-shadow-[0_0_22px_rgba(251,191,36,0.50)]",
            }}
            icon={BookOpen}
            title="Giao bài tập về nhà"
            desc="Giao đề bằng văn bản hoặc file Word, PDF, TXT. Học sinh nộp bài, chấm điểm tự động, cờ trùng bài cảnh báo bài giống nhau; bảng điểm cả kỳ cho thấy ngay em nào đang yếu."
          />
          <FeatureCard
            tone={{
              frame: "from-indigo-400 to-violet-600",
              glow: "bg-indigo-400",
              chip: "bg-indigo-400/20 text-indigo-300",
              shadow: "drop-shadow-[0_0_14px_rgba(129,140,248,0.30)]",
              shadowHover: "hover:drop-shadow-[0_0_22px_rgba(129,140,248,0.50)]",
            }}
            icon={ClipboardList}
            title="Bảng điểm cả kỳ"
            desc="Mỗi phiên là một cột điểm. Chia sẻ link để học sinh xem (chỉ xem)."
          />
        </ul>
      </section>
    </main>
  )
}
