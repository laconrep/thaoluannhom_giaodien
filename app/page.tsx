import { redirect } from "next/navigation"
import Link from "next/link"
import { getVerifiedAuthFromHeaders } from "@/lib/auth-headers"
import { Button } from "@/components/ui/button"
import { LandingSlideshow } from "@/components/landing-slideshow"
import {
  GraduationCap,
  Users,
  Presentation,
  PenLine,
  BookOpen,
  ClipboardList,
  type LucideIcon,
} from "lucide-react"

function FeatureCard({
  img,
  imgPosition,
  icon: Icon,
  title,
  desc,
}: {
  img: string
  imgPosition?: string
  icon: LucideIcon
  title: string
  desc: string
}) {
  return (
    <li className="rounded-3xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 p-[1.5px] shadow-[0_0_28px_rgba(59,130,246,0.22)]">
      <div className="relative h-64 overflow-hidden rounded-[calc(1.5rem-1.5px)]">
        <img
          src={img}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover ${imgPosition ?? ""}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
        <div className="relative flex h-full flex-col justify-end gap-2 p-5">
          <span className="grid size-10 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <p className="text-lg font-semibold text-white">{title}</p>
          <p className="text-sm leading-relaxed text-white/85">{desc}</p>
        </div>
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

      <section className="mx-auto max-w-7xl px-6 py-12 md:py-16 grid lg:grid-cols-2 gap-10 items-center">
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

        <LandingSlideshow />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            img="/landing/slideshow/bai-lam.jpg"
            imgPosition="object-top"
            icon={Users}
            title="Danh sách lớp và nhóm"
            desc="Tạo lớp, nhập hoặc để học sinh tự ghi tên vào ô của mình. Chia nhóm cố định."
          />
          <FeatureCard
            img="/landing/slideshow/video-03-poster.jpg"
            icon={Presentation}
            title="Phiên thảo luận nhóm"
            desc="Mỗi nhóm chụp ảnh nộp bài, giáo viên thấy tất cả trên một màn chiếu."
          />
          <FeatureCard
            img="/landing/slideshow/barem.jpg"
            icon={PenLine}
            title="Sửa bài trực tiếp"
            desc="Gõ textbox, gạch chân, vẽ bút, chấm điểm. Lưu vĩnh viễn."
          />
          <FeatureCard
            img="/landing/slideshow/giao-bai.jpg"
            icon={BookOpen}
            title="Giao bài tập về nhà"
            desc="Giao đề bằng văn bản hoặc file Word, PDF, TXT. Học sinh nộp bài, chấm điểm tự động, cờ trùng bài cảnh báo bài giống nhau; bảng điểm cả kỳ cho thấy ngay em nào đang yếu."
          />
          <FeatureCard
            img="/landing/slideshow/bai-lam.jpg"
            imgPosition="object-bottom"
            icon={ClipboardList}
            title="Bảng điểm cả kỳ"
            desc="Mỗi phiên là một cột điểm. Chia sẻ link để học sinh xem (chỉ xem)."
          />
        </ul>
      </section>
    </main>
  )
}
