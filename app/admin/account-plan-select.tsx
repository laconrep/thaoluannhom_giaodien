"use client"

import { useState, useTransition } from "react"
import { setAccountPlanAction } from "@/app/admin/actions"
import { PLANS, type Plan } from "@/lib/plans"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function AccountPlanSelect({
  userId,
  email,
  currentPlan,
}: {
  userId: string
  email: string
  currentPlan: Plan
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null)
  const target = PLANS.find((p) => p.id === pendingPlan)

  return (
    <div className="flex flex-col items-start gap-1">
      <Select
        value={currentPlan}
        disabled={pending}
        onValueChange={(value) => {
          if (value === currentPlan) return
          if (value === "free" || value === "pro" || value === "school") {
            setError(null)
            setPendingPlan(value)
          }
        }}
      >
        <SelectTrigger size="sm" aria-label={`Đổi gói ${email}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PLANS.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog open={pendingPlan !== null} onOpenChange={(open) => { if (!open) setPendingPlan(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đổi gói?</AlertDialogTitle>
            <AlertDialogDescription>
              {email} sẽ chuyển sang gói {target?.name ?? pendingPlan}. Hạn mức lớp và học sinh theo gói mới.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingPlan) return
                const next = pendingPlan
                setPendingPlan(null)
                startTransition(async () => {
                  try {
                    await setAccountPlanAction(userId, next)
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Không đổi được gói.")
                  }
                })
              }}
            >
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
