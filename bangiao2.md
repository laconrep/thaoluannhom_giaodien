# BÀN GIAO 2 — LINK CHIA SẺ: CLAIM Ô BẰNG DEVICE_TOKEN + MỞ KHÓA CHO GV

> File này là tài liệu bàn giao giữa các phiên code. Mỗi phiên chỉ code **1 phần**. Cuối phiên phải cập nhật phần **TIẾN ĐỘ** + **GHI CHÚ PHIÊN VỪA RỒI** + **YÊU CẦU PHIÊN SAU** để phiên sau không cần đọc lại toàn repo.
>
> Quy tắc: mỗi phiên code xong → commit + push + cập nhật file này mới được sang phiên kế. Ở phiên 3, mỗi file sửa xong phải commit + push + cập nhật ngay file này.

---

## MỤC TIÊU TỔNG

Tính năng ở tab **Chia sẻ** (`app/classes/[id]/share`): GV tạo link + QR gửi HS. HS mở link lần đầu → **MÀN 1** chọn ô (lưới thẻ giống roster GV). Bấm thẻ **có tên** → claim `device_token` → vào **MÀN 2** (giao diện Tabs). Mở lại link → tự nhận diện qua `localStorage`/`device_token`, vào thẳng không cần chọn lại (chỉ khi ô đó còn giữ đúng device_token của thiết bị mình).

GV có thể **mở khóa** ô đã bị HS chiếm (khi HS chọn nhầm tên hoặc muốn chuyển sang thiết bị khác).

---

## YÊU CẦU CHI TIẾT

### MÀN 1 — mở link lần đầu (chọn ô)

- Bỏ ô nhập tên (Input `Tên của em`) + nút **"Tôi là ô số..."**.
- Giao diện chọn ô thành lưới thẻ giống roster của GV: mỗi thẻ = số ô + tên HS; thẻ chưa có tên hiện chữ **"Trống"** và **không bấm được** (chỉ bấm thẻ có tên mới chạy).
- Bấm thẻ có tên → gọi server action **mới** `studentClaimSlotAction` để liên kết `device_token` với ô đó (**chỉ set `device_token`, không đụng cột `name`**) → thành công thì lưu `localStorage class_${classId}_student` và vào màn 2.
- Ràng buộc an toàn dùng đúng `.or("device_token.is.null,device_token.eq.${token}")`: nếu ô đã bị thiết bị khác giữ → action trả lỗi `"Ô này đã được thiết bị khác chọn"`, không vào được.

### MÀN 2 — sau khi vào lớp (đổi sang TAB)

- Tab **"Phiên thảo luận"** (mọi HS): danh sách phiên GV tạo như hiện tại + nút **"Xem điểm"** (giữ link `/c/${token}/scores`).
- Tab **"Nhóm của em"** (chỉ hiện với nhóm trưởng): giao diện giống màn phân nhóm của GV — lưới thẻ HS bên trái (tô màu theo nhóm) + thẻ nhóm của mình bên phải:
  - Kéo HS chưa có nhóm thả vào thẻ nhóm → thêm thành viên (qua `leaderUpdateGroupMembersAction` "add").
  - Kéo thẻ HS trong nhóm mình đè lên thẻ khác → hoán đổi vị trí (`leaderSwapSlotsAction`).
  - Realtime đồng bộ với bảng GV (subscribe `students`, `class_groups`, `class_group_members` — đã có sẵn).
- Cơ chế khóa thiết bị: mở lại link → tự nhận diện qua `localStorage`/`device_token`, vào thẳng không cần chọn lại.

### MỞ KHÓA (PHÍA GV)

- Phía GV (màn phân nhóm / roster):
  - Thêm `device_token` vào query `students` ở `roster/page.tsx` + type `Student` ở `roster-view.tsx`.
  - Thẻ HS nào có `device_token` (đang bị thiết bị khác giữ) → hiện icon khóa + nút **"Mở khóa"** trên thẻ.
  - Bấm Mở khóa → xác nhận trước (tránh bấm nhầm) → gọi server action **mới** `unlockStudentSlotAction(studentId)` (xác thực GV đăng nhập) → `set device_token = null`.
  - Trạng thái khóa/mở đồng bộ realtime ngay (roster đã subscribe `students UPDATE`).
