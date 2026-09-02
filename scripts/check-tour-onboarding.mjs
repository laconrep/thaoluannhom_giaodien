#!/usr/bin/env node
// Kiểm tra luồng cờ onboarding (phiên 6b) — không cần tài khoản Supabase.
// Mô phỏng localStorage/sessionStorage và assert:
//   1) Lần 1: từng màn tự hiện khi chưa xong onboarding
//   2) Lần 2: sau TOUR_ONBOARDING_SEEN_KEY, các tour sau Share không auto-start
//   3) Đóng hint share-link vẫn chuyển sang hint grades rồi set cờ tổng

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const KEYS = {
  onboarding: "teacher_tour_seen_v1",
  dashboard: "teacher_tour_dashboard_seen_v1",
  roster: "teacher_tour_roster_seen_v1",
  presentationStart: "teacher_tour_presentation_start_seen_v1",
  presentation: "teacher_tour_presentation_seen_v1",
  gradebookPending: "teacher_tour_gradebook_pending_v1",
}

function classKey(name, classId) {
  return `teacher_tour_${name}_${classId}`
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
    snapshot: () => Object.fromEntries(map),
  }
}

function seen(store, key) {
  return store.getItem(key) === "1"
}

function mark(store, key) {
  store.setItem(key, "1")
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg)
    process.exitCode = 1
  } else {
    console.log("OK  ", msg)
  }
}

function autoStartSessions(store) {
  return !seen(store, KEYS.onboarding)
}

function autoStartGradebook(store, tabClicked) {
  return tabClicked && !seen(store, KEYS.onboarding)
}

function autoStartPresentationStart(store, hasPpt) {
  return hasPpt && !seen(store, KEYS.onboarding) && !seen(store, KEYS.presentationStart)
}

function autoStartPresentationTour(store) {
  return !seen(store, KEYS.onboarding) && !seen(store, KEYS.presentation)
}

function autoStartShareLink(store, classId) {
  return !seen(store, KEYS.onboarding) && !seen(store, classKey("share-link", classId))
}

function autoStartShareGrades(store, classId, showGradesHint) {
  return showGradesHint && !seen(store, KEYS.onboarding)
}

const CLASS_ID = "class-e2e"

console.log("=== Lần 1: luồng onboarding ===")
const local = makeStore()
const session = makeStore()

assert(autoStartSessions(local), "Dashboard/Sessions: lần 1 được auto-start (onboarding chưa set)")
mark(local, KEYS.dashboard)
assert(seen(local, KEYS.dashboard), "Bấm Tạo lớp mới → set dashboard seen")

mark(local, KEYS.roster)
assert(seen(local, KEYS.roster), "Roster hoàn tất → set roster seen (toàn cục)")

assert(autoStartSessions(local), "Sessions create/presets/next vẫn auto-start (onboarding chưa set)")
mark(local, classKey("sessions-create", CLASS_ID))
mark(local, classKey("sessions-presets", CLASS_ID))
session.setItem(`teacher_tour_sessions_next_pending_${CLASS_ID}`, "1")
const pending = session.getItem(`teacher_tour_sessions_next_pending_${CLASS_ID}`) === "1"
session.removeItem(`teacher_tour_sessions_next_pending_${CLASS_ID}`)
assert(pending && !seen(local, classKey("sessions-next", CLASS_ID)), "Quay lại list: consume pending → hiện hint next")
mark(local, classKey("sessions-next", CLASS_ID))

assert(
  autoStartPresentationStart(local, true),
  "Màn board: có PPT + onboarding chưa xong → hint Chế độ chiếu lớp",
)
assert(!autoStartPresentationStart(local, false), "Màn board: chưa upload PPT → không hiện hint chiếu")
mark(local, KEYS.presentationStart)
assert(autoStartPresentationTour(local), "Fullscreen: onboarding chưa xong → tour mép trái")
mark(local, KEYS.presentation)

