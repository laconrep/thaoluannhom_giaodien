# BÀN GIAO 5 — Tour hướng dẫn giáo viên (teacher guided tour)

> File bàn giao cho các phiên code tiếp theo. Mục tiêu: **phiên sau đọc file này là code tiếp được ngay, không cần đọc lại repo**. Sau mỗi phiên code, cập nhật mục "Tiến độ theo phiên" + commit + push lên GitHub.

## 0. Cách dùng file này

- Đọc toàn bộ phần 1 → 6 trước khi code.
- Xem phần 7 (tiến độ) để biết phiên nào còn tồn đọng.
- Sau mỗi phiên: đánh dấu hoàn thành vào phần 7, commit, push.

---

## 1. Tổng quan dự án & git

- **App**: "Lớp học thảo luận" — Next.js (App Router), TypeScript, Tailwind, Supabase. Tài khoản giáo viên quản lý lớp, phân nhóm, phiên thảo luận nhóm, bảng điểm, chia sẻ.
- **Branch đang làm**: `260829-feat-teacher-tour-guide` (base `main`).
- **Remote**: `https://github.com/laconrep/thaoluannhom_giaodien`
- **PR #4** (chưa merge): `https://github.com/laconrep/thaoluannhom_giaodien/pull/4`
- **Lệnh verify**: `pnpm run typecheck` (tsc --noEmit), `pnpm run lint` (eslint — đang có 9 warning `<img>`/eslint-disable **pre-existing, không phải lỗi mới**), `pnpm run build`.
- **Cài thư viện**: `react-joyride@3.2.0` (đã cài). **Lưu ý v3 không có default export — phải `import { Joyride } from "react-joyride"`**; không có option `showSkipButton` (dùng `options.buttons: ["back","skip","close","primary"]`).
- **Xác thực**: app yêu cầu đăng nhập Supabase nên chụp ảnh demo tour phải dùng file HTML tĩnh giả lập UI tại `/tmp/opencode/tour-demo/` (xem Phiên 7).

## 2. Kiến trúc tour (đã có, đang chạy)

### 2.1 File hạ tầng (components/tour/)

| File | Vai trò | API quan trọng |
|------|---------|----------------|
| `teacher-tour.tsx` | Component `<Joyride>` dùng lại cho mọi tour theo trang | Props: `tourId`, `steps`, `seenKey`, `autoStart?`, `autoStartWhen?`, `onComplete?`, `isSeen?`, `markSeen?`, `restartToken?`, `onEnd?`. Xử lý `EVENTS.STEP_AFTER` + `step.data.navigateTo` → `router.push`; `EVENTS.TOUR_END` + `STATUS.FINISHED` → `markSeen()`; mọi `TOUR_END` → `onEnd()`. Lắng nghe `RESTART_EVENT`. `restartToken` đổi → `setRun(true)` (không tự chạy lúc mount). |
| `roster-tour.tsx` | Tour phân nhóm **progressive** (state machine, không dùng TeacherTour) | Props: `ready`, `hasMembers`, `hasLeader`. Stage: `idle → list → leader → next → done`. Gate: `ready` (đã có nhóm) && `!rosterTourSeen()`. Chuyển stage theo hành động thật; bật hint khi stage đổi (remount `key={`roster-${stage}`}`, so sánh `prevStageRef` để không tự bật lại hint đã đóng); lắng nghe `RESTART_EVENT` replay. |
| `tour-config.ts` | Định nghĩa steps + locale/options | `tourLocale` (VN), `tourOptions` (zIndex 200). Factories: `dashboardTourSteps`, `rosterListStep`, `rosterLeaderStep`, `rosterNextStep`, `sessionsPresetsStep`, `sessionsNextStep`, `sessionsTourSteps(_classId)`, `gradebookTourSteps(classId)`, `shareLinkStep`, `shareGradesStep`, `shareTourSteps(classId)`, `presentationStartStep`, `presentationEdgeStep`, `presentationTimerStep`, `presentationQrStep`, `presentationAllSessionsStep`, `presentationCreateSessionStep`. |
| `tour-store.ts` | Keys + helper localStorage/sessionStorage | Xem 2.2. |
| `tour-replay-button.tsx` | Nút "Hướng dẫn" trên header | Dispatch `window.dispatchEvent(new CustomEvent(RESTART_EVENT))`. |
| `presentation-tour.tsx` | Tour màn chiếu PowerPoint (state machine) | Props: `active`, `drawerOpen`, `sessionPickerOpen`, `createSessionOpen`. Stage: `idle → edge → drawer → all-sessions → create-session → done`. Gate: onboarding chưa xong (`!getSeen(TOUR_ONBOARDING_SEEN_KEY)`) && chưa xem (`!getSeen(PRESENTATION_TOUR_SEEN_KEY)`), **hoặc** đang replay (nút "Hướng dẫn"). Joyride có `key={`presentation-${stage}`}` (remount theo stage); chỉ stage "drawer" là `continuous` (2 bước: timer + QR). 6a: lắng nghe `RESTART_EVENT` — khi `active` → `setReplaying(true)` + reset stage về `edge`. |

