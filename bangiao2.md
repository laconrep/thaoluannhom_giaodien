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
- [x] **PHIÊN 2 — Phía HS** (`class-lobby.tsx`)
- [x] **PHIÊN 3 — Phía GV** (`roster/page.tsx` + `roster-view.tsx`)
  - [x] `roster/page.tsx`: select students thêm `device_token`
  - [x] `roster-view.tsx`: type Student + refreshStudents + badge khóa + nút Mở khóa

---

## GHI CHÚ PHIÊN VỪA RỒI

### Phiên 1 — Đã hoàn thành Phần 1 (Server actions)

Trên nhánh `260822-feat-share-claim-unlock`:
- `app/actions.ts`:
  - Đổi tên action cũ `studentClaimSlotAction` (claim `session_slots`) → **`studentClaimSessionSlotAction`** (logic giữ nguyên).
  - Thêm mới **`studentClaimSlotAction(studentId, deviceToken)`**: chỉ `update({ device_token })` trên bảng `students`, `.eq("id", studentId)`, `.or("device_token.is.null,device_token.eq.${deviceToken}")`, `.select("id").maybeSingle()`; `!updated` → trả `{ ok: false, error: "Ô này đã được thiết bị khác chọn" }`. KHÔNG đụng cột `name`.
  - Thêm mới **`unlockStudentSlotAction(studentId)`**: `auth.getUser()` không có user → lỗi "Chỉ giáo viên mới thực hiện được."; lấy student kèm `classes!inner(teacher_id)`, so `teacher_id !== user.id` → lỗi "Bạn không có quyền với học sinh này."; `update({ device_token: null })` + `revalidatePath("/classes/{classId}/roster")`.
- `app/c/[token]/session/[sid]/student-submit.tsx`: import + gọi đổi sang `studentClaimSessionSlotAction`.
- Đã chạy `pnpm exec tsc --noEmit` (exit 0) + `pnpm exec eslint` trên 2 file (exit 0, chỉ còn 1 warning `no-img-element` có sẵn từ trước ở student-submit.tsx, không liên quan).

### Phiên 2 — Đã hoàn thành Phần 2 (Phía học sinh `class-lobby.tsx`)

Trên nhánh `260822-feat-share-claim-unlock`:
- **Màn 1** (khi chưa có `myStudentId`): bỏ Input tên + nút "Tôi là ô số...". Lưới thẻ: thẻ có tên → bấm được, gọi `studentClaimSlotAction(s.id, getDeviceToken())`; lỗi → `toast.error` (ví dụ "Ô này đã được thiết bị khác chọn"); thành công → set `myStudentId` + `localStorage class_${classId}_student`. Thẻ trống → disabled hiện "Trống".
- **Auto-reentry** (effect load identity): chỉ vào thẳng qua localStorage nếu `students.find(s => s.id === saved)` có `device_token === getDeviceToken()`; nếu không → xóa localStorage + quay về màn chọn ô. Vẫn giữ fallback tìm qua device_token.
- **Màn 2** chuyển sang `Tabs`:
  - Tab "Phiên thảo luận" (mọi HS): danh sách phiên (giữ `SessionRow`) + nút "Xem điểm" (link `/c/${token}/scores`).
  - Tab "Nhóm của em" (chỉ `myLeaderGroup`): lưới thẻ HS trái (tô màu theo nhóm qua `groupCardStyle`, thẻ nhóm mình ring viền + Crown, thẻ nhóm khác icon Lock, thẻ trống mờ) + Card nhóm mình phải (danh sách thành viên + vùng thả nét đứt).
    - Kéo thẻ HS **trong nhóm mình** đè lên thẻ khác → `handleLeaderSwapDrop` (swap vị trí).
    - Kéo thẻ HS **chưa có nhóm** thả vào thẻ bất kỳ hoặc vùng thả → `leaderAdd` (`leaderUpdateGroupMembersAction` "add").
  - Xóa UI cũ: Card "Nhóm trưởng" + Dialog chọn thành viên + `leaderRemove`, `myGroup`, `leaderOpen`, `selectedSlot`, `name`, imports `Input`/`Field`/`Dialog`/`AvatarInitials`/`Minus`; thêm imports `Tabs` + `groupCardStyle`.
- Đã chạy `pnpm exec tsc --noEmit` (exit 0) + `pnpm exec eslint` trên `class-lobby.tsx` (exit 0).

### Phiên 3 — Đã hoàn thành Phần 3 (Phía giáo viên)

