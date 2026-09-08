# quantri1 — Trang quản trị tài khoản

Mục đích file này: phiên code sau đọc file này là đủ để code tiếp, không cần đọc lại toàn bộ repo.

Cập nhật lần cuối: 2026-09-08 — Phiên 3 đã xong. Phiên 4–6 chưa làm.

Admin duy nhất (allowlist cứng): `gagabux95@gmail.com`
Các tài khoản khác không thấy link và không vào được `/admin`.

---

## 1. Bối cảnh repo (đã khảo sát, đừng đọc lại)

Stack: Next.js 16 (App Router) + Supabase Auth + pnpm. Workspace: `/workspace`. Không có git submodule.

Gói hiện có (`lib/plans.ts`):

- `free` — mặc định (`PLAN_DEFAULT`)
- `pro`
- `school`

Bảng `public.profiles` hiện tại (`scripts/050_plans.sql`, `scripts/000_schema.sql`):

```
id uuid PK -> auth.users(id) on delete cascade
plan text not null default 'free' check (plan in ('free','pro','school'))
created_at timestamptz
updated_at timestamptz
```

Thiếu: `role`, `status`/disabled, email (email nằm ở `auth.users`).

Auth:

- Đăng nhập: `app/auth/login/page.tsx` — `signInWithPassword`
- Đăng ký: `app/auth/sign-up/page.tsx`
- Callback: `app/auth/callback/route.ts`
- Middleware: `middleware.ts` -> `lib/supabase/proxy.ts`
- Protected hiện tại: chỉ `/dashboard`, `/classes`. `/admin` CHƯA được bảo vệ.
- Pricing: `/pricing` — user tự chọn gói; `upgradeToPlanAction` trong `app/actions.ts` CHỈ cho phép đổi sang `free`. Nâng pro/school bị chặn: "Nâng cấp gói cần được xác nhận qua thanh toán."

Admin client sẵn có: `lib/supabase/admin.ts` — `createAdminClient()` dùng `SUPABASE_SERVICE_ROLE_KEY` (fallback anon). Dùng cái này để list `auth.users` (lấy email) và cập nhật profile vượt RLS.

UI giáo viên: `components/teacher-shell.tsx` — link Dashboard + Gói sử dụng. Chưa có link admin.

Quota gói được check khi tạo lớp / nhập HS / upload trình chiếu (`app/actions.ts`, `app/api/presentations/upload/route.ts`).

RLS profiles hiện `using (true)` (mở). Vẫn phải kiểm tra quyền ở server action, không tin client.

---

## 2. Quyết định thiết kế (đã chốt với user)

1. Trang quản trị: `/admin`
2. Chỉ `gagabux95@gmail.com` được vào. User khác: không thấy link; gõ URL thì redirect `/dashboard` (đã login) hoặc `/auth/login`.
3. Trang hiện: email tài khoản theo gói free / pro / school.
4. Admin được: kích hoạt tài khoản, chấm dứt tài khoản, đổi gói (free <-> pro <-> school).
5. "Chấm dứt" = `status = 'disabled'`. Tài khoản disabled không đăng nhập / không dùng dashboard. Không xóa user (cấm `rm`/xóa dữ liệu).
6. "Kích hoạt" = `status = 'active'`.
7. Đổi gói do admin: server action tin cậy, không qua thanh toán.
8. Allowlist email cứng trong code + cột `profiles.role = 'admin'` (dự phòng). Phải thỏa 1 trong 2 (ưu tiên allowlist email để chắc chắn email này luôn là admin dù DB chưa migrate).

---

## 3. Việc ĐÃ LÀM

- [x] Khảo sát repo: plans, profiles, auth, middleware, teacher-shell, admin client.
- [x] Thống nhất yêu cầu với user (trang admin, ẩn với user thường, activate/terminate, đổi gói).
- [x] Viết kế hoạch 6 phiên trong file này.
- [x] Phiên 1: `scripts/080_admin.sql` + `lib/admin.ts`.
- [x] Phiên 2: chặn `/admin` + tài khoản disabled.
- [x] Phiên 3: trang `/admin` danh sách tài khoản theo gói.

