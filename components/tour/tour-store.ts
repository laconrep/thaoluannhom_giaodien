export const TOUR_ONBOARDING_SEEN_KEY = "teacher_tour_seen_v1"
export const TOUR_DASHBOARD_SEEN_KEY = "teacher_tour_dashboard_seen_v1"
export const TOUR_ROSTER_SEEN_PREFIX = "roster_intro_seen_"
export const RESTART_EVENT = "teacher-tour:restart"

export function rosterSeenKey(classId: string) {
  return `${TOUR_ROSTER_SEEN_PREFIX}${classId}`
}

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
