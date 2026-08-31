export const TOUR_ONBOARDING_SEEN_KEY = "teacher_tour_seen_v1"
export const TOUR_DASHBOARD_SEEN_KEY = "teacher_tour_dashboard_seen_v1"
export const TOUR_ROSTER_SEEN_KEY = "teacher_tour_roster_seen_v1"
export const TOUR_ROSTER_SEEN_PREFIX = "roster_intro_seen_"
export const RESTART_EVENT = "teacher-tour:restart"

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