---

## 4. Việc CHƯA LÀM — chia 6 phiên

Quy ước: mỗi phiên xong phải đánh dấu checkbox trong mục này và ghi "Phiên N đã xong" ở mục 6. Phiên sau chỉ làm phần còn ` [ ] `.

BẮT BUỘC: sau mỗi phiên code xong phải `git add` đúng files vừa đụng, `git commit`, rồi `git push` lên GitHub (`origin`, nhánh hiện tại). Không để code nằm local. Không commit secret. Phiên 1 chưa push — phiên sau nếu thấy chưa push thì push trước khi làm tiếp.

### Phiên 1 — Schema + helper quyền admin

Mục tiêu: DB và hàm kiểm tra admin, chưa có UI.

Files tạo/sửa:

- Tạo `scripts/080_admin.sql`
  - `alter table public.profiles add column if not exists role text not null default 'user' check (role in ('user','admin'));`
  - `alter table public.profiles add column if not exists status text not null default 'active' check (status in ('active','disabled'));`
  - Trigger `on_auth_user_created`: insert `profiles (id, plan, role, status)` khi user mới đăng ký. Role = `admin` nếu email = `gagabux95@gmail.com`, else `user`.
  - `update profiles set role = 'admin' where id in (select id from auth.users where lower(email) = 'gagabux95@gmail.com');` (idempotent)
- Tạo `lib/admin.ts`
  - `ADMIN_EMAILS = ['gagabux95@gmail.com']` (so sánh lowercase)
  - `isAdminEmail(email: string | null | undefined): boolean`
  - `requireAdmin()`: lấy user từ `createClient()`, nếu chưa login -> redirect `/auth/login?next=/admin`. Nếu không phải admin email -> redirect `/dashboard`. Trả về `{ user, supabase, admin }` (admin = createAdminClient).
- Không đụng UI.

Xong phiên 1 khi: SQL + `lib/admin.ts` tồn tại, typecheck không lỗi.

### Phiên 2 — Chặn truy cập /admin và chặn tài khoản disabled

Mục tiêu: bảo vệ route, chưa có bảng quản trị.

Files sửa:

- `lib/supabase/proxy.ts`
  - Thêm `/admin` vào `protectedPrefixes` (bắt login).
  - Không check admin email trong middleware (middleware không nên query DB nặng). Check admin ở page/layout server.
  - (Tuỳ chọn nhẹ) nếu dễ: đọc cookie session email; nếu path `/admin` và email không thuộc allowlist thì redirect. Ưu tiên check ở layout cho chắc.
- Tạo `app/admin/layout.tsx`: gọi `requireAdmin()`, bọc children. User thường không render được.
- Chặn disabled:
  - Sau `getUser()`, nếu `profiles.status === 'disabled'` thì signOut + redirect login kèm message. Làm trong `requireAdmin` không đủ — cần chặn dashboard/classes luôn.
  - Helper `assertActiveAccount(userId)` dùng ở `TeacherShell` layout hoặc đầu `updateSession` không query được dễ. Cách gọn: check trong `app/dashboard/page.tsx` + `app/classes/[id]/layout.tsx` + `requireAdmin`. Tốt hơn: một helper `ensureActiveUser()` gọi từ dashboard layout và admin layout.
  - Nếu chưa có layout dashboard chung: tạo helper `lib/account-status.ts` và gọi từ `dashboard/page.tsx`, `classes/[id]/layout.tsx`, `pricing/page.tsx`, `admin/layout.tsx`.

Xong phiên 2 khi: user thường vào `/admin` bị đá về dashboard; user chưa login bị đá login; disabled không dùng được app.

### Phiên 3 — Trang `/admin` danh sách tài khoản theo gói

