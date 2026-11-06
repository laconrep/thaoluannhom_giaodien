import Link from "next/link"
import { PRIVACY_POLICY_VERSION, PRIVACY_POLICY_EFFECTIVE_DATE } from "@/lib/privacy"

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold">Điều khoản sử dụng</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Phiên bản {PRIVACY_POLICY_VERSION} — có hiệu lực từ ngày {PRIVACY_POLICY_EFFECTIVE_DATE}.
      </p>

      <section className="mt-6 flex flex-col gap-3 text-sm leading-relaxed">
        <h2 className="text-base font-semibold">1. Đối tượng sử dụng</h2>
        <p>
          Ứng dụng dành cho giáo viên từ đủ 18 tuổi để quản lý lớp học, giao bài và chấm bài.
          Học sinh không tự tạo tài khoản; các em chỉ truy cập qua đường dẫn lớp do giáo viên chia
          sẻ. Khi đăng ký, bạn xác nhận mình từ đủ 18 tuổi và các thông tin đăng ký là đúng sự
          thật.
        </p>

        <h2 className="text-base font-semibold">2. Trách nhiệm của giáo viên</h2>
        <ul className="list-disc pl-5">
          <li>
            <strong>Đồng ý của phụ huynh:</strong> trước khi nhập danh sách học sinh vào lớp, bạn
            phải thông báo cho cha mẹ/người giám hộ và chỉ nhập dữ liệu khi đã được họ đồng ý. Khi
            tạo lớp hoặc nhập danh sách, bạn xác nhận việc này trên ứng dụng.
          </li>
          <li>
            Chỉ nhập dữ liệu học sinh phục vụ việc dạy học; không đăng tải nội dung vi phạm pháp
            luật, xúc phạm hay tiết lộ thông tin riêng tư của người khác.
          </li>
          <li>
            Bảo mật tài khoản của mình (không chia sẻ mật khẩu); chịu trách nhiệm với mọi hoạt động
            thực hiện qua tài khoản của mình.
          </li>
          <li>
            Khi phụ huynh hoặc học sinh yêu cầu xem/xóa dữ liệu, bạn xử lý yêu cầu đó hoặc chuyển
            cho quản trị viên hệ thống.
          </li>
        </ul>

        <h2 className="text-base font-semibold">3. Chấm bài bằng AI</h2>
        <p>
          Tính năng chấm AI gửi ảnh/chữ bài làm của học sinh tới nhà cung cấp dịch vụ AI (Meta) để
          chấm theo barem do giáo viên đặt. Điểm và nhận xét do AI tạo ra chỉ là gợi ý; giáo viên
          là người xem lại và quyết định điểm cuối cùng. Bạn chỉ bật chấm AI cho lớp khi đã có sự
          đồng ý của phụ huynh theo mục 2.
        </p>

        <h2 className="text-base font-semibold">4. Quyền sở hữu và sử dụng nội dung</h2>
        <p>
          Đề bài, barem và nhận xét do giáo viên tạo thuộc về giáo viên. Bài làm của học sinh
          thuộc về học sinh. Ứng dụng chỉ sử dụng các nội dung này để vận hành tính năng đã mô tả
          trong{" "}
          <Link href="/privacy" className="text-primary underline">
            Chính sách bảo mật
          </Link>
          .
        </p>

        <h2 className="text-base font-semibold">5. Tạm khóa và chấm dứt tài khoản</h2>
        <p>
          Quản trị viên có thể tạm khóa hoặc xóa tài khoản vi phạm điều khoản này (ví dụ: nhập dữ
          liệu học sinh khi chưa có đồng ý của phụ huynh, đăng nội dung vi phạm pháp luật). Bạn có
          thể yêu cầu xóa tài khoản của mình bất cứ lúc nào; dữ liệu sẽ được xóa theo{" "}
          <Link href="/privacy" className="text-primary underline">
            Chính sách bảo mật
          </Link>
          .
        </p>

        <h2 className="text-base font-semibold">6. Giới hạn trách nhiệm</h2>
        <p>
          Ứng dụng được cung cấp &ldquo;như hiện có&rdquo;. Điểm số do AI chấm là kết quả tham
          khảo và giáo viên chịu trách nhiệm về điểm cuối cùng ghi nhận cho học sinh. Chúng tôi
          không chịu trách nhiệm với thiệt hại phát sinh từ việc giáo viên nhập dữ liệu khi chưa có
          đồng ý của phụ huynh.
        </p>

        <h2 className="text-base font-semibold">7. Thay đổi điều khoản</h2>
        <p>
          Khi điều khoản này thay đổi, chúng tôi cập nhật số phiên bản và ngày hiệu lực ở đầu
          trang. Việc bạn tiếp tục sử dụng ứng dụng sau khi điều khoản mới có hiệu lực được xem là
          bạn đồng ý với điều khoản mới.
        </p>
      </section>
    </main>
  )
}
