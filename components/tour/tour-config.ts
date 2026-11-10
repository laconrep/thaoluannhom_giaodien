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

// Nút bước cuối của tour nhiều bước: "Hoàn tất (x/y)" — Joyride mặc định chỉ
// hiện "Hoàn tất" ở bước cuối (không nội suy tiến độ), nên ghi số trực tiếp
// vào locale.last của riêng bước cuối. Chỉ dùng khi total > 1.
export function withLastProgress(step: Step, current: number, total: number): Step {
  if (total <= 1) return step
  return { ...step, locale: { ...tourLocale, last: `Hoàn tất (${current}/${total})` } }
}

// Progressive: hint "Tạo lớp" trỏ nút "Tạo lớp mới" (tắt khi bấm nút — xem
// CreateClassCard: onClick set cờ + dispatch STOP_EVENT), rồi hint "Vào lớp"
// trỏ lưới lớp — chỉ có khi tài khoản đã có lớp (tài khoản mới chưa có lớp
// thì không hiện, tránh trỏ vào khung trống).
export const dashboardTourSteps: Step[] = [
  {
    target: "[data-tour='create-class']",
    placement: "bottom",
    title: "Tạo lớp",
    content:
      "Nhấn \"Tạo lớp mới\", điền tên lớp, sĩ số và số nhóm cố định. Mỗi lớp dùng được cả năm học.",
  },
]

export function dashboardClassListStep(): Step {
  return {
    target: "[data-tour='class-list']",
    placement: "top",
    title: "Vào lớp",
    content:
      "Mỗi lớp là một ô riêng — bấm vào ô để vào lớp, xem danh sách học sinh và tạo phiên thảo luận.",
  }
}

// Roster tour progressive — từng hint xuất hiện theo hành động thật của giáo viên:
// vào trang (dán/import → phân nhóm) → kéo ≥1 HS vào nhóm (hint nhóm trưởng) → gán leader
// (hint chuyển tab). Không dùng navigateTo — bước cuối chỉ nhắc bấm tab.
// Bước 1 trỏ cụm nút nhập (bulk-select), bước 2 trỏ khung nhóm (roster-groups) —
// không trỏ cả thẻ danh sách nữa vì mũi tên lệch vào khoảng trống.
export function rosterPasteStep(): Step {
  return {
    target: "[data-tour='bulk-select']",
    placement: "bottom",
    title: "Nhập danh sách nhanh",
    content:
      "Dán cả danh sách lớp vào đây, hoặc import file Excel theo mẫu. Tên mới điền vào các ô còn trống, tên đã có không bị thay. Nút \"Khóa thiết bị học sinh\" giữ mỗi tên chỉ dùng trên một thiết bị; nút \"Mở khóa\" chỉ bấm được khi khóa đang bật.",
  }
}

export function rosterGroupsStep(): Step {
  return {
    target: "[data-tour='roster-groups']",
    placement: "top",
    title: "Phân nhóm",
    content:
      "Kéo tên học sinh thả vào từng nhóm để phân nhóm. Bấm vương miện bên cạnh tên nhóm để gán nhóm trưởng — nhóm trưởng có thể tự chọn thêm thành viên.",
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
      "Phân nhóm xong, bấm tab \"Thảo luận nhóm\" để tạo phiên thảo luận đầu tiên — tour sẽ tự mở hướng dẫn tiếp theo.",
  }
}

export function sessionsGroupModeStep(): Step {
  return {
    target: "[data-tour='session-group-mode']",
    placement: "bottom",
    title: "Cách chia nhóm",
    content:
      "\"Dùng nhóm cố định\" giữ nguyên các nhóm đã phân ở tab Danh sách & nhóm — học sinh vào là thấy đúng nhóm của mình. \"Chia lại nhóm\" tạo nhóm tạm cho riêng phiên này, học sinh tự chọn nhóm.",
  }
}

export function sessionsPresetsStep(isGroup: boolean): Step {
  return {
    target: "[data-tour='session-presets']",
    placement: "bottom",
    title: "Chọn thời lượng",
    content: isGroup
      ? "Chọn nhanh preset 15/30/45 phút và số nhóm. Xong rồi bấm \"Tạo và vào ngay\"."
      : "Chọn nhanh preset 15/30/45 phút. Xong rồi bấm \"Tạo và vào ngay\".",
  }
}

