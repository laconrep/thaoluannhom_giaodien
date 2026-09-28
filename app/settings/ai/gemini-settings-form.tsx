"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { saveGeminiSettingsAction } from "@/app/ai-grade-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { GeminiTier } from "@/lib/types"

export function GeminiSettingsForm({
  hasKey,
  maskedKey,
  initialTier,
}: {
  hasKey: boolean
  maskedKey: string
  initialTier: GeminiTier
}) {
  const [apiKey, setApiKey] = useState("")
  const [tier, setTier] = useState<GeminiTier>(initialTier)
  const [pending, startTransition] = useTransition()

  function onSave() {
    startTransition(async () => {
      try {
        await saveGeminiSettingsAction(apiKey, tier)
        toast.success("Đã lưu API Gemini")
        setApiKey("")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không lưu được")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Key Gemini</CardTitle>
        <CardDescription>
          Lấy key tại Google AI Studio. Key chỉ lưu cho tài khoản này, không dùng chung với học sinh.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {hasKey && (
          <p className="text-xs text-muted-foreground">
            Key hiện tại: <span className="font-mono">{maskedKey}</span>
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gemini-key">API key</Label>
          <Input
            id="gemini-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasKey ? "Dán key mới để thay" : "AIza…"}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Gói Gemini</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTier("free")}
              className={`rounded-lg border p-3 text-left text-sm ${
                tier === "free" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/40"
              }`}
            >
              <p className="font-medium">Free</p>
              <p className="text-xs text-muted-foreground">AI Studio miễn phí, hạn mức ngày.</p>
            </button>
            <button
              type="button"
              onClick={() => setTier("pro")}
              className={`rounded-lg border p-3 text-left text-sm ${
                tier === "pro" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/40"
              }`}
            >
              <p className="font-medium">Pro</p>
              <p className="text-xs text-muted-foreground">Key gói trả phí, hạn mức cao hơn.</p>
            </button>
          </div>
        </div>
        <Button onClick={onSave} disabled={pending || (!apiKey.trim() && !hasKey)}>
          {pending ? "Đang lưu…" : "Lưu"}
        </Button>
      </CardContent>
    </Card>
  )
}
