import type { Locale, Options, Step } from "react-joyride"

export const tourLocale: Locale = {
  back: "Trước",
  close: "Đóng",
  last: "Hoàn tất",
  next: "Tiếp",
  nextWithProgress: "Tiếp ({current}/{total})",
  open: "Mở hộp thoại",
  skip: "Bỏ qua",
}

export const tourOptions: Partial<Options> = {
  skipBeacon: true,
  showProgress: true,
  zIndex: 200,
  primaryColor: "#2563eb",
  scrollDuration: 400,
  targetWaitTimeout: 1500,
  buttons: ["back", "skip", "close", "primary"],
}

type TourStepData = { navigateTo?: string }

export const dashboardTourSteps: Step[] = [
  {
    target: "[data-tour='dashboard-header']",
    placement: "bottom",
    title: "Chào mừng đến Lớp học thảo luận",
    content:
      "Đây là nơi bạn quản lý tất cả lớp học, danh sách học sinh, phiên thảo luận và bảng điểm của mình.",
  },
  {
    target: "[data-tour='create-class']",
    placement: "bottom",
    title: "Tạo lớp",
    content:
      "Nhấn \"Tạo lớp mới\", điền tên lớp, sĩ số và số nhóm cố định. Mỗi lớp dùng được cả năm học.",
  },
  {
    target: "[data-tour='class-list']",
    placement: "top",
    title: "Lớp của bạn",
    content:
      "Sau khi tạo, lớp sẽ hiện ở đây. Bấm vào lớp để bắt đầu nhập tên học sinh và phân nhóm.",
  },
]

export function rosterTourSteps(classId: string): Step[] {
  return [
    {
      target: "[data-tour='roster-list']",
      placement: "right",
      title: "Danh sách học sinh",
      content:
        "Đây là danh sách học sinh của lớp. Nhập tên vào từng ô, hoặc dùng \"Dán danh sách\" và \"Import Excel\" để nhập hàng loạt.",
    },
    {
      target: "[data-tour='roster-groups']",
      placement: "left",
      title: "Nhóm cố định",
      content:
        "Kéo thẻ học sinh từ bên trái thả vào một nhóm bên phải. Nhóm này dùng chung cho mọi phiên thảo luận.",
    },
    {
      target: "[data-tour='group-leader']",
      placement: "top",
      title: "Nhóm trưởng",
      content:
        "Bấm vương miện bên cạnh tên nhóm để gán nhóm trưởng. Nhóm trưởng có thể tự chọn thêm thành viên cho nhóm.",
    },
    {
      target: "[data-tour='bulk-select']",
      placement: "top",
      title: "Chọn nhiều học sinh",
      content:
        "Giữ Ctrl (Cmd trên Mac) và bấm vào thẻ để chọn nhiều em cùng lúc, sau đó kéo cụm thả vào nhóm.",
    },
    {
      target: "[data-tour='class-tabs']",
      placement: "bottom",
      title: "Bước tiếp theo",
      content: "Phân nhóm xong, bấm tab \"Thảo luận nhóm\" để tạo phiên thảo luận đầu tiên.",
      data: { navigateTo: `/classes/${classId}/sessions` } satisfies TourStepData,
    },
  ]
}

export function sessionsTourSteps(classId: string): Step[] {
  return [
    {
      target: "[data-tour='session-create']",
      placement: "bottom",
      title: "Tạo phiên thảo luận",
      content:
        "Bấm \"Tạo phiên mới\" để mở biểu mẫu. Chọn cách chia nhóm, dùng preset 15/30/45 phút cho thời lượng, rồi bấm tạo.",
    },
    {
      target: "[data-tour='session-list']",
      placement: "top",
      title: "Danh sách phiên",
      content:
        "Phiên sau khi tạo hiện ở đây. Bấm vào phiên để mở màn chiếu cho học sinh nộp bài.",
    },
    {
      target: "[data-tour='class-tabs']",
      placement: "bottom",
      title: "Bước tiếp theo",
      content: "Khi phiên có bài nộp, mở tab \"Bảng điểm\" để chấm và theo dõi điểm.",
      data: { navigateTo: `/classes/${classId}/gradebook` } satisfies TourStepData,
    },
  ]
}

export function gradebookTourSteps(classId: string): Step[] {
  return [
    {
      target: "[data-tour='gradebook-table']",
      placement: "top",
      title: "Bảng điểm",
      content:
        "Mỗi phiên là một cột điểm, mỗi học sinh là một hàng. Điểm từ phiên được tổng hợp tự động.",
    },
    {
      target: "[data-tour='gradebook-export']",
      placement: "bottom",
      title: "Xuất điểm",
      content:
        "Bấm \"Xuất CSV\" để tải bảng điểm về máy, dùng để in hoặc ghi sổ cuối kỳ.",
    },
    {
      target: "[data-tour='class-tabs']",
      placement: "bottom",
      title: "Bước tiếp theo",
      content: "Cuối cùng, mở tab \"Chia sẻ\" để gửi link cho học sinh xem điểm.",
      data: { navigateTo: `/classes/${classId}/share` } satisfies TourStepData,
    },
  ]
}

export function shareTourSteps(classId: string): Step[] {
  return [
    {
      target: "[data-tour='share-link']",
      placement: "right",
      title: "Link vào lớp",
      content:
        "Copy link này gửi cho học sinh. Các em dùng link để vào lớp, điền tên và tham gia phiên thảo luận.",
    },
    {
      target: "[data-tour='share-grades']",
      placement: "left",
      title: "Link xem điểm",
      content:
        "Học sinh dùng link này để xem điểm của cả lớp (chỉ xem, không sửa được).",
    },
    {
      target: "[data-tour='share-done']",
      placement: "top",
      title: "Hoàn tất",
      content:
        "Bạn đã sẵn sàng sử dụng Lớp học thảo luận. Bấm \"Hoàn tất\" để kết thúc tour hướng dẫn.",
    },
  ]
}
