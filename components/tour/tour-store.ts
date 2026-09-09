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

export const ROSTER_LIST_SEEN_KEY = "teacher_tour_roster-list_seen_v1"
export const ROSTER_LEADER_SEEN_KEY = "teacher_tour_roster-leader_seen_v1"
export const ROSTER_NEXT_SEEN_KEY = "teacher_tour_roster-next_seen_v1"
export const SESSIONS_PRESETS_SEEN_KEY = "teacher_tour_sessions-presets_seen_v1"
export const SESSIONS_NEXT_SEEN_KEY = "teacher_tour_sessions-next_seen_v1"
export const PRESENTATION_EDGE_SEEN_KEY = "teacher_tour_presentation-edge_seen_v1"
export const PRESENTATION_DRAWER_SEEN_KEY = "teacher_tour_presentation-drawer_seen_v1"
export const PRESENTATION_ALL_SESSIONS_SEEN_KEY = "teacher_tour_presentation-all-sessions_seen_v1"
export const PRESENTATION_CREATE_SESSION_SEEN_KEY = "teacher_tour_presentation-create-session_seen_v1"
export const GRADEBOOK_SEEN_KEY = "teacher_tour_gradebook_seen_v1"
export const SHARE_LINK_SEEN_KEY = "teacher_tour_share-link_seen_v1"
export const SHARE_GRADES_SEEN_KEY = "teacher_tour_share-grades_seen_v1"

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

export function legacyClassHintSeen(tourName: string): boolean {
  if (typeof window === "undefined") return false
  const prefix = `teacher_tour_${tourName}_`
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (key && key.startsWith(prefix) && window.localStorage.getItem(key) === "1") return true
  }
  return false
}

const ROSTER_STAGE_KEYS = new Set([
  ROSTER_LIST_SEEN_KEY,
  ROSTER_LEADER_SEEN_KEY,
  ROSTER_NEXT_SEEN_KEY,
])

const PRESENTATION_STAGE_KEYS = new Set([
  PRESENTATION_EDGE_SEEN_KEY,
  PRESENTATION_DRAWER_SEEN_KEY,
  PRESENTATION_ALL_SESSIONS_SEEN_KEY,
  PRESENTATION_CREATE_SESSION_SEEN_KEY,
])

const ONBOARDING_GATED_KEYS = new Set([
  SESSIONS_PRESETS_SEEN_KEY,
  SESSIONS_NEXT_SEEN_KEY,
  PRESENTATION_START_SEEN_KEY,
  GRADEBOOK_SEEN_KEY,
  SHARE_LINK_SEEN_KEY,
  SHARE_GRADES_SEEN_KEY,
  ...PRESENTATION_STAGE_KEYS,
])

function legacyRosterIntroSeen(): boolean {
  if (typeof window === "undefined") return false
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (key && key.startsWith(TOUR_ROSTER_SEEN_PREFIX)) return true
  }
  return false
}

export function isHintSeen(globalKey: string, legacyTourName?: string): boolean {
  if (getSeen(globalKey)) return true
  if (ONBOARDING_GATED_KEYS.has(globalKey) && getSeen(TOUR_ONBOARDING_SEEN_KEY)) return true
  if (ROSTER_STAGE_KEYS.has(globalKey) && (getSeen(TOUR_ROSTER_SEEN_KEY) || legacyRosterIntroSeen())) return true
  if (PRESENTATION_STAGE_KEYS.has(globalKey) && getSeen(PRESENTATION_TOUR_SEEN_KEY)) return true
  if (legacyTourName) return legacyClassHintSeen(legacyTourName)
  return false
}

export function rosterTourSeen(): boolean {
  if (getSeen(TOUR_ROSTER_SEEN_KEY) || legacyRosterIntroSeen()) return true
  return (
    getSeen(ROSTER_LIST_SEEN_KEY) &&
    getSeen(ROSTER_LEADER_SEEN_KEY) &&
    getSeen(ROSTER_NEXT_SEEN_KEY)
  )
}

export function setRosterTourSeen() {
  setSeen(TOUR_ROSTER_SEEN_KEY)
  setSeen(ROSTER_LIST_SEEN_KEY)
  setSeen(ROSTER_LEADER_SEEN_KEY)
  setSeen(ROSTER_NEXT_SEEN_KEY)
}

export function presentationTourSeen(): boolean {
  if (getSeen(PRESENTATION_TOUR_SEEN_KEY)) return true
  return (
    getSeen(PRESENTATION_EDGE_SEEN_KEY) &&
    getSeen(PRESENTATION_DRAWER_SEEN_KEY) &&
    getSeen(PRESENTATION_ALL_SESSIONS_SEEN_KEY) &&
    getSeen(PRESENTATION_CREATE_SESSION_SEEN_KEY)
  )
}

export function setPresentationTourSeen() {
  setSeen(PRESENTATION_TOUR_SEEN_KEY)
  setSeen(PRESENTATION_EDGE_SEEN_KEY)
  setSeen(PRESENTATION_DRAWER_SEEN_KEY)
  setSeen(PRESENTATION_ALL_SESSIONS_SEEN_KEY)
  setSeen(PRESENTATION_CREATE_SESSION_SEEN_KEY)
}

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
