"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Users, PresentationIcon, ClipboardCheck, Table, Share2 } from "lucide-react"
import { setGradebookTourPending } from "@/components/tour/tour-store"

export function ClassTabs({ classId }: { classId: string }) {
  const pathname = usePathname()
  const tabs = [
    { href: `/classes/${classId}/roster`, label: "Danh sách & nhóm", icon: Users },
    { href: `/classes/${classId}/sessions`, label: "Thảo luận nhóm", icon: PresentationIcon },
    { href: `/classes/${classId}/individual`, label: "Giao việc cá nhân", icon: ClipboardCheck },
    { href: `/classes/${classId}/gradebook`, label: "Bảng điểm", icon: Table },
    { href: `/classes/${classId}/share`, label: "Chia sẻ", icon: Share2 },
  ]
  return (
    <nav data-tour="class-tabs" className="flex items-center gap-1 overflow-x-auto py-2 no-scrollbar">
      {tabs.map((t) => {
        const active = pathname?.startsWith(t.href)
        const Icon = t.icon
        return (
          <Link
            key={t.href}
            href={t.href}
            onClick={() => {
              if (t.href.includes("/gradebook")) setGradebookTourPending()
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition",
              active
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
