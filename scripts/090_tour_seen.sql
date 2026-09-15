-- Trạng thái "đã xem tour hướng dẫn" lưu theo tài khoản giáo viên.
-- Nhờ vậy tour chỉ hiện một lần trên mỗi tài khoản, ở bất kỳ trình duyệt nào.
-- Chạy trong Supabase SQL Editor (idempotent).

create table if not exists public.teacher_tour_seen (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  tour_key text not null,
  seen_at timestamptz not null default now(),
  primary key (teacher_id, tour_key)
);

alter table public.teacher_tour_seen enable row level security;

drop policy if exists teacher_tour_seen_public_all on public.teacher_tour_seen;
create policy teacher_tour_seen_public_all on public.teacher_tour_seen
  for all using (true) with check (true);
