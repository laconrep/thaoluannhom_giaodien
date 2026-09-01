export const TOUR_ONBOARDING_SEEN_KEY = "teacher_tour_seen_v1"
export const TOUR_DASHBOARD_SEEN_KEY = "teacher_tour_dashboard_seen_v1"
export const TOUR_ROSTER_SEEN_KEY = "teacher_tour_roster_seen_v1"
export const TOUR_ROSTER_SEEN_PREFIX = "roster_intro_seen_"
export const PRESENTATION_START_SEEN_KEY = "teacher_tour_presentation_start_seen_v1"
export const PRESENTATION_TOUR_SEEN_KEY = "teacher_tour_presentation_seen_v1"
export const GRADEBOOK_TOUR_PENDING_KEY = "teacher_tour_gradebook_pending_v1"
export const SESSIONS_NEXT_PENDING_PREFIX = "teacher_tour_sessions_next_pending_"
export const RESTART_EVENT = "teacher-tour:restart"
export const STOP_EVENT = "teacher-tour:stop"

export function classTourSeenKey(tourName: string, classId: string) {
  return `teacher_tour_${tourName}_${classId}`
}

export function getSeen(key: string): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(key) === "1"
}

export function setSeen(key: string) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(key, "1")
}

// Tour phân nhóm chỉ hiện lần đầu tiên (toàn cục).
// Giữ tương thích: ai đã xem modal cũ theo từng lớp (roster_intro_seen_*) cũng được tính là đã xem.
export function rosterTourSeen(): boolean {
  if (getSeen(TOUR_ROSTER_SEEN_KEY)) return true
  if (typeof window === "undefined") return false
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (key && key.startsWith(TOUR_ROSTER_SEEN_PREFIX)) return true
  }
  return false
}

export function setRosterTourSeen() {
  setSeen(TOUR_ROSTER_SEEN_KEY)
}

// Tour bảng điểm chỉ hiện khi giáo viên chủ động bấm tab "Bảng điểm".
// Tab click đặt marker (sessionStorage) trước khi navigate; gradebook-view đọc
// và xoá marker khi mount để quyết định có tự chạy tour hay không.
export function setGradebookTourPending() {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(GRADEBOOK_TOUR_PENDING_KEY, "1")
}

export function consumeGradebookTourPending(): boolean {
  if (typeof window === "undefined") return false
  const pending = window.sessionStorage.getItem(GRADEBOOK_TOUR_PENDING_KEY) === "1"
  window.sessionStorage.removeItem(GRADEBOOK_TOUR_PENDING_KEY)
  return pending
}

export function setSessionsNextPending(classId: string) {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(`${SESSIONS_NEXT_PENDING_PREFIX}${classId}`, "1")
}

export function consumeSessionsNextPending(classId: string): boolean {
  if (typeof window === "undefined") return false
  const key = `${SESSIONS_NEXT_PENDING_PREFIX}${classId}`
  const pending = window.sessionStorage.getItem(key) === "1"
  window.sessionStorage.removeItem(key)
  return pending
}
