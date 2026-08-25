const PRODUCTION_ORIGIN = "https://thaoluannhom-giaodien.vercel.app"

/**
 * QR/link chia sẻ phải trỏ tới ứng dụng production, không lấy origin của
 * v0 preview nơi giáo viên đang mở bảng điều khiển.
 */
export function getShareOrigin() {
  return PRODUCTION_ORIGIN
}

export function getClassShareUrl(token: string) {
  return `${getShareOrigin()}/c/${token}`
}

export function getSessionShareUrl(token: string, sessionId: string) {
  return `${getShareOrigin()}/c/${token}/session/${sessionId}`
}

export function getResultsShareUrl(token: string, sessionId: string) {
  return `${getSessionShareUrl(token, sessionId)}/results`
}
