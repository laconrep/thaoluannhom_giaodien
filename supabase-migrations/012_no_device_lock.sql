-- 012: Tắt khóa thiết bị theo tài khoản giáo viên.
-- Admin bật/tắt ở trang Quản trị. Khi bật (no_device_lock = true),
-- học sinh của giáo viên đó được chọn tên tự do trên mọi thiết bị,
-- không còn bị chặn "Tên này đã được chọn trên thiết bị khác".
-- Mặc định false = giữ nguyên hành vi khóa thiết bị như cũ.
-- Chạy file này trong Supabase SQL Editor. Trước khi chạy, code vẫn chạy
-- bình thường (coi như khóa vẫn bật) nhờ cơ chế tolerant trong app.
alter table public.profiles
  add column if not exists no_device_lock boolean not null default false;
