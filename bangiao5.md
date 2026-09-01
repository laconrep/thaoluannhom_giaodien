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
| `teacher-tour.tsx` | Component `<Joyride>` dùng lại cho mọi tour theo trang | Props: `tourId`, `steps`, `seenKey`, `autoStart?`, `autoStartWhen?`, `onComplete?`, `isSeen?`, `markSeen?`. Xử lý `EVENTS.STEP_AFTER` + `step.data.navigateTo` → `router.push`; `EVENTS.TOUR_END` + `STATUS.FINISHED` → `markSeen()`. Lắng nghe `RESTART_EVENT` để replay. |
| `tour-config.ts` | Định nghĩa steps + locale/options | `tourLocale` (VN), `tourOptions` (zIndex 200). Factories: `dashboardTourSteps`, `rosterTourSteps(classId)`, `sessionsTourSteps(_classId)`, `gradebookTourSteps(classId)`, `shareTourSteps(classId)`, `presentationStartStep`, `presentationEdgeStep`, `presentationTimerStep`, `presentationQrStep`, `presentationAllSessionsStep`, `presentationCreateSessionStep`. |
| `tour-store.ts` | Keys + helper localStorage/sessionStorage | Xem 2.2. |
| `tour-replay-button.tsx` | Nút "Hướng dẫn" trên header | Dispatch `window.dispatchEvent(new CustomEvent(RESTART_EVENT))`. |
| `presentation-tour.tsx` | Tour màn chiếu PowerPoint (state machine) | Props: `active`, `drawerOpen`, `sessionPickerOpen`, `createSessionOpen`. Stage: `idle → edge → drawer → all-sessions → create-session → done`. Gate: onboarding chưa xong (`!getSeen(TOUR_ONBOARDING_SEEN_KEY)`) && chưa xem (`!getSeen(PRESENTATION_TOUR_SEEN_KEY)`). Joyride có `key={`presentation-${stage}`}` (remount theo stage); chỉ stage "drawer" là `continuous` (2 bước: timer + QR). |

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
| `RESTART_EVENT` = `"teacher-tour:restart"` | Event replay từ nút "Hướng dẫn". |

Helper: `getSeen(key)`, `setSeen(key)`, `classTourSeenKey(tourName, classId)`, `rosterTourSeen()`, `setRosterTourSeen()`, `setGradebookTourPending()`, `consumeGradebookTourPending()`.

### 2.3 Bản đồ `data-tour` (target react-joyride)

| data-tour | File | Ghi chú |
|-----------|------|---------|
| `dashboard-header`, `create-class`, `class-list` | `app/dashboard/page.tsx`, `app/dashboard/create-class-card.tsx` | Tour Dashboard. |
| `class-tabs` | `app/classes/[id]/class-tabs.tsx` | Thanh tab (roster/sessions/individual/gradebook/share). |
| `roster-list`, `roster-groups`, `group-leader`, `bulk-select` | `app/classes/[id]/roster/roster-view.tsx` | Tour Roster. |
| `session-create`, `session-list` | `app/classes/[id]/session-list-view.tsx` | Tour Sessions. |
| `gradebook-table`, `gradebook-export` | `app/classes/[id]/gradebook/gradebook-view.tsx` | Tour Bảng điểm. |
| `share-link`, `share-grades`, `share-done` | `app/classes/[id]/share/share-view.tsx` | Tour Chia sẻ (bước cuối, set onboarding). |
| `presentation-start` | `group-board.tsx` — nút "Chế độ chiếu lớp" (`renderBoard` non-embedded) | Hint mở PowerPoint. |
| `presentation-edge` | `presentation-viewer.tsx` — vùng hover mép trái (`absolute left-0 top-0 bottom-0 w-10 z-10`) | Mở drawer. |
| `presentation-timer` | `group-board.tsx` — `<div>` bọc `TimerPanel` trong `renderBoard` | Chỉnh thời gian. |
| `presentation-qr` | `presentation-viewer.tsx` — nút "QR code" trong header drawer | Tạo QR. |
| `presentation-all-sessions` | `group-board.tsx` — nút "Tất cả phiên" (embedded branch) | Mở picker. |
| `presentation-create-session` | `group-board.tsx` — nút "Tạo phiên mới" trong picker (chỉ tồn tại khi `sessionPickerOpen`) | Tạo phiên mới. |