- Phía HS (điều chỉnh nhỏ để unlock có hiệu lực):
  - Sửa logic tự nhận diện khi mở lại link: **chỉ vào thẳng qua `localStorage` nếu ô đó còn giữ đúng `device_token` của thiết bị mình**.
  - Nếu GV đã mở khóa (hoặc thiết bị khác đã chiếm) → thiết bị cũ quay về màn chọn ô để chọn lại (giải quyết "chọn nhầm tên"), và ô trống đó cho phép thiết bị khác chọn (giải quyết "mở lại sang thiết bị khác").
  - Luồng bình thường (không bị unlock) vẫn giữ: đóng/mở trình duyệt không xóa `localStorage` → vào thẳng, không cần chọn lại.

---

## KIẾN TRÚC & FILE LIÊN QUAN (BẢN ĐỒ)

| Vai trò | File | Ghi chú |
|---|---|---|
| Server actions | `app/actions.ts` | `"use server"`, dùng `createClient()` từ `@/lib/supabase/server`. Có sẵn `leaderUpdateGroupMembersAction` (dòng ~374), `leaderSwapSlotsAction` (dòng ~521), `studentSetNameAction` (dòng ~999, mẫu cho `.or()` guard), `studentClaimSlotAction` cũ (dòng ~1067, đang claim `session_slots`) |
| Phía HS — màn chọn ô + lobby | `app/c/[token]/class-lobby.tsx` | `ClassLobby` client. `getDeviceToken()` (localStorage `device_token`), identity localStorage `class_${classId}_student`, channel realtime `lobby-${classId}`, UI chọn ô (màn 1), lobby chính (màn 2), dialog nhóm trưởng hiện tại |
| Server component HS | `app/c/[token]/page.tsx` | Query theo `share_token`, đã fetch `students` (có `device_token`), `sessions`, `class_groups`, `class_group_members` |
| Phía GV — roster | `app/classes/[id]/roster/page.tsx` | Query students **chưa** có `device_token` (select `id, slot_number, name`) |
| Phía GV — roster view | `app/classes/[id]/roster/roster-view.tsx` | `RosterView` client. Type `Student` chưa có `device_token`. Realtime subscribe `students` (filter class_id) đã có |
| Gọi action cũ (session_slots) | `app/c/[token]/session/[sid]/student-submit.tsx` | Import + gọi `studentClaimSlotAction` (dòng 35, 233) → **phải đổi tên** sang `studentClaimSessionSlotAction` |
| Schema | `scripts/000_schema.sql` | `students(id, class_id→classes, slot_number, name, device_token, unique(class_id, slot_number))` |

### Pattern tham chiếu

- `.or()` guard mẫu (đã có): `studentSetNameAction` — `supabase.from("students").update({ name, device_token }).eq("id", studentId).or("device_token.is.null,device_token.eq.${deviceToken}")`.
- `studentClaimSlotAction` cũ (claim `session_slots`) mẫu cho action mới: `.or("student_id.is.null,student_id.eq.${studentId}")`, nếu `!updated` → lỗi.
- Xác thực GV qua `supabase.auth.getUser()` + đối chiếu `teacher_id` (mẫu: `getPlan`, `upgradeToPlanAction`).
- FK join mẫu: `.select("class_group_id, class_groups!inner(class_id)")` (đã dùng ở `leaderUpdateGroupMembersAction`).

---

## PHÂN CHIA 3 PHIÊN

