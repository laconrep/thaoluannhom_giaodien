// Hằng số cho việc tuân thủ Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15
// (hiệu lực 01/01/2026) và Nghị định 356/2025/NĐ-CP.
//
// - Đồng ý phải tự nguyện, cụ thể từng mục đích; im lặng không phải là
//   đồng ý (Điều 9). Vì vậy form đăng ký bắt buộc tick 2 ô (đủ 18 tuổi +
//   đồng ý chính sách) mới cho đăng ký, và bằng chứng đồng ý được lưu vào
//   user_metadata lúc đăng ký + đồng bộ sang bảng profiles (migration 013).
// - Dữ liệu trẻ em (HS lớp 10 mới 15 tuổi, dưới 16 là trẻ em): chỉ xử lý
//   khi giáo viên xác nhận đã được cha mẹ/người giám hộ đồng ý (Điều 24) —
//   xem ô xác nhận ở tạo lớp / nhập danh sách HS.

export const PRIVACY_POLICY_VERSION = "1.0"
export const PRIVACY_POLICY_EFFECTIVE_DATE = "2026-11-07"

/** Khóa metadata lưu trong auth.users.user_metadata lúc đăng ký. */
export const CONSENT_METADATA_KEYS = {
  consentPrivacy: "consent_privacy",
  consentVersion: "consent_version",
  consentAt: "consent_at",
  ageConfirmed: "age_confirmed",
} as const
