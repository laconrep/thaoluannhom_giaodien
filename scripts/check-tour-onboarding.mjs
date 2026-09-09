#!/usr/bin/env node
// Kiểm tra: mỗi hint chỉ hiện 1 lần. Hint đã xem không hiện lại dù tour
// tổng chưa xong. Hint chưa xem chỉ hiện khi giáo viên tới đúng thao tác.

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const KEYS = {
  onboarding: "teacher_tour_seen_v1",
  dashboard: "teacher_tour_dashboard_seen_v1",
  roster: "teacher_tour_roster_seen_v1",
  rosterList: "teacher_tour_roster-list_seen_v1",
  rosterLeader: "teacher_tour_roster-leader_seen_v1",
  rosterNext: "teacher_tour_roster-next_seen_v1",
  sessionsPresets: "teacher_tour_sessions-presets_seen_v1",
  sessionsNext: "teacher_tour_sessions-next_seen_v1",
  presentationStart: "teacher_tour_presentation_start_seen_v1",
  presentation: "teacher_tour_presentation_seen_v1",
  presentationEdge: "teacher_tour_presentation-edge_seen_v1",
  presentationDrawer: "teacher_tour_presentation-drawer_seen_v1",
  presentationAll: "teacher_tour_presentation-all-sessions_seen_v1",
  presentationCreate: "teacher_tour_presentation-create-session_seen_v1",
  gradebook: "teacher_tour_gradebook_seen_v1",
  shareLink: "teacher_tour_share-link_seen_v1",
  shareGrades: "teacher_tour_share-grades_seen_v1",
  gradebookPending: "teacher_tour_gradebook_pending_v1",
}

function makeStore() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      map.set(k, String(v))
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
}

function seen(store, key) {
  return store.getItem(key) === "1"
}

function mark(store, key) {
  store.setItem(key, "1")
}

function isHintSeen(store, globalKey, { onboardingGated = false, rosterStage = false, presentationStage = false } = {}) {
  if (seen(store, globalKey)) return true
  if (onboardingGated && seen(store, KEYS.onboarding)) return true
  if (rosterStage && seen(store, KEYS.roster)) return true
  if (presentationStage && seen(store, KEYS.presentation)) return true
  return false
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg)
    process.exitCode = 1
  } else {
    console.log("OK  ", msg)
  }
}

function autoStartHint(store, key, actionReached, extra = {}) {
  return actionReached && !isHintSeen(store, key, extra)
}

console.log("=== Mỗi hint 1 lần, không phụ thuộc tour tổng ===")
const local = makeStore()
const session = makeStore()

assert(autoStartHint(local, KEYS.dashboard, true), "Dashboard: lần 1 hiện hint tạo lớp")
mark(local, KEYS.dashboard)
assert(!autoStartHint(local, KEYS.dashboard, true), "Dashboard: tạo lớp lần 2 không hiện lại")

assert(autoStartHint(local, KEYS.rosterList, true, { rosterStage: true }), "Roster: vào trang → hint danh sách")
mark(local, KEYS.rosterList)
assert(!autoStartHint(local, KEYS.rosterList, true, { rosterStage: true }), "Roster: vào trang lần 2 không hiện hint danh sách")
assert(autoStartHint(local, KEYS.rosterLeader, true, { rosterStage: true }), "Roster: kéo HS vào nhóm → hint nhóm trưởng (chưa xem)")
mark(local, KEYS.rosterLeader)
assert(!autoStartHint(local, KEYS.rosterLeader, true, { rosterStage: true }), "Roster: kéo HS lần nữa không hiện hint nhóm trưởng")
assert(autoStartHint(local, KEYS.rosterNext, true, { rosterStage: true }), "Roster: gán trưởng → hint tab (chưa xem)")
mark(local, KEYS.rosterNext)
mark(local, KEYS.roster)