### 2.2 Keys localStorage/sessionStorage (tour-store.ts)

| Key | Ý nghĩa |
|-----|---------|
| `TOUR_ONBOARDING_SEEN_KEY` = `"teacher_tour_seen_v1"` | Cờ onboarding tổng; **set khi hoàn tất tour Chia sẻ**. Các tour màn chiếu/phiên/bảng điểm chỉ tự hiện khi cờ này CHƯA set. |
| `TOUR_DASHBOARD_SEEN_KEY` = `"teacher_tour_dashboard_seen_v1"` | Tour Dashboard (toàn cục). |
| `TOUR_ROSTER_SEEN_KEY` = `"teacher_tour_roster_seen_v1"` | Tour Phân nhóm — **toàn cục, chỉ hiện lần đầu**. |
| `TOUR_ROSTER_SEEN_PREFIX` = `"roster_intro_seen_"` | Cờ cũ theo lớp (backward-compat, `rosterTourSeen()` quét prefix này). |
| `PRESENTATION_START_SEEN_KEY` = `"teacher_tour_presentation_start_seen_v1"` | Hint "Chế độ chiếu lớp" trên màn board. |
| `PRESENTATION_TOUR_SEEN_KEY` = `"teacher_tour_presentation_seen_v1"` | Tour màn chiếu PowerPoint (set khi GV bấm "Tạo phiên mới" ở stage `create-session`). |
| `GRADEBOOK_TOUR_PENDING_KEY` = `"teacher_tour_gradebook_pending_v1"` | Marker **sessionStorage** — set khi bấm tab "Bảng điểm"; gradebook-view đọc + xoá khi mount. |
| `SESSIONS_NEXT_PENDING_PREFIX` = `"teacher_tour_sessions_next_pending_"` | Marker **sessionStorage** theo classId — set khi bấm "Tạo và vào ngay"; list đọc + xoá khi mount để hiện hint mở phiên. |
| `RESTART_EVENT` = `"teacher-tour:restart"` | Event replay từ nút "Hướng dẫn". |

Helper: `getSeen(key)`, `setSeen(key)`, `classTourSeenKey(tourName, classId)`, `rosterTourSeen()`, `setRosterTourSeen()`, `setGradebookTourPending()`, `consumeGradebookTourPending()`, `setSessionsNextPending(classId)`, `consumeSessionsNextPending(classId)`.

### 2.3 Bản đồ `data-tour` (target react-joyride)

| data-tour | File | Ghi chú |
|-----------|------|---------|
| `dashboard-header`, `create-class`, `class-list` | `app/dashboard/page.tsx`, `app/dashboard/create-class-card.tsx` | Tour Dashboard. |
| `class-tabs` | `app/classes/[id]/class-tabs.tsx` | Thanh tab (roster/sessions/individual/gradebook/share). |
| `roster-list`, `roster-groups`, `group-leader`, `bulk-select` | `app/classes/[id]/roster/roster-view.tsx` | Tour Roster. |
| `session-create`, `session-presets`, `session-list` | `app/classes/[id]/session-list-view.tsx` | Tour Sessions. `session-presets` = cụm nút 15/30/45 (chỉ render khi form mở). |
| `gradebook-table`, `gradebook-export` | `app/classes/[id]/gradebook/gradebook-view.tsx` | Tour Bảng điểm. |
| `share-link`, `share-grades`, `share-done` | `app/classes/[id]/share/share-view.tsx` | Tour Chia sẻ. 5a: 2 hint progressive (`shareLinkStep` → copy link → `shareGradesStep`). `share-done` còn trên wrapper. 5c: **set `TOUR_ONBOARDING_SEEN_KEY` khi hint grades kết thúc** (copy link điểm hoặc `onEnd`). |
| `presentation-start` | `group-board.tsx` — nút "Chế độ chiếu lớp" (`renderBoard` non-embedded) | Hint mở PowerPoint. |
| `presentation-edge` | `presentation-viewer.tsx` — vùng hover mép trái (`absolute left-0 top-0 bottom-0 w-10 z-10`) | Mở drawer. |
| `presentation-timer` | `group-board.tsx` — `<div>` bọc `TimerPanel` trong `renderBoard` | Chỉnh thời gian. |
| `presentation-qr` | `presentation-viewer.tsx` — nút "QR code" trong header drawer | Tạo QR. |
| `presentation-all-sessions` | `group-board.tsx` — nút "Tất cả phiên" (embedded branch) | Mở picker. |
| `presentation-create-session` | `group-board.tsx` — nút "Tạo phiên mới" trong picker (chỉ tồn tại khi `sessionPickerOpen`) | Tạo phiên mới. |

