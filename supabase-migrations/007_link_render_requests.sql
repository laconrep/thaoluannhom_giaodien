-- Migration 007: bảng yêu cầu "chụp link Canva thành ảnh"
-- Chạy trong Supabase Dashboard → SQL Editor (1 lần duy nhất)
--
-- Luồng: HS nộp bài bằng link Canva (dán trong text_content, không có file)
-- → giáo viên bấm "Chụp link thành ảnh" trong khung chấm → app insert dòng
-- status='pending' → hook ở trạm chấm của giáo viên claim → mở link bằng
-- trình duyệt, chụp từng trang, tải ảnh lên bucket submissions và gắn vào
-- submissions.files → bài Canva thành bài ảnh (chấm tay từng trang + AI chấm
-- được như bài nộp file). assigned_backend = trạm được gán cho giáo viên
-- (null = trạm chính), giống ai_grade_jobs ở migration 006.

create table if not exists public.link_render_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  teacher_id uuid not null,
  source_url text not null,
  assigned_backend text null,
  status text not null default 'pending', -- pending | processing | done | error
  error_message text null,
  created_at timestamptz not null default now(),
  finished_at timestamptz null
);

create index if not exists link_render_requests_pending_idx
  on public.link_render_requests (status, created_at)
  where status = 'pending';

alter table public.link_render_requests enable row level security;

drop policy if exists "teachers manage own link render requests" on public.link_render_requests;
create policy "teachers manage own link render requests"
  on public.link_render_requests for all
  using (
    exists (
      select 1 from public.sessions s
      join public.classes c on c.id = s.class_id
      where s.id = link_render_requests.session_id
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      join public.classes c on c.id = s.class_id
      where s.id = link_render_requests.session_id
        and c.teacher_id = auth.uid()
    )
  );