**Quan trọng (màn chiếu)**: drawer fullscreen render nội dung bằng `board(openGroup)` = `renderBoard(true, …)` của `group-board.tsx` → các target `presentation-timer/all-sessions/create-session` nằm trong `renderBoard` (branch embedded). Drawer header của `presentation-viewer.tsx` có nút `presentation-qr` riêng. Khi fullscreen active, `mainContent` (board thường) **không render** nên không trùng target.

### 2.4 Vị trí gắn tour (file đã sửa)

- `app/dashboard/page.tsx`: `<TeacherTour tourId="dashboard" … seenKey={TOUR_DASHBOARD_SEEN_KEY} autoStart>`.
- `app/classes/[id]/roster/roster-view.tsx`: `<TeacherTour tourId="roster" … seenKey={TOUR_ROSTER_SEEN_KEY} isSeen={rosterTourSeen} markSeen={setRosterTourSeen} autoStart autoStartWhen={groups.length>0}>`.
- `app/classes/[id]/session-list-view.tsx`: `<TeacherTour tourId="sessions" … seenKey={classTourSeenKey("sessions", classId)} autoStart autoStartWhen={!getSeen(TOUR_ONBOARDING_SEEN_KEY)}>`.
- `app/classes/[id]/gradebook/gradebook-view.tsx`: `<TeacherTour tourId="gradebook" … seenKey={classTourSeenKey("gradebook", classId)} autoStart autoStartWhen={tabTriggered && !getSeen(TOUR_ONBOARDING_SEEN_KEY)}>` — `tabTriggered` từ marker sessionStorage (đọc trong `useEffect`, **không đọc trong useState initializer để tránh hydration mismatch**).
- `app/classes/[id]/share/share-view.tsx`: `<TeacherTour tourId="share" … seenKey={TOUR_ONBOARDING_SEEN_KEY} autoStart autoStartWhen={!getSeen(TOUR_ONBOARDING_SEEN_KEY)}>`.
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

## 4. Việc CHƯA LÀM / Tồn đọng

1. ✅ (Đã xong) Build đã chạy lại sau thay đổi gradebook-view — **pass** (`pnpm run build`). Typecheck pass, lint chỉ còn 9 warning pre-existing.
2. ✅ (Đã xong) `docs/TOUR_HUONG_DAN_PLAN.md` **đã cập nhật**: thêm mục 5.6 (tour màn chiếu PowerPoint), sửa 4.1/4.3/5.4/6/8 cho khớp (roster global, gradebook tab-trigger, replay, checklist).
3. ✅ (Đã xong) **Progressive Dashboard** — `dashboardTourSteps` đã thành hint 1 bước trỏ `create-class`; bấm nút "Tạo lớp mới" sẽ `setSeen(TOUR_DASHBOARD_SEEN_KEY)` + dispatch `STOP_EVENT` để tắt hint ngay. `TeacherTour` có thêm listener `STOP_EVENT` (dùng chung cho các tour progressive sau).
4. Ảnh demo `docs/tour-screenshots/` **chưa có** cho tour màn chiếu PowerPoint + thay đổi bảng điểm.
5. **Progressive refactor chưa làm cho Roster/Sessions/Share** — hiện các tour này vẫn là multi-step liên tục (chạy hết một lượt, có `navigateTo` xuyên trang ở Roster → sessions, Gradebook → share). Yêu cầu của user: "giáo viên thao tác xong bước n thì hint bước n+1 mới xuất hiện".
6. **Replay màn chiếu**: `PresentationTour` **không lắng nghe** `RESTART_EVENT` (nút "Hướng dẫn" header chỉ replay các tour TeacherTour).
7. Chưa test thực tế trên trình duyệt có Supabase (phải có tài khoản).
8. Chưa merge PR #4 vào `main`.

## 5. Kế hoạch 8 PHIÊN CODE

> Quy ước: mỗi phiên xong → chạy `pnpm run typecheck` + `pnpm run lint` (bắt buộc), build nếu sửa logic lớn → commit → push → cập nhật phần 7 file này → commit file → push.

