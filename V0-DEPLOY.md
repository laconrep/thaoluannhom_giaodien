# V0.DEPLOY - Hướng dẫn deploy qua v0.app

File này là tài liệu deploy chuẩn cho v0.app. Khi deploy project từ GitHub qua v0.app, hãy đọc file này và làm theo đúng thứ tự để app chạy không bị lỗi.

## 1. Tổng quan

- **App**: Next.js 16 (tạo từ v0.dev), dùng **pnpm** làm package manager (`pnpm-lock.yaml`).
- **Backend**: Supabase (auth + PostgreSQL + Storage + Realtime).
- **Yêu cầu runtime**: Node.js >= 20.9 (khuyến nghị 22+).

Quy trình deploy tổng quát:

```text
1. Kết nối repo GitHub vào v0.app
2. Cấu hình biến môi trường (mục 2)
3. Chạy toàn bộ SQL Supabase (mục 3)
4. Deploy (mục 4)
5. Kiểm tra (mục 5)
```

## 2. Biến môi trường

### 2.1 Danh sách đầy đủ (đã rà soát toàn bộ code)

| # | Tên biến | Bắt buộc | Vị trí dùng | Lấy từ đâu |
|---|----------|----------|-------------|------------|
| 1 | `NEXT_PUBLIC_SUPABASE_URL` | Có | client/server/proxy/admin | Supabase > Settings > API > Project URL |
| 2 | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Có* | client/server/proxy/admin | Supabase > Settings > API > anon `publishable` key |
| 3 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Có* | client/server/proxy/admin | Supabase > Settings > API > anon `public` key |
| 4 | `SUPABASE_URL` | Không | server/admin | Dự phòng cho `NEXT_PUBLIC_SUPABASE_URL` |
| 5 | `SUPABASE_ANON_KEY` | Không | server/proxy | Dự phòng cho key anon ở server |
| 6 | `SUPABASE_SERVICE_ROLE_KEY` | Không** | admin | Supabase > Settings > API > `service_role` secret |
| 7 | `SUPABASE_SERVICE_KEY` | Không** | admin | Bí danh của `SUPABASE_SERVICE_ROLE_KEY` |
| 8 | `SUPABASE_SECRET_KEY` | Không** | admin | Bí danh của `SUPABASE_SERVICE_ROLE_KEY` |
| 9 | `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | Không | sign-up page | URL redirect sau đăng ký (có fallback tự động) |
| 10 | `NODE_ENV` | Không | layout | Built-in, không cần cấu hình |

Ghi chú:
- `*`: Bắt buộc ít nhất 1 trong 2 biến `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` hoặc `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Nên đặt cả 2 cho an toàn.
- `**`: Cần để các admin API (tạo lớp/xóa dữ liệu quản trị) chạy đầy đủ. Nếu thiếu, `createAdminClient()` trả về `null` và các tính năng admin bị vô hiệu.
- Biến `NEXT_PUBLIC_*` phải có tiền tố `NEXT_PUBLIC_` để được public sang trình duyệt, nếu không client sẽ lỗi.

### 2.2 Bảng giá trị cần điền (mẫu `.env.example`)

```env
# ===== BẮT BUỘC =====
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-publishable-key>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# ===== SERVER / ADMIN (nên có) =====
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-secret-key>

# ===== TÙY CHỌN =====
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=https://<domain>/auth/callback
```

### 2.3 Cách điền trên v0.app / Vercel

1. Vào **Settings > Environment Variables** của project trên v0.app.
2. Nhập từng biến theo bảng mục 2.1.
3. Với biến có tiền tố `NEXT_PUBLIC_` chọn **Preview** + **Production**.
4. Bí mật (`SUPABASE_SERVICE_ROLE_KEY`) chỉ bật Production.
5. Không commit secret vào repository hoặc code.

## 3. Chạy toàn bộ SQL Supabase (one-click)

> SQL dưới đây gộp từ `scripts/one-click-supabase.sql` (đã gộp luôn các migration `000` → `070`). Chạy **1 lần** trên Supabase SQL Editor. Idempotent: có thể chạy lại an toàn.

### 3.1 Các bước

1. Mở **Supabase Dashboard** của project đã kết nối.
2. Vào **SQL Editor**.
3. Dán **toàn bộ** khối SQL ở mục 3.2 vào query mới.
4. Bấm **Run**, chờ hoàn tất (không có lỗi đỏ).
5. Nếu có warning "table already exists" là bình thường.

### 3.2 Nội dung SQL

