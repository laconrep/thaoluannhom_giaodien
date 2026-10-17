-- 006_farm_stations.sql
-- Farm tram cham: dinh tuyen job muse_chat ve tung tram (tai khoan Muse rieng).
-- Chay trong Supabase SQL Editor. An toan khi chay lai (if not exists).

-- 1. Cot dinh tuyen tren job cham
alter table public.ai_grade_jobs
  add column if not exists assigned_backend text;

-- 2. Danh sach tram cham
create table if not exists public.backend_stations (
  id text primary key,
  label text not null,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'backend_stations_status_check'
      and conrelid = 'public.backend_stations'::regclass
  ) then
    alter table public.backend_stations
      add constraint backend_stations_status_check
      check (status in ('active', 'paused'));
  end if;
end $$;

-- 3. Gan giao vien -> tram (thieu dong = ve tram chinh)
create table if not exists public.teacher_backend_map (
  teacher_id uuid primary key references auth.users(id) on delete cascade,
  station_id text not null references public.backend_stations(id) on delete restrict,
  updated_at timestamptz not null default now()
);

-- 4. RLS (dong bo voi cac bang AI hien co: mo cho authenticated)
alter table public.backend_stations enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policy
    where polname = 'backend_stations_public_all'
      and polrelid = 'public.backend_stations'::regclass
  ) then
    create policy backend_stations_public_all on public.backend_stations
      for all using (true) with check (true);
  end if;
end $$;

alter table public.teacher_backend_map enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policy
    where polname = 'teacher_backend_map_public_all'
      and polrelid = 'public.teacher_backend_map'::regclass
  ) then
    create policy teacher_backend_map_public_all on public.teacher_backend_map
      for all using (true) with check (true);
  end if;
end $$;

-- 5. Seed tram chinh (may nay) — hook mac dinh claim job chua gan tram
insert into public.backend_stations (id, label, notes)
values ('local', 'Tram chinh (may nay)', 'Tram mac dinh cua admin. Hook khong dat BACKEND_ID se claim job chua gan tram.')
on conflict (id) do nothing;
