-- ============================================================
-- AI CHẤM BÀI (Gemini) — chạy trong Supabase SQL Editor (idempotent).
-- Key Gemini lưu riêng theo giáo viên. Điểm AI chỉ lên sổ khi GV duyệt.
-- ============================================================

alter table public.sessions
  add column if not exists ai_enabled boolean not null default false;

alter table public.sessions
  add column if not exists ai_rubric text;

alter table public.sessions
  add column if not exists ai_max_score numeric not null default 10;

create table if not exists public.teacher_ai_settings (
  teacher_id uuid primary key references auth.users(id) on delete cascade,
  gemini_api_key text,
  gemini_tier text not null default 'free',
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'teacher_ai_settings_tier_check'
      and conrelid = 'public.teacher_ai_settings'::regclass
  ) then
    alter table public.teacher_ai_settings
      add constraint teacher_ai_settings_tier_check
      check (gemini_tier in ('free', 'pro'));
  end if;
end $$;

create table if not exists public.ai_grade_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued',
  total int not null default 0,
  completed int not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_grade_jobs_status_check'
      and conrelid = 'public.ai_grade_jobs'::regclass
  ) then
    alter table public.ai_grade_jobs
      add constraint ai_grade_jobs_status_check
      check (status in ('queued', 'running', 'done', 'error'));
  end if;
end $$;

create index if not exists ai_grade_jobs_session_idx on public.ai_grade_jobs(session_id, created_at desc);

create table if not exists public.ai_grade_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_grade_jobs(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  session_group_id uuid references public.session_groups(id) on delete set null,
  session_slot_id uuid references public.session_slots(id) on delete set null,
  submission_id uuid references public.submissions(id) on delete set null,
  ai_score numeric,
  ai_feedback text,
  transcript text,
  unreadable boolean not null default false,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_grade_results_status_check'
      and conrelid = 'public.ai_grade_results'::regclass
  ) then
    alter table public.ai_grade_results
      add constraint ai_grade_results_status_check
      check (status in ('pending', 'ready', 'error', 'approved', 'rejected'));
  end if;
end $$;

create index if not exists ai_grade_results_job_idx on public.ai_grade_results(job_id);
create index if not exists ai_grade_results_session_idx on public.ai_grade_results(session_id);

alter table public.teacher_ai_settings enable row level security;
alter table public.ai_grade_jobs enable row level security;
alter table public.ai_grade_results enable row level security;

drop policy if exists teacher_ai_settings_own on public.teacher_ai_settings;
create policy teacher_ai_settings_own on public.teacher_ai_settings
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

drop policy if exists ai_grade_jobs_public_all on public.ai_grade_jobs;
create policy ai_grade_jobs_public_all on public.ai_grade_jobs for all using (true) with check (true);

drop policy if exists ai_grade_results_public_all on public.ai_grade_results;
create policy ai_grade_results_public_all on public.ai_grade_results for all using (true) with check (true);

do $$
begin
  begin
    alter publication supabase_realtime add table public.ai_grade_jobs;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.ai_grade_results;
  exception when duplicate_object then null;
  end;
end $$;