**Quan trọng (màn chiếu)**: drawer fullscreen render nội dung bằng `board(openGroup)` = `renderBoard(true, …)` của `group-board.tsx` → các target `presentation-timer/all-sessions/create-session` nằm trong `renderBoard` (branch embedded). Drawer header của `presentation-viewer.tsx` có nút `presentation-qr` riêng. Khi fullscreen active, `mainContent` (board thường) **không render** nên không trùng target.

### 2.4 Vị trí gắn tour (file đã sửa)

- `app/dashboard/page.tsx`: `<TeacherTour tourId="dashboard" … seenKey={TOUR_DASHBOARD_SEEN_KEY} autoStart>`.
- `app/classes/[id]/roster/roster-view.tsx`: `<RosterTour ready={groups.length>0} hasMembers hasLeader>` — `hasMembers = groups.some(g => (memberMap[g.id] ?? []).length>0)`, `hasLeader = groups.some(g => g.leader_student_id)`. Progressive theo hành động (list → leader → next), không còn `navigateTo`.
- `app/classes/[id]/session-list-view.tsx`: **không còn** auto-start multi-step.
  - Form mở (`open`) → `<TeacherTour tourId="sessions-presets" steps={[sessionsPresetsStep()]} seenKey={classTourSeenKey("sessions-presets", classId)}>`.
  - Bấm preset / "Tạo và vào ngay" → `setSeen(sessions-presets)` + `STOP_EVENT` + `setSessionsNextPending(classId)`. `createSessionAction` redirect sang trang phiên.
  - Quay lại list: `consumeSessionsNextPending` + `sessions.length > 0` + chưa xem `sessions-next` → `<TeacherTour tourId="sessions-next" steps={[sessionsNextStep()]}>` trỏ `session-list`. Bấm mở phiên → `setSeen(sessions-next)` + `STOP_EVENT`. **Không** `navigateTo`.
  - Replay `RESTART_EVENT`: form mở → presets; list trống → mở form + presets; đã có phiên → next. Đóng hint (`onEnd`/`presetsDismissed`) không tự hiện lại.
- `app/classes/[id]/gradebook/gradebook-view.tsx`: `<TeacherTour tourId="gradebook" … seenKey={classTourSeenKey("gradebook", classId)} autoStart autoStartWhen={tabTriggered && !getSeen(TOUR_ONBOARDING_SEEN_KEY)}>` — `tabTriggered` từ marker sessionStorage (đọc trong `useEffect`, **không đọc trong useState initializer để tránh hydration mismatch**). Bước cuối **không** `navigateTo` — chỉ nhắc GV tự bấm tab Chia sẻ (5b).
- `app/classes/[id]/share/share-view.tsx`: **không còn** multi-step `shareTourSteps`. Vào trang → `<TeacherTour tourId="share-link" steps={[shareLinkStep()]} seenKey={classTourSeenKey("share-link", classId)}>` (gate onboarding chưa xong + `!linkDismissed`). Copy link lớp → `STOP_EVENT` + hiện `<TeacherTour tourId="share-grades" steps={[shareGradesStep()]}>`. Copy link điểm → tắt hint grades + `setSeen(TOUR_ONBOARDING_SEEN_KEY)`; `onEnd` hint grades cũng set cờ (mốc kết thúc onboarding).
- `app/classes/[id]/sessions/[sid]/group-board.tsx`:
  - Hint board: `<TeacherTour tourId="presentation-start" steps={[presentationStartStep()]} seenKey={PRESENTATION_START_SEEN_KEY} autoStart autoStartWhen={!!presentation && !getSeen(TOUR_ONBOARDING_SEEN_KEY)} />` (nằm đầu `mainContent`, chỉ khi `isTeacher`).
  - Truyền `sessionPickerOpen` + `createSessionOpen` cho `PresentationViewer`.
- `components/presentation-viewer.tsx`:
  - Props mới `sessionPickerOpen?`, `createSessionOpen?`.
  - Render `<PresentationTour active={active} drawerOpen={drawerOpen} sessionPickerOpen={sessionPickerOpen} createSessionOpen={createSessionOpen} />` trong block `{isTeacher && …}` của nhánh active.
  - `startPresentation()` gọi `setSeen(PRESENTATION_START_SEEN_KEY)` để hint board không hiện lại.
- `app/classes/[id]/class-tabs.tsx`: tab "Bảng điểm" có `onClick={() => setGradebookTourPending()}` (chỉ tab href chứa `/gradebook`).
- `components/teacher-shell.tsx`: nút "Hướng dẫn" (TourReplayButton).