session.setItem(KEYS.gradebookPending, "1")
const tabTriggered = session.getItem(KEYS.gradebookPending) === "1"
session.removeItem(KEYS.gradebookPending)
assert(autoStartGradebook(local, tabTriggered), "Bấm tab Bảng điểm → gradebook auto-start")
assert(!autoStartGradebook(local, false), "Vào gradebook bằng URL thẳng → không auto-start")
mark(local, classKey("gradebook", CLASS_ID))

assert(autoStartShareLink(local, CLASS_ID), "Share: lần 1 hiện hint link lớp")

let showGradesHint = false
mark(local, classKey("share-link", CLASS_ID))
if (!seen(local, KEYS.onboarding) && !seen(local, classKey("share-grades", CLASS_ID))) {
  showGradesHint = true
}
assert(showGradesHint, "Đóng/copy hint link → chuyển sang hint grades (không bỏ cờ tổng)")
assert(!seen(local, KEYS.onboarding), "Chưa set onboarding khi mới xong hint link")
assert(autoStartShareGrades(local, CLASS_ID, showGradesHint), "Hint grades auto-start")

showGradesHint = false
mark(local, classKey("share-grades", CLASS_ID))
mark(local, KEYS.onboarding)
assert(seen(local, KEYS.onboarding), "Hint grades kết thúc → set teacher_tour_seen_v1")

console.log("\n=== Lần 2: cờ không hiện lại ===")
assert(!autoStartSessions(local), "Sessions không auto-start sau onboarding")
assert(!autoStartGradebook(local, true), "Gradebook không auto-start dù bấm tab")
assert(!autoStartPresentationStart(local, true), "Hint chiếu lớp không auto-start")
assert(!autoStartPresentationTour(local), "Tour màn chiếu không auto-start")
assert(!autoStartShareLink(local, CLASS_ID), "Share link không auto-start")
assert(!autoStartShareGrades(local, CLASS_ID, true), "Share grades không auto-start")

console.log("\n=== Replay vẫn độc lập với cờ auto-start ===")
assert(seen(local, KEYS.dashboard), "Replay Dashboard: cờ dashboard vẫn còn (nút Hướng dẫn không xoá)")
assert(seen(local, KEYS.roster), "Replay Roster: cờ roster vẫn còn")
assert(seen(local, KEYS.onboarding), "Replay không xoá teacher_tour_seen_v1")

console.log("\n=== data-tour targets trong source ===")
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const required = [
  ["app/dashboard/create-class-card.tsx", "create-class"],
  ["app/classes/[id]/class-tabs.tsx", "class-tabs"],
  ["app/classes/[id]/roster/roster-view.tsx", "roster-list"],
  ["app/classes/[id]/roster/roster-view.tsx", "group-leader"],
  ["app/classes/[id]/session-list-view.tsx", "session-create"],
  ["app/classes/[id]/session-list-view.tsx", "session-presets"],
  ["app/classes/[id]/session-list-view.tsx", "session-list"],
  ["app/classes/[id]/session-list-view.tsx", "session-open"],
  ["app/classes/[id]/gradebook/gradebook-view.tsx", "gradebook-table"],
  ["app/classes/[id]/gradebook/gradebook-view.tsx", "gradebook-export"],
  ["app/classes/[id]/share/share-view.tsx", "share-link"],
  ["app/classes/[id]/share/share-view.tsx", "share-grades"],
  ["app/classes/[id]/sessions/[sid]/group-board.tsx", "presentation-start"],
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

const shareSrc = readFileSync(join(root, "app/classes/[id]/share/share-view.tsx"), "utf8")
assert(
  shareSrc.includes("setShowGradesHint(true)") && shareSrc.includes("TOUR_ONBOARDING_SEEN_KEY"),
  "share-view: đóng hint link vẫn mở grades; grades kết thúc set cờ onboarding",
)
assert(
  /onEnd=\{\(\) => \{[\s\S]*setShowGradesHint\(true\)/.test(shareSrc),
  "share-link onEnd chuyển sang hint grades (không bỏ dở onboarding)",
)

if (process.exitCode) {
  console.error("\nPhiên 6b: có assertion thất bại.")
  process.exit(1)
}
console.log("\nPhiên 6b: luồng cờ onboarding PASS.")
