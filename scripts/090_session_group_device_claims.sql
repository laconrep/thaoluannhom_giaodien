alter table public.session_groups
  add column if not exists claimed_devices text[] not null default '{}';

create index if not exists session_groups_claimed_devices_idx
  on public.session_groups using gin (claimed_devices);
