"use client"

import { useEffect, useState, useTransition } from "react"
import { rotateShareTokenAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { QRCodeSVG } from "qrcode.react"
import { Copy, RotateCw, QrCode, ExternalLink } from "lucide-react"
import { TeacherTour } from "@/components/tour/teacher-tour"
import { shareGradesStep, shareLinkStep } from "@/components/tour/tour-config"
import {
  classTourSeenKey,
  getSeen,
  setSeen,
  STOP_EVENT,
  TOUR_ONBOARDING_SEEN_KEY,
} from "@/components/tour/tour-store"

export function ShareView({
  classId,
  shareToken,
  className,
}: {
  classId: string
  shareToken: string
  className: string
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [linkDismissed, setLinkDismissed] = useState(false)
  const [showGradesHint, setShowGradesHint] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [origin, setOrigin] = useState("")

  const linkSeenKey = classTourSeenKey("share-link", classId)
  const gradesSeenKey = classTourSeenKey("share-grades", classId)

  useEffect(() => {
    setOnboardingOpen(!getSeen(TOUR_ONBOARDING_SEEN_KEY))
    setOrigin(window.location.origin)
  }, [])

  const classUrl = `${origin}/c/${shareToken}`
  const gradesUrl = `${origin}/c/${shareToken}/grades`

  function stopLinkHint() {
    setSeen(linkSeenKey)
    setLinkDismissed(true)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(STOP_EVENT))
    }
  }

  function stopGradesHint() {
    setSeen(gradesSeenKey)
    setShowGradesHint(false)
    setSeen(TOUR_ONBOARDING_SEEN_KEY)
    setOnboardingOpen(false)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(STOP_EVENT))
    }
  }

  function afterCopy(key: string) {
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
    if (key === "class") {
      stopLinkHint()
      if (!getSeen(TOUR_ONBOARDING_SEEN_KEY) && !getSeen(gradesSeenKey)) {
        setShowGradesHint(true)
      }
    }
    if (key === "grades") stopGradesHint()
  }

  function copy(url: string, key: string) {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined
    if (clipboard?.writeText) {
      clipboard.writeText(url).then(() => afterCopy(key)).catch(() => afterCopy(key))
      return
    }
    afterCopy(key)
  }

  function rotate() {
    if (!confirm("Đổi link? Link cũ sẽ không dùng được nữa.")) return
    startTransition(() => {
      rotateShareTokenAction(classId)
    })
  }

  return (
    <div data-tour="share-done" className="grid md:grid-cols-2 gap-4">
      <TeacherTour
        tourId="share-link"
        steps={[shareLinkStep()]}
        seenKey={linkSeenKey}
        autoStart
        autoStartWhen={onboardingOpen && !linkDismissed}
        onEnd={() => {
          setLinkDismissed(true)
          setSeen(linkSeenKey)
          if (getSeen(TOUR_ONBOARDING_SEEN_KEY)) return
          if (getSeen(gradesSeenKey)) {
            setSeen(TOUR_ONBOARDING_SEEN_KEY)
            return
          }
          setShowGradesHint(true)
        }}
      />
      {showGradesHint && (
        <TeacherTour
          tourId="share-grades"
          steps={[shareGradesStep()]}
          seenKey={gradesSeenKey}
          autoStart
          autoStartWhen={onboardingOpen}
          onEnd={() => {
            setShowGradesHint(false)
            setSeen(gradesSeenKey)
            setSeen(TOUR_ONBOARDING_SEEN_KEY)
            setOnboardingOpen(false)
          }}
        />
      )}
      <Card data-tour="share-link">
        <CardHeader>
          <CardTitle>Link vào lớp cho học sinh</CardTitle>
          <CardDescription>
            Gửi link này cho học sinh để các em vào lớp, nhập tên vào ô, và tham gia các phiên thảo
            luận khi giáo viên mở.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
            <code className="flex-1 text-xs truncate">{classUrl}</code>
            <Button size="icon" variant="ghost" onClick={() => copy(classUrl, "class")}>
              <Copy className="size-4" aria-hidden="true" />
            </Button>
          </div>
          {copied === "class" && <p className="text-xs text-primary">Đã copy!</p>}
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={classUrl} target="_blank" rel="noreferrer" className="gap-1">
                <ExternalLink className="size-4" aria-hidden="true" />
                Thử mở
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={rotate} className="gap-1">
              <RotateCw className="size-4" aria-hidden="true" />
              Đổi link
            </Button>
          </div>

          <div className="rounded-md border bg-card p-3 flex flex-col items-center gap-2">
            <QrCode className="size-5 text-muted-foreground" aria-hidden="true" />
            <QRCodeSVG value={classUrl} size={200} level="M" className="rounded" />
            <p className="text-xs text-muted-foreground">Chiếu cho cả lớp quét</p>
          </div>
        </CardContent>
      </Card>

      <Card data-tour="share-grades">
        <CardHeader>
          <CardTitle>Link xem điểm</CardTitle>
          <CardDescription>
            Học sinh có thể xem điểm của các bạn trong lớp (chỉ xem, không sửa được). Bác có thể
            bật/tắt chia sẻ ở tab Bảng điểm.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
            <code className="flex-1 text-xs truncate">{gradesUrl}</code>
            <Button size="icon" variant="ghost" onClick={() => copy(gradesUrl, "grades")}>
              <Copy className="size-4" aria-hidden="true" />
            </Button>
          </div>
          {copied === "grades" && <p className="text-xs text-primary">Đã copy!</p>}
        </CardContent>
      </Card>
    </div>
  )
}