Trên nhánh `main` (sau khi merge PR #1):
- `app/classes/[id]/roster/page.tsx`: select students đổi từ `"id, slot_number, name"` → `"id, slot_number, name, device_token"`.
- `app/classes/[id]/roster/roster-view.tsx`:
  - Type `Student` thêm `device_token: string | null`.
  - `refreshStudents` select thêm `device_token`.
  - Thêm import `unlockStudentSlotAction` (từ `@/app/actions`) + icon `Lock` (từ `lucide-react`).
  - Thêm handler `handleUnlock(studentId)`: `confirm()` trước, gọi `unlockStudentSlotAction(studentId)`, fail → `toast.error`.
  - Thẻ HS có `device_token` → hiện badge "Đang bị chiếm" (icon Lock) + nút "Mở khóa"; trạng thái đồng bộ realtime qua subscribe `students UPDATE` (merge `...payload.new`).
- Đã chạy `pnpm exec tsc --noEmit` (exit 0) + `pnpm exec eslint` trên 2 file roster (exit 0).

**Tổng kết: cả 3 phiên đã hoàn thành.** Tính năng Link chia sẻ claim ô bằng `device_token` + mở khóa cho GV đã chạy đủ 3 phần (actions → phía HS → phía GV).

### Sửa sau khi duyệt (màn 1 cho giống roster + khóa thiết bị hiển thị) — `class-lobby.tsx`

- Màn 1 đổi từ lưới ô vuông nhỏ (`grid-cols-6 sm:grid-cols-8` + `aspect-square`) sang **đúng kiểu thẻ roster GV**: thẻ ngang `flex items-center gap-2.5` (badge số ô + tên + trạng thái), lưới `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`, Card rộng `max-w-3xl`.
- Khóa thiết bị hiển thị ngay trên thẻ: thêm `const [deviceToken] = useState(() => getDeviceToken())`; thẻ ô của mình (`device_token === deviceToken`) → viền `ring-primary` + nhãn "Em"; thẻ bị thiết bị khác giữ (`device_token` khác token mình) → icon `Lock` + **disabled, không bấm được** + title "Ô này đã được thiết bị khác chọn"; thẻ trống → "Trống" mờ + disabled.
- Giữ nguyên guard `.or()` server-side ở `studentClaimSlotAction` làm lớp bảo vệ cuối.
- Đã chạy `pnpm exec tsc --noEmit` (exit 0) + `pnpm exec eslint` trên `class-lobby.tsx` (exit 0).

### Sửa lần 2 (thu gọn trạng thái khóa + rút khoảng cách thẻ) — cả GV và HS

- **GV (`roster-view.tsx`)**: bỏ cụm "Đang bị chiếm" (pill chữ) + nút "Mở khóa" dưới tên; thay bằng **một khóa nhỏ ngay hàng tên** (sau Crown) — bình thường chỉ thấy khóa nhỏ, hover thẻ mới hiện chữ "Mở khóa" (bấm → confirm → `unlockStudentSlotAction`). Thẻ giữ nguyên kích thước như thẻ chưa chọn.
- **GV + HS**: rút khoảng cách thẻ HS — `px-2.5 gap-2.5 → px-1.5 gap-1.5` (roster-view còn rút thêm hàng tên `gap-1` và Input `px-1`), số thứ tự + tên sát mép trái, tên hiện được nhiều chữ hơn.
- **HS (`class-lobby.tsx` màn 1)**: thẻ bị thiết bị khác chiếm vẫn chỉ một khóa nhỏ (không có chữ "bị chiếm"); chỉ chỉnh khoảng cách như trên.
- Đã chạy `pnpm exec tsc --noEmit` (exit 0) + `pnpm exec eslint` trên 2 file (exit 0).

### Sửa lần 3 (thống nhất lưới thẻ GV + chọn thành viên bằng click + xác nhận mở khóa trong thẻ)

- **Màn 1 HS (`class-lobby.tsx`)**: thẻ HS thêm **tô màu theo nhóm** (`groupCardStyle`), **pill tên nhóm** dưới tên (`groupPillStyle`), **Crown** cho nhóm trưởng — khớp thẻ GV. Giữ nguyên bấm chọn ô, khóa thiết bị, "Em", "Trống".
- **Màn "Nhóm của em" nhóm trưởng (`class-lobby.tsx`)**:
  - **Bỏ khung bên phải** (danh sách thành viên + vùng thả) — chỉ ở màn HS, màn GV giữ nguyên.
  - **Chọn thành viên bằng click**: bấm thẻ chưa có nhóm → thêm ("add"); bấm lại thành viên trong nhóm em → gỡ ("remove", trừ chính mình). Thẻ vào nhóm sẽ đổi màu nhóm.
  - **Chỉ thẻ trong nhóm em mới kéo được** để đổi vị trí (`handleLeaderSwapDrop`); kéo thả không còn thêm thành viên nữa.
  - Lưới `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`, thẻ `px-1.5 py-2 gap-1.5`, thêm pill tên nhóm — khớp thẻ GV.
- **Màn GV (`roster-view.tsx`)**: bỏ `confirm()` trình duyệt; thêm state `confirmUnlockId` — bấm khóa nhỏ → hiện **"Xác nhận / Hủy" ngay trong thẻ**, bấm Xác nhận mới gọi `unlockStudentSlotAction`.
- Đã chạy `pnpm exec tsc --noEmit` (exit 0) + `pnpm exec eslint` trên 2 file (exit 0).

---

## YÊU CẦU PHIÊN SAU

Không còn công việc bắt buộc — cả 3 phiên đã hoàn thành.

Các hạng mục tự chọn (nếu muốn làm tiếp ở phiên sau):
- Kiểm thử end-to-end luồng HS chọn ô → GV mở khóa → HS chọn lại trên cùng/khác thiết bị.
- Nếu cần, thêm hiển thị tên thiết bị (thay vì chỉ badge "Đang bị chiếm") để GV dễ nhận diện.

