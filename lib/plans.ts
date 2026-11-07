/**
 * Công tắc hiển thị gói trên giao diện — dùng trong thời gian dự thi.
 * false = ẩn nút "Gói sử dụng" trên thanh điều hướng và trang /pricing
 * (truy cập trực tiếp sẽ chuyển về /dashboard). Toàn bộ dữ liệu gói,
 * giới hạn (planLimits) và logic nâng cấp trong code vẫn giữ nguyên.
 * Thi xong: đổi thành true là giao diện gói hiện lại, không cần code lại.
 */
export const SHOW_PRICING = false

export type Plan = "free" | "pro" | "school"

export const PLANS: {
  id: Plan
  name: string
  price: string
  period: string
  tagline: string
  highlight?: boolean
  limits: { maxClasses: number; maxStudentsPerClass: number; maxPresentations: number }
  features: string[]
}[] = [
  {
    id: "free",
    name: "Miễn phí",
    price: "0",
    period: "đ/tháng",
    tagline: "Dùng thử cho một lớp",
    limits: { maxClasses: 3, maxStudentsPerClass: 40, maxPresentations: 20 },
    features: [
      "Tối đa 3 lớp học",
      "Tối đa 40 học sinh / lớp",
      "Phiên nhóm & cá nhân không giới hạn",
      "Chấm bài trực tiếp trên ảnh/file",
      "Bảng điểm + xuất CSV",
    ],
  },
  {
    id: "pro",
    name: "Giáo viên",
    price: "49.000",
    period: "đ/tháng",
    tagline: "Dành cho giáo viên dùng thường xuyên",
    highlight: true,
    limits: { maxClasses: 30, maxStudentsPerClass: 80, maxPresentations: 100 },
    features: [
      "Tối đa 30 lớp học",
      "Tối đa 80 học sinh / lớp",
      "Mọi tính năng của gói Miễn phí",
      "Nhập danh sách HS từ Excel/CSV",
      "Tạo mã QR lớp học",
      "Hỗ trợ ưu tiên qua email",
    ],
  },
  {
    id: "school",
    name: "Trường học",
    price: "Liên hệ",
    period: "",
    tagline: "Dành cho trường / tổ bộ môn",
    limits: { maxClasses: Infinity, maxStudentsPerClass: 200, maxPresentations: Infinity },
    features: [
      "Không giới hạn lớp học",
      "Tối đa 200 học sinh / lớp",
      "Quản lý nhiều giáo viên",
      "Báo cáo thống kê toàn trường",
      "Hỗ trợ triển khai tận nơi",
    ],
  },
]

export const PLAN_DEFAULT: Plan = "free"

export function planLimits(plan: Plan) {
  return PLANS.find((p) => p.id === plan)?.limits ?? PLANS[0].limits
}

/* Dùng thử 3 tháng (bác chốt 07/11/2026): tài khoản mới được full chức năng
 * gói Giáo viên (Pro) trong 3 tháng kể từ ngày đăng ký (auth.users.created_at).
 * Hết hạn: KHÔNG tự hạ gói — giữ nguyên quyền cho đến khi quản trị xử lý tay;
 * chỉ báo qua mail. Vì vậy trial chỉ là trạng thái suy ra từ ngày tạo + gói
 * lưu trong profiles, không cần migration. Logic này chỉ NỚI quyền (free →
 * pro trong thời gian thử), không bao giờ thu hẹp so với gói đã lưu. */
export const TRIAL_MONTHS = 3
export const TRIAL_PLAN: Plan = "pro"
export const TRIAL_EXPIRING_DAYS = 7

export type TrialState = "trial" | "expiring" | "expired" | "none"

export type TrialInfo = {
  isTrial: boolean
  endsAt: string | null
  daysLeft: number | null
  state: TrialState
}

export function getTrialEndsAt(createdAt: string | null): string | null {
  if (!createdAt) return null
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return null
  d.setMonth(d.getMonth() + TRIAL_MONTHS)
  return d.toISOString()
}

export function getTrialInfo(createdAt: string | null, plan: Plan): TrialInfo {
  const none: TrialInfo = { isTrial: false, endsAt: null, daysLeft: null, state: "none" }
  if (plan !== "free") return none
  const endsAt = getTrialEndsAt(createdAt)
  if (!endsAt) return none
  const daysLeft = Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000)
  if (daysLeft <= 0) return { isTrial: false, endsAt, daysLeft, state: "expired" }
  return {
    isTrial: true,
    endsAt,
    daysLeft,
    state: daysLeft <= TRIAL_EXPIRING_DAYS ? "expiring" : "trial",
  }
}

/** Gói hiệu lực: gói free còn trong thời gian dùng thử được full quyền Pro. */
export function effectivePlan(storedPlan: Plan, createdAt: string | null): Plan {
  if (storedPlan !== "free") return storedPlan
  return getTrialInfo(createdAt, storedPlan).isTrial ? TRIAL_PLAN : storedPlan
}