## 3. Việc ĐÃ LÀM (tính đến commit `636ee69`)

1. Kế hoạch chi tiết: `docs/TOUR_HUONG_DAN_PLAN.md`.
2. Hạ tầng tour (5 file components/tour/) + gắn vào Dashboard/Roster/Sessions/Gradebook/Share + nút replay header.
3. Roster tour đổi sang **cờ toàn cục, chỉ hiện lần đầu** (`teacher_tour_roster_seen_v1`, có backward-compat `roster_intro_seen_*`).
4. **Tour màn chiếu PowerPoint** (mới):
   - Hint board trỏ nút "Chế độ chiếu lớp" (chỉ khi đã upload PowerPoint).
   - Fullscreen: edge ("di chuột mép trái mở drawer") → drawer (timer + QR) → "Tất cả phiên" → "Tạo phiên mới" → xong.
   - Progressive theo hành động thật (mở drawer / bấm Tất cả phiên / bấm Tạo phiên mới).
5. **Tour Bảng điểm chỉ hiện khi GV chủ động bấm tab "Bảng điểm"** (marker sessionStorage).
6. Tour Sessions: bước cuối **không còn auto-navigate** sang gradebook (thay bằng hướng dẫn bấm tab).
7. `pnpm run typecheck` + `pnpm run lint` (0 error, chỉ warning cũ) pass. `pnpm run build` đã pass trước thay đổi nhỏ gradebook-view (cần build lại xác minh ở Phiên 1).
8. ✅ (Phiên 2) **Progressive Dashboard**: `dashboardTourSteps` thành hint 1 bước trỏ `create-class`; bấm nút "Tạo lớp mới" → `setSeen(TOUR_DASHBOARD_SEEN_KEY)` + dispatch `STOP_EVENT`. `TeacherTour` thêm listener `STOP_EVENT` (tái dùng cho tour progressive).
9. ✅ (Phiên 3) **Progressive Roster**: tạo `components/tour/roster-tour.tsx` (state machine `idle → list → leader → next → done`). Tách `rosterTourSteps` thành 3 hint đơn: `rosterListStep` (vào trang), `rosterLeaderStep` (sau khi kéo ≥1 HS vào nhóm), `rosterNextStep` (sau khi gán leader). **Bỏ `navigateTo`** bước cuối — hint "chuyển tab" chỉ nhắc bấm tab Thảo luận nhóm. `roster-view.tsx` dùng `<RosterTour ready hasMembers hasLeader>` thay `TeacherTour`. Bật hint khi stage đổi qua `prevStageRef` (không tự hiện lại hint đã đóng); lắng nghe `RESTART_EVENT` (replay). Typecheck/lint/build pass.
10. ✅ (Phiên 4a) **Sessions presets**: bỏ auto-start multi-step. Bấm "Tạo phiên mới" mở form → hint 1 bước `sessionsPresetsStep` trỏ `[data-tour='session-presets']`. Bấm preset / "Tạo và vào ngay" → `setSeen(classTourSeenKey("sessions-presets", classId))` + `STOP_EVENT`.
11. ✅ (Phiên 4b) **Sessions next**: `sessionsNextStep` trỏ `session-list` (không `navigateTo`). `onCreate` set `setSessionsNextPending(classId)` trước redirect. Quay lại list: `consumeSessionsNextPending` + có phiên + chưa xem next → hint. Bấm mở phiên → `setSeen` + `STOP_EVENT`.
12. ✅ (Phiên 4c) **Sessions verify**: không multi-step; đóng hint không tự hiện lại (`presetsDismissed`/`onEnd`); replay `RESTART_EVENT` (form mở → presets, list trống → mở form, có phiên → next). `TeacherTour` thêm `restartToken`/`onEnd`.
13. ✅ (Phiên 5a) **Share progressive**: tách `shareTourSteps` thành `shareLinkStep` + `shareGradesStep` (bỏ bước `share-done`). Vào trang → hint link lớp; copy link lớp → hint xem điểm. **Chưa** set `TOUR_ONBOARDING_SEEN_KEY`.
14. ✅ (Phiên 5b) **Gradebook bỏ `navigateTo`**: xoá `data: { navigateTo: /classes/[id]/share }` khỏi bước cuối `gradebookTourSteps` (đổi tham số thành `_classId`). Hint trỏ `class-tabs` giờ chỉ nhắc "tự bấm tab Chia sẻ" — GV tự chuyển trang như roster/sessions. Xoá type `TourStepData` (không còn dùng). Trigger tab-click (`GRADEBOOK_TOUR_PENDING_KEY`/`consumeGradebookTourPending`) đã có sẵn từ trước, giữ nguyên. Cập nhật `docs/TOUR_HUONG_DAN_PLAN.md` 5.4. Typecheck + lint pass (9 warning cũ).
15. ✅ (Phiên 5c) **Set cờ onboarding khi hoàn tất Share**: `share-view.tsx` giờ gọi `setSeen(TOUR_ONBOARDING_SEEN_KEY)` khi hint cuối (`share-grades`) kết thúc — cả khi GV copy link điểm (`stopGradesHint`) lẫn khi `onEnd` hint grades. Xác nhận các tour sau (màn chiếu `presentation-tour.tsx`, `presentation-start` hint board, `sessions` presets/next, `gradebook`) đều gate `!getSeen(TOUR_ONBOARDING_SEEN_KEY)` nên sẽ **không auto-start** sau khi cờ được set. Typecheck + lint + build pass.
16. ✅ (Phiên 6a) **PresentationTour replay**: thêm listener `RESTART_EVENT` trong `components/tour/presentation-tour.tsx` (tham khảo `roster-tour.tsx`). Khi nhận event và `active` → `setReplaying(true)` + `setStage("edge")` + `setRun(true)` — nút "Hướng dẫn" header giờ replay được tour màn chiếu. Tách `enabled` thành `onboardingEnabled || replaying` để replay chạy kể cả khi tour đã xem (`setReplaying(false)` khi bấm "Tạo phiên mới" → `done`). Typecheck + lint pass.

