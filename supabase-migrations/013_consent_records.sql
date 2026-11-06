-- 013: Lưu bằng chứng đồng ý xử lý dữ liệu cá nhân (Luật BVDL cá nhân
-- 91/2025/QH15, Điều 9 + Điều 24; Nghị định 356/2025/NĐ-CP).
--
-- * profiles.consent_at / consent_version / age_confirmed: bằng chứng giáo
--   viên đã đồng ý Chính sách bảo mật + Điều khoản sử dụng lúc đăng ký và
--   xác nhận từ đủ 18 tuổi. Bằng chứng gốc nằm trong auth.users.user_metadata
--   (ghi lúc signUp, không cần migration); các cột này chỉ để tra cứu.
-- * classes.guardian_consent_at / guardian_consent_by: dấu giáo viên đã xác
--   nhận được cha mẹ/người giám hộ đồng ý cho học sinh dùng app (khi tạo lớp
--   hoặc nhập danh sách HS).
--
-- Code đọc/ghi các cột này đều tolerant (isMissingSchemaError → bỏ qua) nên
-- app chạy bình thường cả khi chưa chạy file này.
-- CÁCH CHẠY: chạy toàn bộ file trong Supabase SQL Editor.

alter table public.profiles
  add column if not exists consent_at timestamptz,
  add column if not exists consent_version text,
  add column if not exists age_confirmed boolean not null default false;

alter table public.classes
  add column if not exists guardian_consent_at timestamptz,
  add column if not exists guardian_consent_by uuid references auth.users(id) on delete set null;