### PHIÊN 1 — Server actions (nền tảng)
Sửa **`app/actions.ts`** + **`app/c/[token]/session/[sid]/student-submit.tsx`**:
1. Đổi tên action cũ `studentClaimSlotAction` → **`studentClaimSessionSlotAction`** (giữ nguyên logic claim `session_slots`).
2. Thêm mới **`studentClaimSlotAction(studentId, deviceToken)`** trên bảng `students`:
   - Validate `studentId` + `deviceToken`; chỉ `update({ device_token })`, `.eq("id", studentId)`, `.or("device_token.is.null,device_token.eq.${deviceToken}")`, `.select("id").maybeSingle()`.
   - `!updated` → trả `{ ok: false, error: "Ô này đã được thiết bị khác chọn" }`.
3. Thêm mới **`unlockStudentSlotAction(studentId)`**:
   - `supabase.auth.getUser()` → không có user → trả lỗi "Chỉ giáo viên mới thực hiện được".
   - Lấy student kèm `classes!inner(teacher_id)` → kiểm tra `teacher_id === user.id`, không khớp → trả lỗi.
   - `update({ device_token: null }).eq("id", studentId)`; thành công `revalidatePath("/classes/{classId}/roster")`.
4. `student-submit.tsx`: import + gọi `studentClaimSessionSlotAction`.

Kiểm thử: `pnpm exec tsc --noEmit` + `pnpm exec eslint`. Commit + push + cập nhật file này.

### PHIÊN 2 — Phía học sinh (`app/c/[token]/class-lobby.tsx`)
1. **Màn 1** (khi chưa có `myStudentId`):
   - Bỏ Input tên + nút "Tôi là ô số...".
   - Lưới thẻ: thẻ có tên → bấm được, gọi `studentClaimSlotAction(s.id, getDeviceToken())`; lỗi → toast error. Thẻ trống → disabled, hiện "Trống".
   - Thành công → `localStorage.setItem("class_${classId}_student", s.id)` + `setMyStudentId(s.id)`.
2. **Auto-reentry** (effect dòng ~84-98): chỉ nhận diện nếu ô còn giữ đúng `device_token` của thiết bị; nếu không → xóa localStorage + quay về màn chọn ô.
3. **Màn 2**: bọc giao diện sau khi vào lớp bằng `Tabs` (`@/components/ui/tabs`):
   - Tab "Phiên thảo luận": danh sách phiên hiện tại + nút "Xem điểm" (link `/c/${token}/scores`).
   - Tab "Nhóm của em" (chỉ khi `myLeaderGroup`): lưới thẻ HS trái (tô màu theo nhóm, như roster) + thẻ nhóm mình phải; kéo thả add/swap như đã có (giữ `leaderAdd`/`leaderRemove`/`handleLeaderSwapDrop`).

Kiểm thử: `tsc --noEmit` + `eslint`. Commit + push + cập nhật file này.

### PHIÊN 3 — Phía giáo viên (`app/classes/[id]/roster/page.tsx` + `roster-view.tsx`)
1. `roster/page.tsx`: select students thêm `device_token`.
2. `roster-view.tsx`:
   - Type `Student` thêm `device_token: string | null`.
   - `refreshStudents` select thêm `device_token`.
   - Thẻ HS có `device_token` → icon `Lock` + nút "Mở khóa" (xác nhận trước, gọi `unlockStudentSlotAction`).
3. Mỗi file sửa xong: commit + push + **cập nhật ngay** file này (yêu cầu đặc biệt của phiên 3).

Kiểm thử cuối: `tsc --noEmit` + `eslint`.

---

## TIẾN ĐỘ

- [x] **PHIÊN 1 — Server actions** (`app/actions.ts` + `student-submit.tsx`)
- [ ] **PHIÊN 2 — Phía HS** (`class-lobby.tsx`)
- [ ] **PHIÊN 3 — Phía GV** (`roster/page.tsx` + `roster-view.tsx`)

---

## GHI CHÚ PHIÊN VỪA RỒI

### Phiên 1 — Đã hoàn thành Phần 1 (Server actions)

