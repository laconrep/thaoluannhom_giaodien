-- Migration: yêu cầu "AI đánh giá tổng thể" (Muse chat backend xử lý)
-- Chạy trong Supabase Dashboard → SQL Editor (1 lần duy nhất)
--
-- Luồng: giáo viên bấm nút "Đánh giá tổng thể" trong trang duyệt
-- → app tạo dòng pending → hook claim (pending→processing) trong ~5s
-- → worker đọc toàn bộ kết quả đã chấm của phiên, tính thống kê +
--    tổng hợp nhận xét, ghi result_json → done → popup tự hiện báo cáo.

create table if not exists public.ai_eval_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'error')),
  result_json jsonb null,
  error_message text null,
  created_at timestamptz not null default now(),
  finished_at timestamptz null
);

create index if not exists ai_eval_requests_pending_idx
  on public.ai_eval_requests (status, created_at)
  where status = 'pending';

create index if not exists ai_eval_requests_session_idx
  on public.ai_eval_requests (session_id, created_at desc);

alter table public.ai_eval_requests enable row level security;

drop policy if exists "teachers manage own eval requests" on public.ai_eval_requests;
create policy "teachers manage own eval requests"
  on public.ai_eval_requests
  for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

comment on table public.ai_eval_requests is 'Yêu cầu AI đánh giá tổng thể cả phiên (Muse chat backend xử lý qua hook)';