```sql
-- ============================================================
-- ONE-CLICK SUPABASE SETUP
-- Dán toàn bộ nội dung này vào Supabase SQL Editor và bấm Run một lần.
-- File gồm schema, RLS, Realtime và Storage bucket cho ứng dụng.
-- Có thể chạy lại an toàn trên database mới/đã có một phần schema.
-- ============================================================

-- ============ LỚP HỌC ============
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  capacity int not null default 48,
  share_token text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

create index if not exists classes_teacher_idx on public.classes(teacher_id);
create unique index if not exists classes_share_token_uidx on public.classes(share_token);

-- ============ HỌC SINH (ô trong lớp) ============
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  slot_number int not null,
  name text,
  device_token text,
  created_at timestamptz not null default now(),
  unique (class_id, slot_number)
);

create index if not exists students_class_idx on public.students(class_id);

-- ============ NHÓM CỐ ĐỊNH CỦA LỚP ============
create table if not exists public.class_groups (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  group_number int not null default 0,
  label text,
  name text not null,
  color text not null default '#0d9488',
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists class_groups_class_id_idx on public.class_groups(class_id, display_order);
create unique index if not exists class_groups_class_number_uidx on public.class_groups(class_id, group_number);

-- Thành viên nhóm cố định, 1 HS chỉ thuộc 1 nhóm trong 1 lớp
create table if not exists public.class_group_members (
  class_group_id uuid not null references public.class_groups(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (class_group_id, student_id)
);

-- Constraint: 1 HS chỉ thuộc tối đa 1 class_group
create or replace function public.enforce_single_class_group()
returns trigger
language plpgsql
as $$
declare
  v_class_id uuid;
  v_existing int;
begin
  select class_id into v_class_id from public.class_groups where id = new.class_group_id;
  select count(*) into v_existing
  from public.class_group_members m
  join public.class_groups g on g.id = m.class_group_id
  where g.class_id = v_class_id
    and m.student_id = new.student_id
    and m.class_group_id <> new.class_group_id;
  if v_existing > 0 then
    raise exception 'Học sinh đã thuộc một nhóm khác trong lớp này';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_class_group_members_single on public.class_group_members;
create trigger trg_class_group_members_single
before insert or update on public.class_group_members
for each row execute function public.enforce_single_class_group();

-- ============ PHIÊN THẢO LUẬN ============
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  kind text not null default 'group' check (kind in ('group', 'individual')),
  duration_seconds int not null default 900,
  started_at timestamptz,
  ends_at timestamptz,
  status text not null default 'idle' check (status in ('idle', 'running', 'ended')),
  scores_shared boolean not null default false,
  allow_paste boolean not null default false,
  results_shared_at timestamptz,
  allow_download boolean not null default false,
  use_fixed_groups boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists sessions_class_idx on public.sessions(class_id);

-- Nhóm phiên (dùng nhóm cố định hoặc chia lại)
create table if not exists public.session_groups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  class_group_id uuid references public.class_groups(id) on delete set null,
  group_number int not null,
  label text not null default '',
  claimed boolean not null default false,
  claimed_at timestamptz
);

create index if not exists session_groups_session_idx on public.session_groups(session_id);

-- Thành viên nhóm phiên (chỉ dùng khi chia lại nhóm)
create table if not exists public.session_group_members (
  session_group_id uuid not null references public.session_groups(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (session_group_id, student_id)
);

create index if not exists session_group_members_student_idx on public.session_group_members(student_id);

-- Ô cá nhân (phiên làm bài cá nhân)
create table if not exists public.session_slots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  slot_number int not null,
  student_id uuid references public.students(id) on delete set null,
  unique (session_id, slot_number)
);

create index if not exists session_slots_session_idx on public.session_slots(session_id);

-- ============ BÀI NỘP ============
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  session_group_id uuid references public.session_groups(id) on delete set null,
  session_slot_id uuid references public.session_slots(id) on delete set null,
  image_url text,
  text_content text,
  files jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  is_auto_submitted boolean not null default false
);

create index if not exists submissions_session_idx on public.submissions(session_id);
create index if not exists submissions_group_idx on public.submissions(session_group_id);
create index if not exists submissions_slot_idx on public.submissions(session_slot_id);

-- ============ CHẤM ĐIỂM / GHI CHÚ ============
create table if not exists public.annotations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  session_group_id uuid references public.session_groups(id) on delete set null,
  session_slot_id uuid references public.session_slots(id) on delete set null,
  data jsonb not null default '[]'::jsonb,
  score numeric,
  updated_at timestamptz not null default now()
);

create index if not exists annotations_session_idx on public.annotations(session_id);
create index if not exists annotations_group_idx on public.annotations(session_group_id);
create index if not exists annotations_slot_idx on public.annotations(session_slot_id);

create table if not exists public.student_scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric,
  group_name text,
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists student_scores_session_idx on public.student_scores(session_id);

-- Lịch sử thay đổi điểm (audit trail)
create table if not exists public.score_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  source text not null default 'manual',
  score_old numeric,
  score_new numeric,
  created_at timestamptz not null default now()
);

create index if not exists score_history_student_idx on public.score_history(student_id, session_id);
create index if not exists score_history_created_idx on public.score_history(created_at);

-- ============ GÓI DÙNG CỦA GIÁO VIÊN ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'school')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ BÀI TRÌNH CHIẾU ============
create table if not exists public.presentations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_path text,
  storage_path text not null,
  slide_count int not null default 0,
  current_slide int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists presentations_session_id_idx on public.presentations(session_id);
create index if not exists presentations_teacher_id_idx on public.presentations(teacher_id);

create table if not exists public.presentation_slides (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  slide_number int not null,
  image_path text not null,
  created_at timestamptz not null default now(),
  unique (presentation_id, slide_number)
);

create index if not exists presentation_slides_presentation_id_idx on public.presentation_slides(presentation_id);

-- ============ RLS ============
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.class_groups enable row level security;
alter table public.class_group_members enable row level security;
alter table public.sessions enable row level security;
alter table public.session_groups enable row level security;
alter table public.session_group_members enable row level security;
alter table public.session_slots enable row level security;
alter table public.submissions enable row level security;
alter table public.annotations enable row level security;
alter table public.student_scores enable row level security;
alter table public.score_history enable row level security;
alter table public.profiles enable row level security;
alter table public.presentations enable row level security;
alter table public.presentation_slides enable row level security;

-- Chính sách công khai cho mọi bảng (ứng dụng tự kiểm tra quyền)
drop policy if exists classes_public_all on public.classes;
create policy classes_public_all on public.classes for all using (true) with check (true);

drop policy if exists students_public_all on public.students;
create policy students_public_all on public.students for all using (true) with check (true);

drop policy if exists cg_public_all on public.class_groups;
create policy cg_public_all on public.class_groups for all using (true) with check (true);

drop policy if exists cgm_public_all on public.class_group_members;
create policy cgm_public_all on public.class_group_members for all using (true) with check (true);

drop policy if exists sessions_public_all on public.sessions;
create policy sessions_public_all on public.sessions for all using (true) with check (true);

drop policy if exists session_groups_public_all on public.session_groups;
create policy session_groups_public_all on public.session_groups for all using (true) with check (true);

drop policy if exists sgm_public_all on public.session_group_members;
create policy sgm_public_all on public.session_group_members for all using (true) with check (true);

drop policy if exists session_slots_public_all on public.session_slots;
create policy session_slots_public_all on public.session_slots for all using (true) with check (true);

drop policy if exists submissions_public_all on public.submissions;
create policy submissions_public_all on public.submissions for all using (true) with check (true);

drop policy if exists annotations_public_all on public.annotations;
create policy annotations_public_all on public.annotations for all using (true) with check (true);

drop policy if exists student_scores_public_all on public.student_scores;
create policy student_scores_public_all on public.student_scores for all using (true) with check (true);

drop policy if exists sh_public_all on public.score_history;
create policy sh_public_all on public.score_history for all using (true) with check (true);

drop policy if exists profiles_public_all on public.profiles;
create policy profiles_public_all on public.profiles for all using (true) with check (true);

drop policy if exists presentations_public_all on public.presentations;
create policy presentations_public_all on public.presentations for all using (true) with check (true);

drop policy if exists presentation_slides_public_all on public.presentation_slides;
create policy presentation_slides_public_all on public.presentation_slides for all using (true) with check (true);

-- ============ REALTIME ============
alter publication supabase_realtime add table public.classes;
alter publication supabase_realtime add table public.students;
alter publication supabase_realtime add table public.class_groups;
alter publication supabase_realtime add table public.class_group_members;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.session_groups;
alter publication supabase_realtime add table public.session_group_members;
alter publication supabase_realtime add table public.session_slots;
alter publication supabase_realtime add table public.submissions;
alter publication supabase_realtime add table public.annotations;
alter publication supabase_realtime add table public.student_scores;
alter publication supabase_realtime add table public.score_history;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.presentations;
alter publication supabase_realtime add table public.presentation_slides;

-- ============ NHÓM TRƯỞNG ============
alter table public.class_groups
  add column if not exists leader_student_id uuid references public.students(id) on delete set null;
create index if not exists class_groups_leader_idx on public.class_groups(leader_student_id);

-- ============ STORAGE POWERPOINT ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'presentations', 'presentations', false, 52428800,
  array['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint', 'application/zip']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists presentations_storage_insert on storage.objects;
create policy presentations_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'presentations');
drop policy if exists presentations_storage_select on storage.objects;
create policy presentations_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'presentations');
drop policy if exists presentations_storage_update on storage.objects;
create policy presentations_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'presentations') with check (bucket_id = 'presentations');

-- ============ STORAGE BÀI NỘP CỦA HỌC SINH ============
insert into storage.buckets (id, name, public, file_size_limit)
values ('submissions', 'submissions', false, 52428800)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit;

drop policy if exists submissions_storage_insert on storage.objects;
create policy submissions_storage_insert on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'submissions');
drop policy if exists submissions_storage_select on storage.objects;
create policy submissions_storage_select on storage.objects
  for select to anon, authenticated using (bucket_id = 'submissions');
drop policy if exists submissions_storage_update on storage.objects;
create policy submissions_storage_update on storage.objects
  for update to anon, authenticated using (bucket_id = 'submissions') with check (bucket_id = 'submissions');
drop policy if exists submissions_storage_delete on storage.objects;
create policy submissions_storage_delete on storage.objects
  for delete to anon, authenticated using (bucket_id = 'submissions');

notify pgrst, 'reload schema';
-- Setup complete.
```

