import Link from "next/link"
import { PRIVACY_POLICY_VERSION, PRIVACY_POLICY_EFFECTIVE_DATE } from "@/lib/privacy"

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold">Chính sách bảo mật</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Phiên bản {PRIVACY_POLICY_VERSION} — có hiệu lực từ ngày {PRIVACY_POLICY_EFFECTIVE_DATE}.
        Chính sách này tuân thủ Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định
        356/2025/NĐ-CP.
      </p>

      <section className="mt-6 flex flex-col gap-3 text-sm leading-relaxed">
        <h2 className="text-base font-semibold">1. Ai kiểm soát dữ liệu của bạn</h2>
        <p>
          Ứng dụng này do giáo viên quản trị vận hành để quản lý lớp học và chấm bài. Giáo viên
          tạo lớp là người quyết định dữ liệu học sinh nào được nhập vào lớp của mình và chịu trách
          nhiệm xin phép phụ huynh theo mục 7 dưới đây. Khi cần thực hiện quyền của mình (mục 6),
          bạn liên hệ giáo viên chủ nhiệm lớp hoặc quản trị viên hệ thống qua địa chỉ email đã dùng
          để đăng ký tài khoản quản trị.
        </p>

        <h2 className="text-base font-semibold">2. Chúng tôi thu thập dữ liệu gì</h2>
        <ul className="list-disc pl-5">
          <li>
            <strong>Tài khoản giáo viên:</strong> họ và tên, địa chỉ email, mật khẩu (mật khẩu
            được mã hóa một chiều, chúng tôi không đọc được mật khẩu của bạn).
          </li>
          <li>
            <strong>Học sinh trong lớp:</strong> họ và tên, mã định danh thiết bị (device token)
            dùng để nhận diện thiết bị của từng em, bài làm (ảnh chụp, chữ viết tay, file đính
            kèm), điểm số và nhận xét của giáo viên.
          </li>
          <li>
            <strong>Dữ liệu lớp học:</strong> tên lớp, sĩ số, cấu trúc nhóm, nội dung phiên thảo
            luận và đề bài giáo viên giao.
          </li>
        </ul>
        <p>
          Chúng tôi không thu thập dữ liệu ngoài những thứ trên và không bán dữ liệu cá nhân cho
          bất kỳ ai.
        </p>

        <h2 className="text-base font-semibold">3. Dùng dữ liệu để làm gì</h2>
        <ul className="list-disc pl-5">
          <li>Tạo và quản lý tài khoản giáo viên; quản lý lớp, phiên học và bảng điểm.</li>
          <li>
            <strong>Chấm bài bằng AI:</strong> khi giáo viên bấm chấm AI, ảnh/chữ bài làm của học
            sinh được gửi tới nhà cung cấp dịch vụ AI (Meta) để chấm theo barem của giáo viên, rồi
            trả điểm và nhận xét về lại ứng dụng. Giáo viên là người quyết định có dùng tính năng
            này hay không.
          </li>
          <li>Bảo mật tài khoản: nhận diện thiết bị của học sinh để chống chọn nhầm tên bạn khác.</li>
        </ul>
        <p>
          Cơ sở pháp lý của việc xử lý là <strong>sự đồng ý của bạn</strong> (khi đăng ký tài
          khoản, bạn tick xác nhận đã đọc và đồng ý chính sách này) và, với học sinh, sự đồng ý của
          cha mẹ/người giám hộ (mục 7). Bạn có thể rút lại sự đồng ý bất cứ lúc nào theo mục 6;
          khi đó tài khoản và dữ liệu liên quan sẽ được xóa theo yêu cầu.
        </p>

        <h2 className="text-base font-semibold">4. Dữ liệu được lưu ở đâu và chuyển đi đâu</h2>
        <p>
          Dữ liệu được lưu trên hạ tầng đám mây của Supabase và Backblaze B2 đặt ngoài lãnh thổ
          Việt Nam, và bài làm gửi đi chấm AI được xử lý trên máy chủ của nhà cung cấp AI ở nước
          ngoài. Đây là hoạt động <strong>chuyển dữ liệu cá nhân ra nước ngoài</strong> theo quy
          định của Luật Bảo vệ dữ liệu cá nhân; chúng tôi chỉ chuyển dữ liệu trong phạm vi cần
          thiết cho các mục đích ở mục 3 và áp dụng các biện pháp bảo vệ phù hợp.
        </p>

        <h2 className="text-base font-semibold">5. Lưu dữ liệu trong bao lâu</h2>
        <p>
          Dữ liệu lớp học được lưu cho đến khi giáo viên xóa lớp hoặc xóa tài khoản. Khi lớp bị
          xóa, toàn bộ học sinh, phiên học, bài làm và điểm của lớp đó cũng bị xóa. Tài khoản giáo
          viên không hoạt động có thể bị xóa sau khi đã thông báo trước cho chủ tài khoản.
        </p>

        <h2 className="text-base font-semibold">6. Quyền của bạn</h2>
        <p>Bạn có quyền:</p>
        <ul className="list-disc pl-5">
          <li>Được biết dữ liệu nào của mình đang được xử lý và xử lý để làm gì;</li>
          <li>Yêu cầu xem, sửa hoặc xóa dữ liệu cá nhân của mình;</li>
          <li>Rút lại sự đồng ý đã cho; yêu cầu hạn chế xử lý;</li>
          <li>Khiếu nại tới cơ quan có thẩm quyền khi cho rằng quyền của mình bị xâm phạm.</li>
        </ul>
        <p>
          Để thực hiện các quyền trên, học sinh và phụ huynh liên hệ giáo viên chủ nhiệm lớp;
          giáo viên liên hệ quản trị viên hệ thống. Chúng tôi phản hồi yêu cầu trong thời hạn luật
          định.
        </p>

        <h2 className="text-base font-semibold">7. Dữ liệu của trẻ em</h2>
        <p>
          Học sinh sử dụng ứng dụng phần lớn là trẻ em (dưới 16 tuổi). Ứng dụng không cho phép trẻ
          em tự tạo tài khoản; chỉ giáo viên mới tạo lớp và nhập danh sách học sinh. Giáo viên
          phải thông báo cho cha mẹ/người giám hộ và chỉ nhập dữ liệu học sinh khi đã được họ đồng
          ý. Cha mẹ/người giám hộ có thể yêu cầu xem hoặc xóa dữ liệu của con mình bất cứ lúc nào
          (xem mục 6).
        </p>

        <h2 className="text-base font-semibold">8. Chúng tôi bảo vệ dữ liệu thế nào</h2>
        <ul className="list-disc pl-5">
          <li>Mật khẩu được mã hóa một chiều; đăng nhập qua phiên bảo mật.</li>
          <li>
            Quyền truy cập cơ sở dữ liệu được giới hạn theo vai trò: giáo viên chỉ thấy dữ liệu
            lớp của mình; học sinh chỉ thấy bài và điểm của chính mình.
          </li>
          <li>File bài làm chỉ truy cập được qua đường dẫn có chữ ký tạm thời, không công khai.</li>
        </ul>
        <p>
          Không có biện pháp nào an toàn tuyệt đối. Khi xảy ra sự cố làm lộ dữ liệu, chúng tôi sẽ
          thông báo cho người bị ảnh hưởng và cơ quan có thẩm quyền theo quy định.
        </p>

        <h2 className="text-base font-semibold">9. Thay đổi chính sách</h2>
        <p>
          Khi chính sách này thay đổi, chúng tôi cập nhật số phiên bản và ngày hiệu lực ở đầu
          trang. Người dùng đã đăng ký sẽ được yêu cầu đồng ý lại với phiên bản mới khi đăng nhập
          sau thời điểm thay đổi.
        </p>

        <p className="mt-4">
          Xem thêm:{" "}
          <Link href="/terms" className="text-primary underline">
            Điều khoản sử dụng
          </Link>
        </p>
      </section>
    </main>
  )
}
