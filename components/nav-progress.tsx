"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

/**
 * Thanh tiến trình mảnh trên cùng khi chuyển trang — cho cảm giác "mượt".
 *
 * Trang lớp không còn loading.tsx toàn màn hình: khi bấm tab, nội dung cũ
 * giữ nguyên cho đến khi trang mới sẵn sàng; thanh này là tín hiệu duy nhất
 * cho biết đang tải. Tự phát hiện click vào link nội bộ, tắt khi pathname
 * đổi hoặc quá 8s (chống kẹt khi điều hướng lỗi).
 */
export function NavProgress() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Điều hướng xong → tắt.
  useEffect(() => {
    setActive(false)
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [pathname])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return
      const el = e.target as HTMLElement
      const a = el.closest?.("a[href]") as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute("href")
      if (!href || href.startsWith("#") || /^[a-z]+:/i.test(href)) return
      let to: URL
      try {
        to = new URL(href, window.location.origin)
      } catch {
        return
      }
      if (to.origin !== window.location.origin) return
      if (to.pathname === pathname) return // click đúng trang hiện tại: không điều hướng
      setActive(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setActive(false), 8000)
    }
    document.addEventListener("click", onClick, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [pathname])

  if (!active) return null
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-[3px] pointer-events-none"
      aria-hidden="true"
    >
      <div className="h-full w-1/3 rounded-full bg-primary nav-progress-slide" />
    </div>
  )
}
