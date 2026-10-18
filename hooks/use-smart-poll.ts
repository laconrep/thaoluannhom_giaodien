import { useEffect, useRef } from "react"

/**
 * Polling thông minh thay cho setInterval cố định.
 *
 * - Realtime khỏe (ref báo SUBSCRIBED): poll thưa mỗi `healthyMs` (mặc định 60s)
 *   chỉ để đề phòng mất sự kiện.
 * - Realtime lỗi/chưa kết nối: poll dày mỗi `degradedMs` (mặc định 10s).
 * - Tab bị ẩn (chuyển tab trình duyệt): tạm nghỉ, hiện lại thì đồng bộ ngay 1 lần.
 * - Không bao giờ chạy chồng 2 lượt poll cùng lúc.
 *
 * Cách dùng:
 *   const realtimeOk = useRef(false)
 *   ... .subscribe((status) => { realtimeOk.current = status === "SUBSCRIBED" })
 *   useSmartPoll(() => { refreshA(); refreshB() }, realtimeOk)
 */
export function useSmartPoll(
  poll: () => void | Promise<void>,
  realtimeOkRef: { current: boolean },
  opts?: { healthyMs?: number; degradedMs?: number; enabled?: boolean },
) {
  const { healthyMs = 60000, degradedMs = 10000, enabled = true } = opts ?? {}
  const pollRef = useRef(poll)
  pollRef.current = poll
  const busyRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const tick = async () => {
      if (stopped) return
      const hidden = typeof document !== "undefined" && document.hidden
      if (!hidden && !busyRef.current) {
        busyRef.current = true
        try {
          await pollRef.current()
        } catch {
          // Bỏ qua lỗi 1 lượt — lượt sau thử lại, không làm sập vòng lặp.
        } finally {
          busyRef.current = false
        }
      }
      if (stopped) return
      timer = setTimeout(tick, realtimeOkRef.current ? healthyMs : degradedMs)
    }

    const onVisibility = () => {
      if (stopped || typeof document === "undefined" || document.hidden) return
      // Tab vừa hiện lại: đồng bộ ngay, rồi tiếp tục vòng mới.
      if (timer) clearTimeout(timer)
      void tick()
    }

    document.addEventListener("visibilitychange", onVisibility)
    timer = setTimeout(tick, realtimeOkRef.current ? healthyMs : degradedMs)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
    // realtimeOkRef đọc qua .current tại thời điểm lên lịch — không cần đưa vào deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, healthyMs, degradedMs])
}