## 4. Việc CHƯA LÀM / Tồn đọng

1. ✅ (Đã xong) Build đã chạy lại sau thay đổi gradebook-view — **pass** (`pnpm run build`). Typecheck pass, lint chỉ còn 9 warning pre-existing.
2. ✅ (Đã xong) `docs/TOUR_HUONG_DAN_PLAN.md` **đã cập nhật**: thêm mục 5.6 (tour màn chiếu PowerPoint), sửa 4.1/4.3/5.4/6/8 cho khớp (roster global, gradebook tab-trigger, replay, checklist).
3. ✅ (Đã xong) **Progressive Dashboard** — `dashboardTourSteps` đã thành hint 1 bước trỏ `create-class`; bấm nút "Tạo lớp mới" sẽ `setSeen(TOUR_DASHBOARD_SEEN_KEY)` + dispatch `STOP_EVENT` để tắt hint ngay. `TeacherTour` có thêm listener `STOP_EVENT` (dùng chung cho các tour progressive sau).
4. Ảnh demo `docs/tour-screenshots/` **chưa có** cho tour màn chiếu PowerPoint + thay đổi bảng điểm.
5. ✅ **Progressive Roster** xong. **Sessions 4a+4b+4c xong**. **Share 5a+5c xong** (2 hint: link → copy → grades, set `TOUR_ONBOARDING_SEEN_KEY` khi hint grades kết thúc). **Gradebook 5b xong** (bỏ `navigateTo`, giữ trigger tab-click). **Replay màn chiếu 6a xong**. **Còn lại**: 6b/6c test E2E, 7a–7c ảnh demo, 8 merge.
6. ✅ **Replay màn chiếu** (đã xong ở 6a): `PresentationTour` **lắng nghe** `RESTART_EVENT` (nút "Hướng dẫn" header giờ replay được tour màn chiếu khi `active`).
7. Chưa test thực tế trên trình duyệt có Supabase (phải có tài khoản).
8. Chưa merge PR #4 vào `main`.

## 5. Kế hoạch phiên code

> Phiên 1–3 **đã xong, không đụng lại**. Phiên 4–8 được **chia mỗi cái thành 3 phiên nhỏ** (4a–8c) để phiên sau đọc là code tiếp được ngay.
>
> Quy ước: mỗi phiên nhỏ xong → chạy `pnpm run typecheck` + `pnpm run lint` (bắt buộc), build nếu sửa logic lớn → commit → push → cập nhật phần 7 file này → commit file → push.

- **Phiên 1 — Xác minh & cập nhật tài liệu hiện tại** ✅
  - Chạy `pnpm run build` xác minh sau fix gradebook.
  - Cập nhật `docs/TOUR_HUONG_DAN_PLAN.md`: thêm tour màn chiếu PowerPoint (5.6), sửa 4.3/5.4/6 cho khớp (roster global, gradebook tab-trigger).
  - Commit + push. Đánh dấu xong ở phần 7.

- **Phiên 2 — Progressive Dashboard tour** ✅
  - Đổi `dashboardTourSteps` thành hint 1 bước trỏ nút "Tạo lớp mới" (`create-class`); loại bỏ các bước dư nếu gây rối.
  - Đảm bảo hint tắt sau khi bấm nút (không chạy tiếp). Dùng `isSeen/markSeen` hoặc trigger theo onClick nếu cần.
  - Commit + push + cập nhật phần 7.