## 4. Deploy qua v0.app

1. **Kết nối repo**: Trên v0.app, chọn **Import/Connect GitHub repo** chứa project này.
2. **Chọn framework**: v0 tự nhận diện Next.js + pnpm. Build command: `pnpm build` (hoặc `next build`). Output: mặc định.
3. **Điền env**: Nhập các biến trong mục 2 vào Environment Variables.
4. **Chạy SQL**: Làm theo mục 3 (SQL Editor của Supabase project).
5. **Publish/Deploy**: Bấm **Deploy** và chờ build hoàn tất. Lưu ý: mọi commit lên `main` sẽ tự deploy lại.
6. **Kiểm tra domain**: Mở URL production, làm theo checklist mục 5.

Lưu ý build:
- `sharp` được build thủ công (`pnpm-workspace.yaml` có `allowBuilds`), cần Node >= 20.9.
- Nếu gặp lỗi thiếu biến `NEXT_PUBLIC_*`, kiểm tra lại mục 2.1 (biến phải có tiền tố `NEXT_PUBLIC_`).

## 5. Checklist kiểm tra sau deploy

- [ ] Trang chủ (`/`) mở được.
- [ ] Đăng ký tài khoản giáo viên + xác nhận email.
- [ ] Đăng nhập → vào được `/dashboard`.
- [ ] Tạo lớp → xuất hiện trong danh sách.
- [ ] Tạo/kéo thả nhóm trong lớp.
- [ ] Tạo phiên thảo luận (group + individual).
- [ ] Học sinh quét QR / mở link chia sẻ → chọn nhóm.
- [ ] Phân quyền nhóm trưởng.
- [ ] Upload file PowerPoint vào session → slide hiển thị fullscreen, học sinh thấy sync.
- [ ] Nộp bài → điểm số cập nhật.