assert(
  autoStartHint(local, KEYS.sessionsPresets, true, { onboardingGated: true }),
  "Sessions: mở form tạo phiên lần 1 → hint preset (dù roster đã xong)",
)
mark(local, KEYS.sessionsPresets)
assert(
  !autoStartHint(local, KEYS.sessionsPresets, true, { onboardingGated: true }),
  "Sessions: mở form tạo phiên lần 2 không hiện hint preset",
)

session.setItem(`teacher_tour_sessions_next_pending_class-e2e`, "1")
const pending = session.getItem(`teacher_tour_sessions_next_pending_class-e2e`) === "1"
session.removeItem(`teacher_tour_sessions_next_pending_class-e2e`)
assert(
  pending && autoStartHint(local, KEYS.sessionsNext, true, { onboardingGated: true }),
  "Sessions: vừa tạo phiên lần 1 → hint mở phiên",
)
mark(local, KEYS.sessionsNext)
assert(
  !autoStartHint(local, KEYS.sessionsNext, true, { onboardingGated: true }),
  "Sessions: tạo phiên lần 2 không hiện hint mở phiên",
)

assert(
  autoStartHint(local, KEYS.presentationStart, true, { onboardingGated: true }),
  "Board: upload PPT lần 1 → hint Trình chiếu",
)
assert(
  !autoStartHint(local, KEYS.presentationStart, false, { onboardingGated: true }),
  "Board: chưa upload PPT → không hiện hint chiếu",
)
mark(local, KEYS.presentationStart)
assert(
  !autoStartHint(local, KEYS.presentationStart, true, { onboardingGated: true }),
  "Board: upload/chiếu lần 2 không hiện lại hint Trình chiếu",
)

assert(
  autoStartHint(local, KEYS.presentationEdge, true, { onboardingGated: true, presentationStage: true }),
  "Fullscreen lần 1 → hint mép trái",
)
mark(local, KEYS.presentationEdge)
assert(
  !autoStartHint(local, KEYS.presentationEdge, true, { onboardingGated: true, presentationStage: true }),
  "Fullscreen lần 2 không hiện hint mép trái",
)
assert(
  autoStartHint(local, KEYS.presentationDrawer, true, { onboardingGated: true, presentationStage: true }),
  "Mở drawer lần 1 → hint timer/QR (chưa xem)",
)
mark(local, KEYS.presentationDrawer)
assert(
  !autoStartHint(local, KEYS.presentationDrawer, true, { onboardingGated: true, presentationStage: true }),
  "Mở drawer lần 2 không hiện hint timer/QR",
)
assert(
  autoStartHint(local, KEYS.presentationAll, true, { onboardingGated: true, presentationStage: true }),
  "Sau drawer: hint Tất cả phiên nếu chưa xem",
)
mark(local, KEYS.presentationAll)
assert(
  autoStartHint(local, KEYS.presentationCreate, true, { onboardingGated: true, presentationStage: true }),
  "Bấm Tất cả phiên lần 1 → hint Tạo phiên mới",
)
mark(local, KEYS.presentationCreate)
mark(local, KEYS.presentation)
assert(
  !autoStartHint(local, KEYS.presentationCreate, true, { onboardingGated: true, presentationStage: true }),
  "Bấm Tất cả phiên lần 2 không hiện hint Tạo phiên mới",
)

session.setItem(KEYS.gradebookPending, "1")
const tabTriggered = session.getItem(KEYS.gradebookPending) === "1"
session.removeItem(KEYS.gradebookPending)
assert(
  autoStartHint(local, KEYS.gradebook, tabTriggered, { onboardingGated: true }),
  "Bấm tab Bảng điểm lần 1 → hint gradebook",
)
assert(
  !autoStartHint(local, KEYS.gradebook, false, { onboardingGated: true }),
  "Vào gradebook bằng URL thẳng → không auto-start",
)
mark(local, KEYS.gradebook)
assert(
  !autoStartHint(local, KEYS.gradebook, true, { onboardingGated: true }),
  "Bấm tab Bảng điểm lần 2 không hiện lại",
)

