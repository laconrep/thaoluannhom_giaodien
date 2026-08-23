"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { fetchClassGroups } from "@/lib/class-groups"
import {
  leaderSwapSlotsAction,
  leaderUpdateGroupMembersAction,
  studentClaimSlotAction,
} from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useCountdown, formatClock } from "@/lib/use-countdown"
import {
  ArrowRight,
  Crown,
  GraduationCap,
  ClipboardList,
  Lock,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { groupCardStyle, groupPillStyle } from "@/lib/group-colors"

type Student = {
  id: string
  slot_number: number
  name: string | null
  device_token: string | null
}
type Session = {
  id: string
  title: string
  kind: "group" | "individual"
  status: string
  started_at: string | null
  ends_at: string | null
  duration_seconds: number
}
type Group = { id: string; name: string; color: string; leader_student_id: string | null }
type GroupMember = { class_group_id: string; student_id: string }

function getDeviceToken() {
  if (typeof window === "undefined") return ""
  let t = localStorage.getItem("device_token")
  if (!t) {
    t = crypto.randomUUID()
    localStorage.setItem("device_token", t)
  }
  return t
}

export function ClassLobby({
  classId,
  className,
  token,
  students: initialStudents,
  sessions: initialSessions,
  groups: initialGroups,
  members: initialMembers,
}: {
  classId: string
  className: string
  token: string
  students: Student[]
  sessions: Session[]
  groups: Group[]
  members: GroupMember[]
}) {
  const [students, setStudents] = useState(initialStudents)
  const [sessions, setSessions] = useState(initialSessions)
  const [groups, setGroups] = useState<Group[]>(initialGroups)
  const [members, setMembers] = useState<GroupMember[]>(initialMembers)
  const [myStudentId, setMyStudentId] = useState<string | null>(null)
  const [dragStudentId, setDragStudentId] = useState<string | null>(null)
  const [saving, startTransition] = useTransition()
  const [deviceToken] = useState(() => getDeviceToken())

  // Đồng bộ dữ liệu từ DB (dùng cho Realtime event + polling fallback + sau các action).
  // Dùng useCallback để ổn định tham chiếu, tránh chạy lại effect liên tục.
  const refreshStudents = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("students")
      .select("id, slot_number, name, device_token")
      .eq("class_id", classId)
      .order("slot_number")
    if (data) setStudents(data as Student[])
  }, [classId])

  const refreshGroups = useCallback(async () => {
    const supabase = createClient()
    const data = await fetchClassGroups(supabase, classId)
    setGroups(data)
  }, [classId])

  const refreshMembers = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("class_group_members")
      .select("class_group_id, student_id, class_groups!inner(class_id)")
      .eq("class_groups.class_id", classId)
    if (data) setMembers(data as GroupMember[])
  }, [classId])

  // Load identity từ localStorage — chỉ vào thẳng nếu ô còn giữ đúng device_token của thiết bị mình.
  // Nếu GV đã mở khóa hoặc thiết bị khác đã chiếm ô → quay về màn chọn ô để chọn lại.
  useEffect(() => {
    const dt = getDeviceToken()
    const saved = localStorage.getItem(`class_${classId}_student`)
    if (saved) {
      const st = students.find((s) => s.id === saved)
      if (st && st.device_token === dt) {
        setMyStudentId(saved)
        return
      }
      localStorage.removeItem(`class_${classId}_student`)
    }
    // cũng thử tìm qua device_token
    const match = students.find((s) => s.device_token === dt)
    if (match) {
      setMyStudentId(match.id)
      localStorage.setItem(`class_${classId}_student`, match.id)
    }
  }, [classId, students])

  // Realtime: sessions appearing/disappearing + students name updates
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`lobby-${classId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students", filter: `class_id=eq.${classId}` },
        (p: any) => {
          if (p.eventType === "UPDATE" && p.new) {
            setStudents((cur) =>
              cur
                .map((s) => (s.id === p.new.id ? { ...s, ...p.new } : s))
                .sort((a, b) => a.slot_number - b.slot_number),
            )
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `class_id=eq.${classId}` },
        (p: any) => {
          if (p.eventType === "INSERT" && p.new) {
            setSessions((cur) => [p.new as Session, ...cur])
          } else if (p.eventType === "UPDATE" && p.new) {
            setSessions((cur) => {
              const exists = cur.find((x) => x.id === p.new.id)
              if (p.new.status === "ended") {
                return cur.filter((x) => x.id !== p.new.id)
              }
              if (exists) {
                return cur.map((x) => (x.id === p.new.id ? (p.new as Session) : x))
              }
              return [p.new as Session, ...cur]
            })
          } else if (p.eventType === "DELETE" && p.old) {
            setSessions((cur) => cur.filter((x) => x.id !== p.old.id))
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_groups", filter: `class_id=eq.${classId}` },
        () => {
          refreshGroups()
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_group_members" },
        () => {
          refreshMembers()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [classId, refreshGroups, refreshMembers])

  // Fallback đồng bộ định kỳ: nếu Realtime không gửi sự kiện, vẫn tự làm mới
  // nhóm/trạng thái leader/member để không phải F5.
  useEffect(() => {
    const id = setInterval(() => {
      refreshStudents()
      refreshGroups()
      refreshMembers()
    }, 5000)
    return () => clearInterval(id)
  }, [classId, refreshStudents, refreshGroups, refreshMembers])

  function claimSlot(studentId: string) {
    if (saving) return
    startTransition(async () => {
      const res = await studentClaimSlotAction(studentId, getDeviceToken())
      if (!res.ok) {
        toast.error(res.error ?? "Không chọn được ô.")
        return
      }
      setMyStudentId(studentId)
      localStorage.setItem(`class_${classId}_student`, studentId)
    })
  }

  function changeSlot() {
    localStorage.removeItem(`class_${classId}_student`)
    setMyStudentId(null)
  }

  // Nhóm mà mình làm nhóm trưởng
  const myLeaderGroup = useMemo(
    () => (myStudentId ? groups.find((g) => g.leader_student_id === myStudentId) ?? null : null),
    [myStudentId, groups],
  )

  // Map student_id -> group (để xác định trạng thái từng thẻ HS)
  const studentToGroup = useMemo(() => {
    const m = new Map<string, Group>()
    for (const g of groups) {
      for (const mem of members) {
        if (mem.class_group_id === g.id) m.set(mem.student_id, g)
      }
    }
    return m
  }, [groups, members])

  async function leaderAdd(targetStudentId: string) {
    const res = await leaderUpdateGroupMembersAction({
      classId,
      leaderStudentId: myStudentId!,
      deviceToken: getDeviceToken(),
      targetStudentId,
      action: "add",
    })
    if (!res.ok) {
      toast.error(res.error ?? "Không thêm được")
      return
    }
    await Promise.all([refreshGroups(), refreshMembers()])
  }

  async function leaderRemove(targetStudentId: string) {
    const res = await leaderUpdateGroupMembersAction({
      classId,
      leaderStudentId: myStudentId!,
      deviceToken: getDeviceToken(),
      targetStudentId,
      action: "remove",
    })
    if (!res.ok) {
      toast.error(res.error ?? "Không gỡ được")
      return
    }
    await Promise.all([refreshGroups(), refreshMembers()])
  }

  // Nhóm trưởng kéo thẻ HS trong nhóm mình đổi vị trí với bất kỳ HS nào.
  // Cập nhật ngay tại chỗ (optimistic) rồi gọi action, sau đó refetch để đồng bộ chắc chắn.
  async function handleLeaderSwapDrop(draggedId: string, targetId: string) {
    if (!myStudentId || !draggedId || draggedId === targetId) return
    setStudents((cur) => {
      const a = cur.find((x) => x.id === draggedId)
      const b = cur.find((x) => x.id === targetId)
      if (!a || !b) return cur
      return cur
        .map((s) => {
          if (s.id === a.id) return { ...s, slot_number: b.slot_number }
          if (s.id === b.id) return { ...s, slot_number: a.slot_number }
          return s
        })
        .sort((x, y) => x.slot_number - y.slot_number)
    })
    const res = await leaderSwapSlotsAction({
      classId,
      leaderStudentId: myStudentId,
      deviceToken: getDeviceToken(),
      draggedStudentId: draggedId,
      targetStudentId: targetId,
    })
    if (!res.ok) toast.error(res.error ?? "Không đổi được vị trí")
    await refreshStudents()
  }

  if (!myStudentId) {
    return (
      <main className="min-h-svh bg-muted/40 flex items-center justify-center p-4">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-md bg-primary text-primary-foreground grid place-items-center">
                <GraduationCap className="size-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle>{className}</CardTitle>
                <CardDescription>Bấm vào thẻ có tên của em để vào lớp</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Bấm vào thẻ có tên của em (giáo viên đã xếp số theo lớp).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 max-h-[60vh] overflow-auto p-1">
              {students.map((s) => {
                const hasName = !!s.name?.trim()
                const isMine = s.device_token === deviceToken
                const lockedByOther = !!s.device_token && s.device_token !== deviceToken
                const clickable = hasName && !lockedByOther
                const g = studentToGroup.get(s.id)
                const isLeader = groups.some((x) => x.leader_student_id === s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!clickable || saving}
                    onClick={() => claimSlot(s.id)}
                    className={cn(
                      "rounded-lg border bg-card px-1.5 py-2 flex items-center gap-1.5 transition text-left w-full",
                      clickable ? "cursor-pointer hover:bg-muted/40" : "opacity-60 cursor-not-allowed",
                      isMine && "ring-2 ring-primary ring-offset-1",
                    )}
                    style={g ? groupCardStyle(g.color) : undefined}
                    title={
                      lockedByOther
                        ? "Ô này đã được thiết bị khác chọn"
                        : isMine
                          ? `${s.name} — ô của em`
                          : hasName
                            ? `Bấm để chọn ô ${s.slot_number}`
                            : "Chưa có tên"
                    }
                  >
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="size-5 rounded bg-muted text-muted-foreground grid place-items-center text-[10px] font-semibold tabular-nums shrink-0">
                          {s.slot_number}
                        </span>
                        <span className="flex-1 min-w-0 text-sm font-medium truncate">
                          {hasName ? (
                            s.name
                          ) : (
                            <span className="text-muted-foreground/70">Trống</span>
                          )}
                        </span>
                        {isLeader && (
                          <Crown className="size-4 shrink-0 text-amber-500" aria-label="Nhóm trưởng" />
                        )}
                        {isMine && (
                          <span className="text-[10px] font-semibold text-primary shrink-0">Em</span>
                        )}
                        {lockedByOther && (
                          <Lock className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                        )}
                      </div>
                      {g && (
                        <span
                          className="mt-0.5 inline-flex items-center gap-1 rounded-full text-[10px] font-medium border px-1.5 py-0 w-fit"
                          style={groupPillStyle(g.color)}
                        >
                          <span
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: g.color }}
                          />
                          {g.name}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  const me = students.find((s) => s.id === myStudentId)

  return (
    <main className="min-h-svh bg-muted/40 p-4">
      <div className="mx-auto max-w-3xl flex flex-col gap-4">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>{className}</CardTitle>
              <CardDescription>
                Ô số {me?.slot_number} — {me?.name}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={changeSlot}>
              Đổi ô
            </Button>
          </CardHeader>
        </Card>

        <Tabs defaultValue="sessions">
          <TabsList className="w-full">
            <TabsTrigger value="sessions" className="flex-1">
              Phiên thảo luận
            </TabsTrigger>
            {myLeaderGroup && (
              <TabsTrigger value="mygroup" className="flex-1">
                Nhóm của em
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="sessions" className="mt-4 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Các phiên đang mở</h2>
            {sessions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Hiện chưa có phiên nào mở. Chờ giáo viên bắt đầu.
                </CardContent>
              </Card>
            ) : (
              <ul className="flex flex-col gap-3">
                {sessions.map((s) => (
                  <SessionRow key={s.id} session={s} token={token} />
                ))}
              </ul>
            )}

            <div className="text-center mt-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/c/${token}/scores`} className="gap-2">
                  <ClipboardList className="size-4" aria-hidden="true" />
                  Xem điểm
                </Link>
              </Button>
            </div>
          </TabsContent>

          {myLeaderGroup && (
            <TabsContent value="mygroup" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">Nhóm của em — {myLeaderGroup.name}</CardTitle>
                  <CardDescription>
                    Bấm vào thẻ học sinh chưa có nhóm để thêm vào nhóm em (thẻ sẽ đổi màu theo nhóm).
                    Bấm lại một thành viên trong nhóm em để gỡ ra. Thành viên trong nhóm có thể kéo
                    đè lên thẻ khác để đổi vị trí.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {[...students]
                      .sort((a, b) => a.slot_number - b.slot_number)
                      .map((s) => {
                        const stuGroup = studentToGroup.get(s.id)
                        const inMyGroup = stuGroup?.id === myLeaderGroup.id
                        const unassigned = !stuGroup
                        const isMe = s.id === myStudentId
                        const hasName = !!s.name?.trim()
                        const draggable = hasName && inMyGroup
                        return (
                          <li
                            key={s.id}
                            draggable={draggable}
                            onDragStart={(e) => {
                              if (!draggable) {
                                e.preventDefault()
                                return
                              }
                              setDragStudentId(s.id)
                              e.dataTransfer.effectAllowed = "move"
                              e.dataTransfer.setData("text/plain", s.id)
                            }}
                            onDragOver={(e) => {
                              if (!dragStudentId) return
                              e.preventDefault()
                              e.dataTransfer.dropEffect = "move"
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              const sid = e.dataTransfer.getData("text/plain") || dragStudentId
                              setDragStudentId(null)
                              if (!sid || sid === s.id) return
                              if (studentToGroup.get(sid)?.id === myLeaderGroup.id) {
                                handleLeaderSwapDrop(sid, s.id)
                              }
                            }}
                            onDragEnd={() => setDragStudentId(null)}
                            onClick={() => {
                              if (!hasName) return
                              if (unassigned) leaderAdd(s.id)
                              else if (inMyGroup && !isMe) leaderRemove(s.id)
                            }}
                            className={cn(
                              "rounded-lg border bg-card transition px-1.5 py-2 flex items-center gap-1.5",
                              draggable
                                ? "cursor-grab active:cursor-grabbing"
                                : hasName
                                  ? "cursor-pointer hover:bg-muted/40"
                                  : "opacity-70",
                              dragStudentId === s.id && "opacity-40",
                              isMe && "ring-2 ring-primary ring-offset-1",
                            )}
                            style={stuGroup ? groupCardStyle(stuGroup.color) : undefined}
                            title={
                              unassigned && hasName
                                ? `Bấm để thêm ${s.name} vào nhóm em.`
                                : inMyGroup && !isMe
                                  ? `Bấm để gỡ ${s.name} khỏi nhóm em. Kéo đè lên thẻ khác để đổi vị trí.`
                                  : isMe
                                    ? "Đây là ô của em."
                                    : stuGroup
                                      ? `${s.name} — ${stuGroup.name}. Chỉ giáo viên mới đổi nhóm được.`
                                      : "Chưa có tên"
                            }
                          >
                            <div className="flex-1 min-w-0 flex flex-col">
                              <div className="flex items-center gap-1">
                                <span className="size-5 rounded bg-muted text-muted-foreground grid place-items-center text-[10px] font-semibold tabular-nums shrink-0">
                                  {s.slot_number}
                                </span>
                                <span className="flex-1 min-w-0 text-sm font-medium truncate">
                                  {hasName ? (
                                    s.name
                                  ) : (
                                    <span className="text-muted-foreground/70">Trống</span>
                                  )}
                                </span>
                                {isMe && (
                                  <span className="text-[10px] font-semibold text-primary shrink-0">
                                    Em
                                  </span>
                                )}
                                {inMyGroup && (
                                  <Crown className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
                                )}
                                {stuGroup && !inMyGroup && (
                                  <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                )}
                              </div>
                              {stuGroup && (
                                <span
                                  className="mt-0.5 inline-flex items-center gap-1 rounded-full text-[10px] font-medium border px-1.5 py-0 w-fit"
                                  style={groupPillStyle(stuGroup.color)}
                                >
                                  <span
                                    className="size-1.5 rounded-full"
                                    style={{ backgroundColor: stuGroup.color }}
                                  />
                                  {stuGroup.name}
                                </span>
                              )}
                            </div>
                          </li>
                        )
                      })}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </main>
  )
}

function SessionRow({ session, token }: { session: Session; token: string }) {
  const left = useCountdown(session.ends_at, session.status)
  return (
    <li>
      <Link
        href={`/c/${token}/session/${session.id}`}
        className="block rounded-lg border bg-card p-4 hover:bg-muted/30 transition"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <p className="font-semibold text-pretty">{session.title}</p>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
              {session.kind === "group" ? (
                <>
                  <Users className="size-3" aria-hidden="true" /> Thảo luận nhóm
                </>
              ) : (
                <>
                  <ClipboardList className="size-3" aria-hidden="true" /> Làm bài cá nhân
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            {session.status === "running" ? (
              <span className="text-lg font-mono tabular-nums text-primary">
                {formatClock(left)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Chưa bắt đầu</span>
            )}
            <ArrowRight className="size-4 inline-block ml-2" aria-hidden="true" />
          </div>
        </div>
      </Link>
    </li>
  )
}