- **Phiên 1 — Xác minh & cập nhật tài liệu hiện tại**
  - Chạy `pnpm run build` xác minh sau fix gradebook.
  - Cập nhật `docs/TOUR_HUONG_DAN_PLAN.md`: thêm tour màn chiếu PowerPoint (5.6), sửa 4.3/5.4/6 cho khớp (roster global, gradebook tab-trigger).
  - Commit + push. Đánh dấu xong ở phần 7.

- **Phiên 2 — Progressive Dashboard tour**
  - Đổi `dashboardTourSteps` thành hint 1 bước trỏ nút "Tạo lớp mới" (`create-class`); loại bỏ các bước dư nếu gây rối.
  - Đảm bảo hint tắt sau khi bấm nút (không chạy tiếp). Dùng `isSeen/markSeen` hoặc trigger theo onClick nếu cần.
  - Commit + push + cập nhật phần 7.

- **Phiên 3 — Progressive Roster tour**
  - Tách `rosterTourSteps` theo hành động: vào trang (list HS) → sau khi **kéo ≥1 HS vào nhóm** (`groups.some(g => g.members.length>0)`) hiện hint nhóm trưởng → sau khi **gán leader** (`groups.some(g => g.leaderId)`) hiện hint chuyển tab.
  - Bỏ `navigateTo` bước cuối (thay bằng "bấm tab Thảo luận nhóm").
  - Commit + push + cập nhật phần 7.

- **Phiên 4 — Progressive Sessions tour**
  - Hint chỉ hiện khi GV **bấm nút "Tạo phiên mới"** (hook onClick hiện có → set flag/dispatch) → hint presets 15/30/45.
  - Sau khi **tạo phiên thành công** → hint nhắc mở phiên / bước tiếp.
  - Commit + push + cập nhật phần 7.

- **Phiên 5 — Progressive Share tour & hoàn thiện Gradebook**
  - Share tour: rà soát/đổi thành 1–2 hint ngắn; **bắt buộc set `TOUR_ONBOARDING_SEEN_KEY` khi hoàn thành** (mốc kết thúc onboarding).
  - Gradebook: kiểm nội dung hint khớp trigger tab-click; bỏ `navigateTo` sang share nếu cần (để GV tự bấm tab).
  - Commit + push + cập nhật phần 7.

- **Phiên 6 — Kiểm thử end-to-end + replay màn chiếu**
  - Test luồng thực tế có Supabase: Dashboard → tạo lớp → roster → phiên → màn chiếu PowerPoint → bảng điểm (bấm tab) → share.
  - Test lại lần 2 để xác nhận cờ không hiện lại; test replay nút "Hướng dẫn".
  - **Bổ sung** cho `PresentationTour` lắng nghe `RESTART_EVENT` (replay tour màn chiếu).
  - Test mobile + theme sáng/tối. Commit fix (nếu có) + push + cập nhật phần 7.

- **Phiên 7 — Ảnh demo tour màn chiếu**
  - Dựng file HTML giả lập màn chiếu (theo `/tmp/opencode/tour-demo/` pattern) và chụp: edge hint, drawer (timer+QR), "Tất cả phiên", "Tạo phiên mới".
  - Thêm PNG vào `docs/tour-screenshots/` + cập nhật `index.html`.
  - Commit + push + cập nhật phần 7.

- **Phiên 8 — Merge & QA cuối**
  - Rà toàn bộ diff PR #4; chạy đủ typecheck/lint/build.
  - `gh pr merge` vào `main` (token: lấy từ `git credential fill` cho `github.com`, không in ra).
  - Dọn dẹp, đánh dấu toàn bộ phần 7 hoàn thành, commit + push.

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
| 3 | Progressive Roster tour | ⏳ Chưa làm | |
| 4 | Progressive Sessions tour | ⏳ Chưa làm | |
| 5 | Progressive Share + hoàn thiện Gradebook | ⏳ Chưa làm | |
| 6 | Kiểm thử E2E + replay màn chiếu | ⏳ Chưa làm | |
| 7 | Ảnh demo tour màn chiếu | ⏳ Chưa làm | |
| 8 | Merge PR #4 + QA cuối | ⏳ Chưa làm | |