Trên nhánh `260822-feat-share-claim-unlock`:
- `app/actions.ts`:
  - Đổi tên action cũ `studentClaimSlotAction` (claim `session_slots`) → **`studentClaimSessionSlotAction`** (logic giữ nguyên).
  - Thêm mới **`studentClaimSlotAction(studentId, deviceToken)`**: chỉ `update({ device_token })` trên bảng `students`, `.eq("id", studentId)`, `.or("device_token.is.null,device_token.eq.${deviceToken}")`, `.select("id").maybeSingle()`; `!updated` → trả `{ ok: false, error: "Ô này đã được thiết bị khác chọn" }`. KHÔNG đụng cột `name`.
  - Thêm mới **`unlockStudentSlotAction(studentId)`**: `auth.getUser()` không có user → lỗi "Chỉ giáo viên mới thực hiện được."; lấy student kèm `classes!inner(teacher_id)`, so `teacher_id !== user.id` → lỗi "Bạn không có quyền với học sinh này."; `update({ device_token: null })` + `revalidatePath("/classes/{classId}/roster")`.
- `app/c/[token]/session/[sid]/student-submit.tsx`: import (dòng 35) + gọi (dòng 233) đổi sang `studentClaimSessionSlotAction`.
- Đã chạy `pnpm exec tsc --noEmit` (exit 0) + `pnpm exec eslint` trên 2 file (exit 0, chỉ còn 1 warning `no-img-element` có sẵn từ trước ở dòng 660 student-submit.tsx, không liên quan).

---

## YÊU CẦU PHIÊN SAU

### Phiên 2 — Phía học sinh (`app/c/[token]/class-lobby.tsx`)

Trước khi code, đọc:
- `app/c/[token]/class-lobby.tsx` (609 dòng):
  - Type `Student` (dòng 27-32) đã có `device_token`.
  - `getDeviceToken()` (dòng 45-53) — localStorage `device_token`.
  - Effect nhận diện identity (dòng 84-98): đọc `localStorage "class_${classId}_student"` → nếu tồn tại set `myStudentId`; không thì tìm qua `device_token`. **CẦN SỬA**: chỉ vào thẳng nếu ô còn giữ đúng device_token của thiết bị mình (nếu `s.device_token !== dt` → xóa localStorage, không set myStudentId).
  - `claimSlot` (dòng 172-182): hiện gọi `studentSetNameAction` — **bỏ**, đổi sang gọi `studentClaimSlotAction(s.id, getDeviceToken())`; thành công thì `setMyStudentId` + set localStorage.
  - Màn 1 UI (dòng 273-342): bỏ Input tên + nút "Tôi là ô số...", thẻ trống → disabled "Trống".
  - Màn 2 UI (dòng 346-569): bọc Tabs; tab "Phiên thảo luận" (danh sách phiên dòng 471-484 + nút "Xem điểm" dòng 486-493, giữ link `/c/${token}/scores`); tab "Nhóm của em" (chỉ `myLeaderGroup`) — lưới thẻ HS trái tô màu theo nhóm + thẻ nhóm mình phải, giữ `leaderAdd`/`leaderRemove`/`handleLeaderSwapDrop`.
- `app/c/[token]/page.tsx` — đã truyền đủ props `students` (có device_token), `sessions`, `groups`, `members`.
- `@/components/ui/tabs` có sẵn (`Tabs, TabsList, TabsTrigger, TabsContent` — mẫu dùng ở `student-submit.tsx` dòng 25).
- `app/actions.ts` — `studentClaimSlotAction(studentId, deviceToken)` mới (Phiên 1) trả `{ ok, error? }`.

Những thứ ĐÃ CÓ sẵn (không tạo lại): `getDeviceToken()`, realtime channel `lobby-${classId}` (đã subscribe students/sessions/class_groups/class_group_members), `leaderAdd`/`leaderRemove`, `handleLeaderSwapDrop`, `myLeaderGroup`/`myGroup`/`studentToGroup`, component `Tabs`/`Dialog`/`Card`/`Button`/`AvatarInitials`.