Mục tiêu: xem được email + gói + trạng thái. Chưa có nút hành động.

Files tạo:

- `app/admin/page.tsx` (server component)
  - `requireAdmin()`
  - Dùng `createAdminClient()`:
    - `auth.admin.listUsers()` để lấy email + id + created_at + last_sign_in
    - `from('profiles').select('id, plan, role, status, updated_at')`
    - Join trong memory theo `id`
  - UI 3 khối (hoặc tabs): Gói Free / Gói Pro / Gói School. Mỗi khối: bảng email, ngày tạo, status (active/disabled), role.
  - Thống kê đầu trang: tổng user, số free, số pro, số school, số disabled.
  - Style giống TeacherShell / card hiện có (`components/ui/table`, `badge`, `card`). Có thể dùng shell riêng `AdminShell` tối giản, không hiện link này trên TeacherShell của user thường.
- Tạo `components/admin-shell.tsx`: header "Quản trị", email admin, đăng xuất, link về dashboard. Không gắn vào TeacherShell.

Xong phiên 3 khi: admin login thấy danh sách thật. User khác không thấy.

### Phiên 4 — Kích hoạt / chấm dứt tài khoản

Mục tiêu: nút hoạt động trên từng hàng.

Files:

- Thêm server actions vào file MỚI `app/admin/actions.ts` (đừng nhồi `app/actions.ts` vốn đã rất dài).
  - `assertAdminActor()` — gọi `requireAdmin` logic, throw nếu không phải admin.
  - `setAccountStatusAction(userId: string, status: 'active' | 'disabled')`
    - Không cho disabled chính mình (admin email).
    - Update `profiles.status` bằng admin client.
    - revalidatePath('/admin')
- UI phiên 3: cột thao tác — nút "Chấm dứt" khi active, nút "Kích hoạt" khi disabled. Dùng `alert-dialog` xác nhận.
- Đảm bảo phiên 2 đã chặn disabled; nếu chưa xong thì hoàn tất check disabled ở đây.

Xong phiên 4 khi: bấm chấm dứt -> status disabled, user đó không vào dashboard; bấm kích hoạt -> dùng lại được. Admin không tự khóa mình.

### Phiên 5 — Đổi gói (nâng/hạ) do admin

Mục tiêu: admin đổi free/pro/school không qua thanh toán.

Files:

- `app/admin/actions.ts`
  - `setAccountPlanAction(userId: string, plan: Plan)`
    - Validate plan in `free|pro|school`
    - Upsert `profiles.plan` + `updated_at` bằng admin client
    - revalidatePath('/admin')
- UI: select hoặc 3 nút gói trên mỗi hàng. Confirm trước khi đổi.
- Không sửa `upgradeToPlanAction` của user (vẫn chặn tự nâng pro) — đây là đường admin riêng.

Xong phiên 5 khi: admin đổi gói xong, quota phía user theo gói mới (code quota đã đọc `profiles.plan`).

### Phiên 6 — Link ẩn/hiện, tinh chỉnh, kiểm tra

Mục tiêu: hoàn thiện, không lộ trang với user thường.

Files:

- `components/teacher-shell.tsx`: chỉ render link "Quản trị" -> `/admin` khi `isAdminEmail(email)`. Truyền thêm prop `isAdmin?: boolean` từ dashboard/classes layout (server đã có email).
- Search/filter trên `/admin` (ô tìm email) — client component nhỏ `app/admin/accounts-table.tsx`.
- Empty state khi một gói chưa có user.
- Chạy `pnpm typecheck` và `pnpm lint`. Sửa lỗi.
- Cập nhật checkbox file này: đánh dấu phiên 1–6 xong.

Không deploy trừ khi user yêu cầu. Không commit trừ khi user yêu cầu.

---

## 5. Files sẽ đụng (checklist nhanh)

Tạo:

