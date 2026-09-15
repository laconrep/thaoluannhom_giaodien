export const TOUR_ONBOARDING_SEEN_KEY = "teacher_tour_seen_v1"
export const TOUR_DASHBOARD_SEEN_KEY = "teacher_tour_dashboard_seen_v1"
export const TOUR_ROSTER_SEEN_KEY = "teacher_tour_roster_seen_v1"
export const PRESENTATION_START_SEEN_KEY = "teacher_tour_presentation_start_seen_v1"
export const PRESENTATION_TOUR_SEEN_KEY = "teacher_tour_presentation_seen_v1"
export const GRADEBOOK_TOUR_PENDING_KEY = "teacher_tour_gradebook_pending_v1"
export const SESSIONS_NEXT_PENDING_PREFIX = "teacher_tour_sessions_next_pending_"
export const RESTART_EVENT = "teacher-tour:restart"
export const STOP_EVENT = "teacher-tour:stop"

export function classTourSeenKey(tourName: string, classId: string) {
  return `teacher_tour_${tourName}_${classId}`
}

// Trạng thái "đã xem tour" thuộc về tài khoản giáo viên và được lưu trên server
// (bảng teacher_tour_seen). Client hydrate một lần từ server rồi đọc/ghi đồng bộ
// qua bộ nhớ trong, nhờ vậy tour không lặp lại khi đăng nhập ở trình duyệt khác.
let seenState: Record<string, boolean> = {}
let hydrated = false
let persister: ((key: string) => void) | null = null

export function hydrateTourSeenState(initial: Record<string, boolean>) {
  seenState = { ...initial }
  hydrated = true
  if (typeof window !== "undefined") clearLegacyTourKeys()
}

export function registerTourSeenPersister(fn: ((key: string) => void) | null) {
  persister = fn
}

export function getSeen(key: string): boolean {
  if (hydrated) return seenState[key] === true
  // Trước khi hydrate (hoặc ngoài khu vực giáo viên) vẫn đọc localStorage để
  // không phá vỡ hành vi cũ.
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(key) === "1"
}

export function setSeen(key: string) {
  seenState[key] = true
  if (hydrated) {
    persister?.(key)
    return
  }
  if (typeof window !== "undefined") window.localStorage.setItem(key, "1")
}

// Dọn cờ cũ trong localStorage: trạng thái giờ do server quản lý theo tài khoản,
// giữ lại sẽ khiến tài khoản khác dùng chung trình duyệt bị "dính" trạng thái.
function clearLegacyTourKeys() {
  const store = window.localStorage
  const keys: string[] = []
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (!key) continue
    if (key.startsWith("teacher_tour_") || key.startsWith("roster_intro_seen_")) keys.push(key)
  }
  for (const key of keys) store.removeItem(key)
}

// Tour phân nhóm chỉ hiện lần đầu tiên cho mỗi tài khoản.
export function rosterTourSeen(): boolean {
  return getSeen(TOUR_ROSTER_SEEN_KEY)
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