// Tour form tạo phiên: nhóm + có nhóm cố định → giải thích cách chia nhóm rồi
// mới tới preset; còn lại chỉ 1 bước preset.
export function sessionsFormTourSteps(isGroup: boolean, hasFixed: boolean): Step[] {
  if (isGroup && hasFixed) {
    return [sessionsGroupModeStep(), withLastProgress(sessionsPresetsStep(true), 2, 2)]
  }
  return [sessionsPresetsStep(isGroup)]
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
    withLastProgress(
      {
        target: "[data-tour='class-tabs']",
        placement: "bottom",
        title: "Bước tiếp theo",
        content:
          "Cuối cùng, tự bấm tab \"Chia sẻ\" để gửi link cho học sinh xem điểm — tour sẽ mở hướng dẫn tiếp theo.",
      },
      3,
      3,
    ),
  ]
}

export function shareLinkStep(): Step {
  return {
    target: "[data-tour='share-link']",
    placement: "right",
    title: "Link vào lớp",
    content:
      "Copy link này gửi cho học sinh. Các em dùng link để vào lớp, điền tên và tham gia phiên thảo luận.",
    // Bước này thực chất là "Tiếp" sang hint link xem điểm — không phải kết thúc tour.
    locale: { ...tourLocale, last: "Tiếp" },
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
      "Bấm nút \"Trình chiếu PowerPoint\" góc phải dưới để mở PowerPoint ra toàn màn hình. Học sinh chỉ thấy màn chiếu, các nút điều khiển của bạn nằm gọn trong bảng điều khiển ẩn bên trái.",
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
      "Trong bảng điều khiển, Thầy/cô chỉnh thời gian phiên tại đây — bắt đầu, tạm dừng hay gia hạn.",
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

export function presentationGradeStep(): Step {
  return {
    target: "[data-tour='presentation-groups']",
    placement: "right",
    title: "Chấm ngay trên màn chiếu",
    content:
      "Điểm nổi bật: học sinh vẫn nộp bài bình thường khi PowerPoint đang chiếu fullscreen. Bấm vào thẻ nhóm để mở bài và chấm/sửa ngay trên màn hình đang chiếu, không cần thoát.",
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

// Trang phiên (bảng nhóm): tour gộp — tải PPT trước rồi mới tới chấm AI.
// Nút "Trình chiếu PowerPoint" chỉ hiện khi phiên đã có file PPT tải lên,
// nên phiên chưa có PPT cần hint tải lên trước (bước 1, chỉ khi chưa có PPT).
export function presentationUploadStep(): Step {
  return {
    target: "[data-tour='presentation-upload']",
    placement: "bottom",
    title: "Chiếu PowerPoint",
    content:
      "Tải file PowerPoint của tiết học lên đây trước — tải lên rồi mới hiện nút \"Trình chiếu PowerPoint\" để chiếu cho cả lớp xem.",
  }
}

export function boardGroupsStep(): Step {
  return {
    target: "[data-tour='session-groups']",
    placement: "right",
    title: "Học sinh vào nhóm",
    content:
      "Học sinh mở link phiên, chọn nhóm rồi điền tên để tham gia. Nhóm nào chưa có ai sẽ hiện \"Chưa có nhóm\" — các em vào sau vẫn thấy đúng nhóm của mình.",
  }
}

export function boardStartStep(): Step {
  return {
    target: "[data-tour='session-timer']",
    placement: "right",
    title: "Bắt đầu phiên",
    content:
      "Bấm \"Bắt đầu\" để tính giờ — bắt đầu rồi học sinh mới nộp bài được. Gửi link hoặc mã QR ở ngay bên dưới cho các em vào phiên.",
  }
}

export function aiGradePanelStep(): Step {
  return {
    target: "[data-tour='ai-grade-panel']",
    placement: "bottom",
    title: "Chấm bài AI",
    content:
      "Bật công tắc \"Bật chấm AI\" ở khung này trước — bật rồi mới hiện nút \"Tiêu chí chấm\" và \"Chấm bài AI\". Tạo tiêu chí chấm từ bài chấm mẫu, rồi bấm \"Chấm bài AI\" — AI chấm ngầm từng bài, gập máy vẫn chạy. Điểm tự ghi vào sổ điểm của từng cá nhân theo từng phiên thảo luận.",
  }
}

// Các bước tour bảng phiên, theo thứ tự: tải PPT (nếu chưa có) → vào nhóm →
// bắt đầu → chấm AI. Bước cuối mang số tiến độ (x/y).
export function boardTourSteps(hasPresentation: boolean): Step[] {
  const steps: Step[] = []
  if (!hasPresentation) steps.push(presentationUploadStep())
  steps.push(boardGroupsStep(), boardStartStep(), aiGradePanelStep())
  const last = steps[steps.length - 1]
  steps[steps.length - 1] = withLastProgress(last, steps.length, steps.length)
  return steps
}