- `scripts/080_admin.sql`
- `lib/admin.ts`
- `lib/account-status.ts` (phiên 2)
- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `app/admin/actions.ts`
- `app/admin/accounts-table.tsx` (phiên 6, có thể gộp phiên 3 nếu tiện)
- `components/admin-shell.tsx`

Sửa:

- `lib/supabase/proxy.ts` — thêm prefix `/admin`
- `components/teacher-shell.tsx` — link admin chỉ khi đúng email
- `app/dashboard/page.tsx` và/hoặc `app/classes/[id]/layout.tsx` — chặn disabled
- File này (`quantri1.md`) — tick phiên đã xong

Không sửa trừ khi cần:

- `lib/plans.ts`
- `upgradeToPlanAction` (giữ nguyên chặn user tự nâng)
- Không xóa user / không `rm`

---

## 6. Nhật ký phiên (điền khi code)

### Phiên 1
Status: ĐÃ XONG
Files: `scripts/080_admin.sql`, `lib/admin.ts`
Ghi chú: SQL thêm `profiles.role` + `profiles.status`, trigger tạo profile khi user mới, gán admin cho gagabux95@gmail.com. Helper `isAdminEmail` / `requireAdmin` ưu tiên allowlist email. Chưa UI. User cần chạy SQL trên Supabase.

### Phiên 2
Status: ĐÃ XONG
Files: `lib/account-status.ts`, `app/admin/layout.tsx`, `lib/supabase/proxy.ts`, `app/dashboard/page.tsx`, `app/classes/[id]/layout.tsx`, `app/pricing/page.tsx`, `app/auth/login/page.tsx`
Ghi chú: `/admin` cần login (middleware). Layout admin gọi `requireAdmin` — user thường bị đá dashboard. `ensureActiveUser` chặn status=disabled (thiếu cột thì bỏ qua). Login hiện message `reason=disabled`.

### Phiên 3
Status: ĐÃ XONG
Files: `components/admin-shell.tsx`, `app/admin/page.tsx`
Ghi chú: Trang `/admin` thống kê tổng/free/pro/school/disabled + 3 bảng email theo gói. Join auth.users + profiles. Thiếu service role thì hiện empty state, không crash. Chưa có nút hành động (phiên 4–5). TeacherShell chưa có link (phiên 6).

### Phiên 4
Status: CHƯA LÀM
Ghi chú:

### Phiên 5
Status: CHƯA LÀM
Ghi chú:

### Phiên 6
Status: CHƯA LÀM
Ghi chú:

---

## 7. Hướng dẫn phiên code sau

1. Đọc file này, không đọc cả repo.
2. Làm phiên nhỏ nhất còn `CHƯA LÀM`.
3. Code xong: tick checkbox mục 4, đổi Status mục 6, ghi files đã đụng.
4. Commit + push ngay lên GitHub (origin, nhánh hiện tại). Đây là bước bắt buộc của mỗi phiên, không chờ user nhắc.
5. Dừng. Không làm vượt phiên trừ khi user bảo làm tiếp.
6. SQL `080_admin.sql` cần user chạy trên Supabase SQL Editor (hoặc one-click). Code phải chịu được DB chưa migrate: `requireAdmin` ưu tiên allowlist email; cột `role`/`status` thiếu thì coi `status=active`, `role=user` trừ admin email.

---

## 8. Rủi ro / lưu ý

- `listUsers()` cần service role. Nếu `createAdminClient()` fallback anon thì list sẽ fail — phiên 3 phải báo lỗi rõ, không crash.
- Email chỉ có ở `auth.users`, không có ở `profiles`. Bắt buộc admin client.
- RLS profiles đang mở; vẫn check admin ở server.
- Không hardcode LLM key. Không commit secret.
- So sánh email luôn `.toLowerCase()`.
- `gagabux95@gmail.com` phải tự đăng ký/login bằng email đó thì mới vào `/admin`. SQL chỉ gắn `role=admin` nếu user đó đã tồn tại trong `auth.users`.
