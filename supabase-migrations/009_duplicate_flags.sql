-- 009: Cờ cảnh báo trùng bài cho phiên cá nhân.
-- Khi HS nộp bài, server so với các bài khác trong cùng phiên:
--   kind='text'  : nội dung chữ (text_content đã chuẩn hoá) giống hệt nhau.
--   kind='image' : ảnh có aHash giống từ 90% trở lên (cùng tờ giấy chụp lại).
-- CHỈ cảnh báo cho giáo viên trên bảng chấm — không chặn nộp, không trừ điểm.
-- Chạy file này trong Supabase SQL Editor. Trước khi chạy, code vẫn chạy bình
-- thường (cờ chỉ đơn giản là chưa được ghi).
create table if not exists public.submission_duplicate_flags (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  submission_id uuid not null,
  matched_submission_id uuid not null,
  matched_slot_id uuid not null,
  kind text not null check (kind in ('text', 'image')),
  similarity integer not null check (similarity between 0 and 100),
  created_at timestamptz not null default now()
);
create index if not exists submission_duplicate_flags_session_idx
  on public.submission_duplicate_flags (session_id, submission_id);

alter table public.submission_duplicate_flags enable row level security;
-- Theo chuẩn các bảng AI hiện có (ai_grade_jobs/results): mở cho mọi client,
-- trang HS không bao giờ truy vấn bảng này nên thực tế chỉ GV thấy cờ trên bảng.
drop policy if exists submission_duplicate_flags_public_all on public.submission_duplicate_flags;
create policy submission_duplicate_flags_public_all on public.submission_duplicate_flags
  for all using (true) with check (true);
