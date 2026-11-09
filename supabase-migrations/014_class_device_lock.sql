-- 014: Khóa thiết bị học sinh mặc định TẮT + công tắc khóa theo từng lớp.
-- (bác chốt 09/11/2026)
-- 1. Quyền quản trị: mặc định TẮT khóa thiết bị — tài khoản mới có
--    no_device_lock = true; các tài khoản cũ cũng chuyển sang true để
--    thống nhất mặc định tắt (admin vẫn bật lại được từng tài khoản ở
--    trang Quản trị; bật ở đó = khóa cho mọi lớp của giáo viên đó).
-- 2. Thêm công tắc theo từng lớp: classes.device_lock_enabled, mặc định
--    false (tắt). Giáo viên bật/tắt ở màn hình chính mỗi lớp, nút
--    "Khóa thiết bị học sinh" ngay sau nút "Mở khóa".
--    Khóa chỉ có tác dụng với lớp đó khi: công tắc lớp BẬT, hoặc tài
--    khoản đó đang bật khóa ở quyền quản trị.
-- Chạy file này trong Supabase SQL Editor. Trước khi chạy, code vẫn chạy
-- bình thường (coi như công tắc lớp đang TẮT) nhờ cơ chế tolerant.
alter table public.profiles
  alter column no_device_lock set default true;

update public.profiles
  set no_device_lock = true
  where no_device_lock = false;

alter table public.classes
  add column if not exists device_lock_enabled boolean not null default false;