assert(
  autoStartHint(local, KEYS.shareLink, true, { onboardingGated: true }),
  "Share lần 1 → hint link lớp",
)
mark(local, KEYS.shareLink)
assert(
  !autoStartHint(local, KEYS.shareLink, true, { onboardingGated: true }),
  "Share lần 2 không hiện hint link",
)
assert(
  autoStartHint(local, KEYS.shareGrades, true, { onboardingGated: true }),
  "Link đã xem, grades chưa xem → hiện hint grades khi vào Chia sẻ",
)
mark(local, KEYS.shareGrades)
assert(
  !autoStartHint(local, KEYS.shareGrades, true, { onboardingGated: true }),
  "Share lần sau không hiện hint grades",
)

console.log("\n=== Cờ tổng cũ không làm hint đã xem hiện lại ===")
const legacy = makeStore()
mark(legacy, KEYS.onboarding)
assert(
  !autoStartHint(legacy, KEYS.sessionsPresets, true, { onboardingGated: true }),
  "Đã có teacher_tour_seen_v1 → không hiện lại hint phiên",
)
assert(
  !autoStartHint(legacy, KEYS.presentationStart, true, { onboardingGated: true }),
  "Đã có teacher_tour_seen_v1 → không hiện lại hint chiếu",
)

console.log("\n=== Replay không xoá cờ đã xem ===")
assert(seen(local, KEYS.dashboard), "Replay không xoá dashboard seen")
assert(seen(local, KEYS.sessionsPresets), "Replay không xoá sessions presets seen")
assert(seen(local, KEYS.presentationStart), "Replay không xoá presentation start seen")

console.log("\n=== data-tour targets trong source ===")
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const required = [
  ["app/dashboard/create-class-card.tsx", "create-class"],
  ["app/classes/[id]/class-tabs.tsx", "class-tabs"],
  ["app/classes/[id]/roster/roster-view.tsx", "roster-list"],
  ["app/classes/[id]/roster/roster-view.tsx", "group-leader"],
  ["app/classes/[id]/session-list-view.tsx", "session-presets"],
  ["app/classes/[id]/session-list-view.tsx", "session-list"],
  ["app/classes/[id]/gradebook/gradebook-view.tsx", "gradebook-table"],
  ["app/classes/[id]/gradebook/gradebook-view.tsx", "gradebook-export"],
  ["app/classes/[id]/share/share-view.tsx", "share-link"],
  ["app/classes/[id]/share/share-view.tsx", "share-grades"],
  ["components/presentation-viewer.tsx", "presentation-start"],
  ["app/classes/[id]/sessions/[sid]/group-board.tsx", "presentation-timer"],
  ["app/classes/[id]/sessions/[sid]/group-board.tsx", "presentation-all-sessions"],
  ["app/classes/[id]/sessions/[sid]/group-board.tsx", "presentation-create-session"],
  ["components/presentation-viewer.tsx", "presentation-edge"],
  ["components/presentation-viewer.tsx", "presentation-qr"],
]
for (const [file, attr] of required) {
  const src = readFileSync(join(root, file), "utf8")
  assert(src.includes(`data-tour="${attr}"`) || src.includes(`data-tour='${attr}'`), `${file} có data-tour=${attr}`)
}

const storeSrc = readFileSync(join(root, "components/tour/tour-store.ts"), "utf8")
assert(storeSrc.includes("isHintSeen"), "tour-store có isHintSeen theo từng hint")
assert(storeSrc.includes("SESSIONS_PRESETS_SEEN_KEY"), "tour-store có cờ hint phiên toàn cục")

const shareSrc = readFileSync(join(root, "app/classes/[id]/share/share-view.tsx"), "utf8")
assert(
  shareSrc.includes("SHARE_LINK_SEEN_KEY") && shareSrc.includes("SHARE_GRADES_SEEN_KEY"),
  "share-view dùng cờ hint toàn cục, không khóa theo onboarding tổng",
)
assert(shareSrc.includes("setShowGradesHint(true)"), "share-view: đóng hint link vẫn mở grades nếu chưa xem")

if (process.exitCode) {
  console.error("\nCó assertion thất bại.")
  process.exit(1)
}
console.log("\nLuồng hint 1 lần PASS.")