## 6. Xác minh database

Chạy trong SQL Editor để xác nhận đủ 9 bảng chính:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'classes', 'students', 'class_groups', 'class_group_members',
    'sessions', 'session_groups', 'session_group_members',
    'presentations', 'presentation_slides'
  )
order by table_name;
```

Kiểm tra bucket upload:

```sql
select id, name, public, file_size_limit
from storage.buckets
where id in ('presentations', 'submissions');
```

## 7. Troubleshooting

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| `Supabase browser configuration is missing` | Thiếu `NEXT_PUBLIC_*` | Điền `NEXT_PUBLIC_SUPABASE_URL` + key anon |
| `Supabase server configuration is missing` | Thiếu env ở server | Điền `SUPABASE_URL` + `SUPABASE_ANON_KEY` |
| `could not find table` | Chưa chạy SQL | Chạy lại mục 3.2 trên đúng Supabase project |
| `could not find function public.enforce_single_class_group` | Chạy SQL thiếu phần function | Chạy lại toàn bộ mục 3.2 |
| Lỗi upload PowerPoint | Thiếu bucket `presentations` / MIME | Chạy lại mục 3.2 hoặc tạo bucket thủ công |
| Lỗi upload bài nộp | Thiếu bucket `submissions` | Chạy lại mục 3.2 |
| Realtime không sync | Thiếu publication | Chạy lại phần `REALTIME` trong mục 3.2 |
| Build fail vì thiếu env | Env chưa set trên Production | Kiểm tra mục 2.3 |
| Đăng nhập 404 callback | `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` sai | Đặt đúng domain hoặc xóa biến để dùng fallback |
