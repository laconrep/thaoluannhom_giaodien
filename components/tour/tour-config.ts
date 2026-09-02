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
  primaryColor: "#2a8f8a",
  scrollDuration: 400,
  targetWaitTimeout: 1500,
  disableFocusTrap: true,
  buttons: ["back", "skip", "close", "primary"],
}

// Progressive: chỉ 1 hint trỏ nút "Tạo lớp mới". Hint tắt khi bấm nút (xem
// CreateClassCard: onClick set cờ + dispatch STOP_EVENT), không chạy các bước dư.
export const dashboardTourSteps: Step[] = [
  {
    target: "[data-tour='create-class']",
    placement: "bottom",
    title: "Tạo lớp",
    content:
      "Nhấn \"Tạo lớp mới\", điền tên lớp, sĩ số và số nhóm cố định. Mỗi lớp dùng được cả năm học.",
  },
]

// Roster tour progressive — từng hint xuất hiện theo hành động thật của giáo viên:
// vào trang (danh sách HS) → kéo ≥1 HS vào nhóm (hint nhóm trưởng) → gán leader
// (hint chuyển tab). Không dùng navigateTo — bước cuối chỉ nhắc bấm tab.
export function rosterListStep(): Step {
  return {
    target: "[data-tour='roster-list']",
    placement: "right",
    title: "Danh sách học sinh",
    content:
      "Đây là danh sách học sinh của lớp. Nhập tên vào từng ô, hoặc dùng \"Dán danh sách\" và \"Import Excel\" để nhập hàng loạt. Kéo thẻ học sinh từ bên trái thả vào một nhóm bên phải.",
  }
}

export function rosterLeaderStep(): Step {
  return {
    target: "[data-tour='group-leader']",
    placement: "top",
    title: "Nhóm trưởng",
    content:
      "Bấm vương miện bên cạnh tên nhóm để gán nhóm trưởng. Nhóm trưởng có thể tự chọn thêm thành viên cho nhóm.",
  }
}

export function rosterNextStep(): Step {
  return {
    target: "[data-tour='class-tabs']",
    placement: "bottom",
    title: "Bước tiếp theo",
    content:
      "Phân nhóm xong, bấm tab \"Thảo luận nhóm\" để tạo phiên thảo luận đầu tiên — tour sẽ tự hướng dẫn bạn.",
  }
}

export function sessionsPresetsStep(): Step {
  return {
    target: "[data-tour='session-presets']",
    placement: "bottom",
    title: "Chọn thời lượng",
    content:
      "Chọn nhanh preset 15/30/45 phút (và số nhóm nếu có). Xong rồi bấm \"Tạo và vào ngay\".",
  }
}

export function sessionsNextStep(): Step {
  return {
    target: "[data-tour='session-list']",
    placement: "top",
    title: "Mở phiên",
    content:
      "Phiên vừa tạo hiện ở đây. Bấm vào phiên để mở màn chiếu cho học sinh nộp bài.",
  }
}

export function sessionsTourSteps(_classId: string): Step[] {
  return [sessionsPresetsStep(), sessionsNextStep()]
}

export function gradebookTourSteps(_classId: string): Step[] {
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
      content:
        "Cuối cùng, tự bấm tab \"Chia sẻ\" để gửi link cho học sinh xem điểm — tour sẽ hướng dẫn bạn tiếp theo.",
    },
  ]
}

export function shareLinkStep(): Step {
  return {
    target: "[data-tour='share-link']",
    placement: "right",
    title: "Link vào lớp",
    content:
      "Copy link này gửi cho học sinh. Các em dùng link để vào lớp, điền tên và tham gia phiên thảo luận.",
  }
}

export function shareGradesStep(): Step {
  return {
    target: "[data-tour='share-grades']",
    placement: "left",
    title: "Link xem điểm",
    content:
      "Học sinh dùng link này để xem điểm của cả lớp (chỉ xem, không sửa được).",
  }
}

export function shareTourSteps(_classId: string): Step[] {
  return [shareLinkStep(), shareGradesStep()]
}

export function presentationStartStep(): Step {
  return {
    target: "[data-tour='presentation-start']",
    placement: "top",
    title: "Trình chiếu PowerPoint",
    content:
      "Bấm \"Chế độ chiếu lớp\" để mở PowerPoint ra toàn màn hình. Học sinh chỉ thấy màn chiếu, các nút điều khiển của bạn nằm gọn trong bảng điều khiển ẩn bên trái.",
  }
}

export function presentationEdgeStep(): Step {
  return {
    target: "[data-tour='presentation-edge']",
    placement: "right",
    title: "Bảng điều khiển ẩn",
    content:
      "Di chuột sát mép trái (máy tính) hoặc chạm mép trái (điện thoại) để mở bảng điều khiển. Không chiếu bảng này lên màn hình học sinh.",
  }
}

export function presentationTimerStep(): Step {
  return {
    target: "[data-tour='presentation-timer']",
    placement: "right",
    title: "Chỉnh thời gian",
    content:
      "Trong bảng điều khiển, bạn chỉnh thời gian phiên tại đây — bắt đầu, tạm dừng hay gia hạn.",
  }
}

export function presentationQrStep(): Step {
  return {
    target: "[data-tour='presentation-qr']",
    placement: "bottom",
    title: "QR cho học sinh",
    content:
      "Bấm \"QR\" để tạo mã QR. Học sinh quét mã là vào thẳng phiên nộp bài, không cần gõ link.",
  }
}

export function presentationAllSessionsStep(): Step {
  return {
    target: "[data-tour='presentation-all-sessions']",
    placement: "right",
    title: "Chuyển phiên",
    content:
      "Bấm \"Tất cả phiên\" để xem danh sách phiên thảo luận của lớp, chọn phiên khác hoặc tạo phiên mới ngay trong lúc chiếu.",
  }
}

export function presentationCreateSessionStep(): Step {
  return {
    target: "[data-tour='presentation-create-session']",
    placement: "bottom",
    title: "Tạo phiên mới",
    content:
      "Bấm \"Tạo phiên mới\" để mở một phiên thảo luận mới ngay trên bảng điều khiển mà không cần thoát màn chiếu.",
  }
}