- **Phiên 3 — Progressive Roster tour** ✅
  - Tách `rosterTourSteps` theo hành động: vào trang (list HS) → sau khi **kéo ≥1 HS vào nhóm** (`groups.some(g => g.members.length>0)`) hiện hint nhóm trưởng → sau khi **gán leader** (`groups.some(g => g.leaderId)`) hiện hint chuyển tab.
  - Bỏ `navigateTo` bước cuối (thay bằng "bấm tab Thảo luận nhóm").
  - Commit + push + cập nhật phần 7.

### Phiên 4 — Progressive Sessions tour (chia 3)

- **Phiên 4a — Hook nút "Tạo phiên mới" + hint presets** ✅
  - File chính: `app/classes/[id]/session-list-view.tsx`, `components/tour/tour-config.ts`.
  - Bấm "Tạo phiên mới" (`setOpen(true)`) → mount TeacherTour hint 1 bước `sessionsPresetsStep` trỏ `[data-tour='session-presets']`.
  - **Đã bỏ** auto-start multi-step (`sessionsTourSteps`). Bấm preset hoặc "Tạo và vào ngay" → `setSeen` + `STOP_EVENT`.

- **Phiên 4b — Hint sau khi tạo phiên thành công** ✅
  - `sessionsNextStep` trỏ `[data-tour='session-list']`, **không** `navigateTo`.
  - Gate: `consumeSessionsNextPending(classId)` + `sessions.length > 0` + chưa `getSeen(sessions-next)` + onboarding chưa xong. `createSessionAction` redirect nên hint hiện khi GV quay lại list.
  - Bấm mở phiên → `setSeen(sessions-next)` + `STOP_EVENT`.

- **Phiên 4c — Verify Sessions progressive** ✅
  - Không auto-start multi-step: chỉ 1 hint presets (form mở) hoặc 1 hint next (sau tạo phiên).
  - Đóng hint: `onEnd` + `presetsDismissed` / `showNextHint=false` + `setSeen` — không tự hiện lại. Hủy form cũng dismiss presets.
  - Replay `RESTART_EVENT`: form đang mở → replay presets; list trống → mở form + replay presets; đã có phiên → replay next. `TeacherTour` thêm `restartToken`/`onEnd`.

### Phiên 5 — Progressive Share + Gradebook (chia 3)

- **Phiên 5a — Progressive Share tour (1–2 hint)** ✅
  - Tách `shareTourSteps` thành `shareLinkStep` + `shareGradesStep` (bỏ bước `share-done` khỏi tour).
  - Vào trang → hint `share-link`. Copy link lớp → `STOP_EVENT` + hint `share-grades`. Copy link điểm → tắt hint grades.
  - **Chưa** đụng `TOUR_ONBOARDING_SEEN_KEY`.

- **Phiên 5b — Gradebook khớp tab-click, bỏ navigateTo** ✅
  - File: `app/classes/[id]/gradebook/gradebook-view.tsx`, `gradebookTourSteps(classId)`.
  - Kiểm hint khớp trigger tab "Bảng điểm" (`GRADEBOOK_TOUR_PENDING_KEY` / `consumeGradebookTourPending`).
  - **Bỏ `navigateTo` sang Share** (đã xong) — nhắc GV tự bấm tab Chia sẻ.
  - Typecheck + lint pass. Commit + push + đánh dấu phần 7.

- **Phiên 5c — Set cờ onboarding khi hoàn tất Share** ✅
  - **Bắt buộc** `setSeen(TOUR_ONBOARDING_SEEN_KEY)` khi hoàn thành Share (mốc kết thúc onboarding). `share-view.tsx`: hint cuối `share-grades` kết thúc → set cờ (copy link điểm trong `stopGradesHint` và `onEnd` hint grades).
  - Xác nhận các tour sau (màn chiếu / phiên / bảng điểm) **không auto-start** khi cờ này đã set — đã kiểm, tất cả gate `!getSeen(TOUR_ONBOARDING_SEEN_KEY)`.
  - Typecheck + lint + build pass. Commit + push + đánh dấu phần 7.

### Phiên 6 — Kiểm thử E2E + replay màn chiếu (chia 3)

- **Phiên 6a — PresentationTour lắng nghe RESTART_EVENT** ✅
  - File: `components/tour/presentation-tour.tsx` (tham khảo `roster-tour.tsx`).
  - Bổ sung listener `RESTART_EVENT` để nút "Hướng dẫn" header replay được tour màn chiếu (reset stage về đầu khi `active`).
  - Typecheck + lint pass. Commit + push + đánh dấu phần 7.

