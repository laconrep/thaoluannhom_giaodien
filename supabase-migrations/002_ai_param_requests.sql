-- Migration: bảng yêu cầu "AI chia param tiêu chí chấm"
-- Chạy trong Supabase Dashboard → SQL Editor (1 lần duy nhất)
--
-- Luồng: giáo viên dán đáp án vào popup → app insert dòng status='pending'
-- → hook bên ngoài (Muse chat) claim → tạo param mẫu A → ghi param_json, status='done'
-- → popup poll thấy kết quả → hiện form cho giáo viên chỉnh sửa → lưu vào sessions.ai_rubric

create table if not exists public.ai_param_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  teacher_id uuid not null,
  answer_text text not null,
  max_score numeric not null default 10,
  status text not null default 'pending', -- pending | processing | done | error
  param_json jsonb null,
  error_message text null,
  created_at timestamptz not null default now(),
  finished_at timestamptz null
);

create index if not exists ai_param_requests_pending_idx
  on public.ai_param_requests (status, created_at)
  where status = 'pending';

alter table public.ai_param_requests enable row level security;

drop policy if exists "teachers manage own param requests" on public.ai_param_requests;
create policy "teachers manage own param requests"
  on public.ai_param_requests for all
  using (
    exists (
      select 1 from public.sessions s
      join public.classes c on c.id = s.class_id
      where s.id = ai_param_requests.session_id
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      join public.classes c on c.id = s.class_id
      where s.id = ai_param_requests.session_id
        and c.teacher_id = auth.uid()
    )
  );
