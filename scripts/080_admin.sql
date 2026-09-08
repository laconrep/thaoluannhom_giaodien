-- Quyền admin + trạng thái tài khoản trên public.profiles
-- Chạy trong Supabase SQL Editor (idempotent).

alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles
  add column if not exists status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('user', 'admin'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_status_check check (status in ('active', 'disabled'));
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, plan, role, status)
  values (
    new.id,
    'free',
    case
      when lower(coalesce(new.email, '')) = 'gagabux95@gmail.com' then 'admin'
      else 'user'
    end,
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, plan, role, status)
select u.id, 'free', 'admin', 'active'
from auth.users u
where lower(u.email) = 'gagabux95@gmail.com'
on conflict (id) do update
  set role = 'admin',
      updated_at = now();