- **Phiên 6b — Test E2E luồng onboarding**
  - Cần tài khoản Supabase. Luồng: Dashboard → tạo lớp → roster → phiên → màn chiếu PowerPoint → bảng điểm (bấm tab) → share.
  - Test lần 2: cờ không hiện lại. Ghi bug vào phần 7 / commit fix nếu có.
  - Commit (nếu có fix) + push + đánh dấu phần 7.

- **Phiên 6c — Replay + mobile + theme**
  - Test replay nút "Hướng dẫn" trên từng trang (kể cả màn chiếu sau 6a).
  - Test mobile + theme sáng/tối. Commit fix (nếu có) + typecheck/lint + push + đánh dấu phần 7.

### Phiên 7 — Ảnh demo tour màn chiếu (chia 3)

- **Phiên 7a — Dựng HTML giả lập màn chiếu**
  - Pattern `/tmp/opencode/tour-demo/`. Fake UI: edge mép trái, drawer (timer + QR), nút "Tất cả phiên", "Tạo phiên mới". Không cần Supabase.
  - Commit mock (nếu đưa vào repo) hoặc ghi đường dẫn vào phần 7. Push + đánh dấu phần 7.

- **Phiên 7b — Chụp PNG**
  - Playwright chromium. Ảnh: edge hint, drawer (timer+QR), "Tất cả phiên", "Tạo phiên mới".
  - Copy PNG vào `docs/tour-screenshots/`. Commit + push + đánh dấu phần 7.

- **Phiên 7c — Cập nhật index demo**
  - Cập nhật `docs/tour-screenshots/index.html` (hoặc file index tương ứng) gắn 4 ảnh mới.
  - Commit + push + đánh dấu phần 7.

### Phiên 8 — Merge & QA cuối (chia 3)

- **Phiên 8a — Rà PR + typecheck/lint/build**
  - Rà toàn bộ diff PR #4 so với `main`. Chạy đủ `pnpm run typecheck` + `pnpm run lint` + `pnpm run build`.
  - Ghi checklist vào phần 7. **Chưa merge.** Commit (nếu có fix) + push + đánh dấu phần 7.

- **Phiên 8b — Merge PR #4 vào main**
  - `gh pr merge` PR #4 vào `main` (token: `git credential fill` cho `github.com`, **không in ra**).
  - Xác nhận merge thành công trên GitHub. Đánh dấu phần 7.

- **Phiên 8c — Dọn dẹp + đóng bàn giao**
  - Dọn dẹp (nhánh local, ghi chú tồn đọng nếu còn). Đánh dấu **toàn bộ** phần 7 hoàn thành.
  - Commit file bàn giao + push.

## 6. Lưu ý kỹ thuật quan trọng

- `react-joyride` v3: **named export** `{ Joyride, EVENTS, STATUS, type Step, type EventData }`. Không có `showSkipButton` — cấu hình qua `options.buttons`.
- `TeacherTour`: `isSeen`/`markSeen` override cho phép logic cờ tùy biến (đã dùng cho roster global). `markSeen()` được gọi khi navigate (STEP_AFTER có `navigateTo`) và khi FINISHED.
- `PresentationTour`: dùng `key={`presentation-${stage}`}` để remount Joyride mỗi stage; stage "drawer" mới `continuous`. Các stage khác là hint single-step, chỉ tiến khi có hành động thật (effect theo prop).
- **Hydration**: không đọc `localStorage`/`sessionStorage` trong `useState` initializer — đọc trong `useEffect` (xem gradebook-view). `getSeen/setSeen` tự guard `typeof window === "undefined"`.
- Cờ tour **không gắn tài khoản**, chỉ theo trình duyệt.
- Các hint dùng `target` = selector CSS (`[data-tour='…']`). Target chỉ tồn tại khi render mới hiện được hint (`targetWaitTimeout: 1500` đã set).
- Màn chiếu fullscreen z-index: Joyride `zIndex 200` > overlay fullscreen `z-[70]` > drawer `z-20` → hint luôn nổi trên.
- Test chụp ảnh không cần Supabase: dùng HTML tĩnh trong `/tmp/opencode/tour-demo/`, Playwright chromium.

## 7. Tiến độ theo phiên

| Phiên | Nội dung | Trạng thái | Ghi chú |
|-------|----------|-----------|---------|
| 1 | Xác minh build + cập nhật docs/TOUR_HUONG_DAN_PLAN.md | ✅ Xong | Build pass (`pnpm run build`), typecheck pass, lint chỉ còn 9 warning `<img>` pre-existing. Đã thêm mục 5.6 (tour màn chiếu PowerPoint), sửa 4.1/4.3/5.4/6/8 cho khớp hiện trạng. |
| 2 | Progressive Dashboard tour | ✅ Xong | `dashboardTourSteps` → 1 hint `create-class`. Bấm nút "Tạo lớp mới" → `setSeen(TOUR_DASHBOARD_SEEN_KEY)` + dispatch `STOP_EVENT` (tắt hint ngay, không chạy bước dư). Thêm `STOP_EVENT` vào `teacher-tour.tsx`/`tour-store.ts`. Build + typecheck + lint pass. |
| 3 | Progressive Roster tour | ✅ Xong | Tạo `components/tour/roster-tour.tsx` (state machine `idle → list → leader → next → done`). `rosterTourSteps` tách thành `rosterListStep`/`rosterLeaderStep`/`rosterNextStep`; **bỏ `navigateTo`** bước cuối. `roster-view.tsx` dùng `<RosterTour ready hasMembers hasLeader>` thay `TeacherTour`. Hint bật khi stage đổi (`prevStageRef`), không tự hiện lại khi đã đóng; có replay `RESTART_EVENT`. Typecheck + lint (0 error, 9 warning cũ) + build pass. |
| 4a | Sessions: hook "Tạo phiên mới" + hint presets 15/30/45 | ✅ Xong | Bỏ auto-start multi-step. Form mở → `sessionsPresetsStep` trỏ `session-presets`. Bấm preset / tạo phiên → `setSeen` + `STOP_EVENT`. `sessionsTourSteps` giữ cho 4b. |
| 4b | Sessions: hint sau tạo phiên thành công (mở phiên / bước tiếp) | ✅ Xong | `sessionsNextStep` trỏ `session-list`, không `navigateTo`. Marker `setSessionsNextPending` trước redirect; list `consume` rồi hiện hint. Bấm mở phiên → `setSeen` + `STOP_EVENT`. |
| 4c | Sessions: verify + typecheck/lint/build | ✅ Xong | Không multi-step. Đóng hint (`onEnd`/`presetsDismissed`) không tự hiện lại. Replay `RESTART_EVENT`: form mở → presets; list trống → mở form; có phiên → next. `TeacherTour` thêm `restartToken`/`onEnd`. |
| 5a | Share: đổi thành 1–2 hint ngắn progressive | ✅ Xong | `shareLinkStep` vào trang; copy link lớp → `shareGradesStep`. Bỏ bước `share-done` khỏi tour. **Chưa** set `TOUR_ONBOARDING_SEEN_KEY`. |
| 5b | Gradebook: khớp tab-click, bỏ `navigateTo` sang Share | ✅ Xong | Xoá `data.navigateTo` khỏi bước cuối `gradebookTourSteps` (đổi `_classId`), hint trỏ `class-tabs` chỉ nhắc tự bấm tab Chia sẻ. Xoá type `TourStepData`. Trigger tab-click giữ nguyên. Cập nhật plan 5.4. Typecheck + lint pass (9 warning cũ). |
| 5c | Share: set `TOUR_ONBOARDING_SEEN_KEY` khi hoàn tất | ✅ Xong | `setSeen(TOUR_ONBOARDING_SEEN_KEY)` trong `stopGradesHint()` (copy link điểm) và `onEnd` hint `share-grades`. Xác nhận màn chiếu/phiên/bảng điểm đều gate `!getSeen(TOUR_ONBOARDING_SEEN_KEY)` → không auto-start sau khi cờ set. Typecheck + lint + build pass. |
| 6a | PresentationTour lắng nghe `RESTART_EVENT` | ✅ Xong | Thêm listener `RESTART_EVENT`: khi `active` → `setReplaying(true)` + reset stage về `edge` + `setRun(true)`. Tách `enabled` = `onboardingEnabled || replaying` để replay chạy sau khi đã xem. `setReplaying(false)` khi bấm "Tạo phiên mới" (`done`). Typecheck + lint pass (9 warning cũ). |
| 6b | Test E2E luồng onboarding (có Supabase) | ⏳ Chưa làm | Dashboard → roster → phiên → chiếu → bảng điểm → share; lần 2 cờ không hiện lại |
| 6c | Test replay + mobile + theme sáng/tối | ⏳ Chưa làm | Commit fix nếu có |
| 7a | Dựng HTML giả lập màn chiếu | ⏳ Chưa làm | Pattern `/tmp/opencode/tour-demo/` |
| 7b | Chụp PNG 4 cảnh tour màn chiếu | ⏳ Chưa làm | Vào `docs/tour-screenshots/` |
| 7c | Cập nhật `index.html` gắn ảnh mới | ⏳ Chưa làm | |
| 8a | Rà PR #4 + typecheck/lint/build | ⏳ Chưa làm | Chưa merge |
| 8b | Merge PR #4 vào `main` | ⏳ Chưa làm | Token `git credential fill`, không in ra |
| 8c | Dọn dẹp + đánh dấu toàn bộ phần 7 xong | ⏳ Chưa làm | Commit file bàn giao + push |
