"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { PRIVACY_POLICY_VERSION, CONSENT_METADATA_KEYS } from "@/lib/privacy"
import { recordSignupConsentAction } from "@/app/consent-actions"

export default function SignUpPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  // Luật BVDL cá nhân 91/2025 (Điều 9): đồng ý phải tự nguyện, cụ thể từng
  // mục đích; im lặng không phải là đồng ý. Không tick đủ 2 ô thì không
  // được đăng ký.
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = ageConfirmed && consentGiven && !loading

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
          `${window.location.origin}/auth/callback`,
        data: {
          full_name: name,
          // Bằng chứng đồng ý: lưu cùng tài khoản (không cần migration).
          [CONSENT_METADATA_KEYS.consentPrivacy]: true,
          [CONSENT_METADATA_KEYS.consentVersion]: PRIVACY_POLICY_VERSION,
          [CONSENT_METADATA_KEYS.consentAt]: new Date().toISOString(),
          [CONSENT_METADATA_KEYS.ageConfirmed]: true,
        },
      },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    if (data.session) {
      // Đã có phiên (không cần xác nhận email): đồng bộ đồng ý sang profiles.
      await recordSignupConsentAction()
      router.push("/dashboard")
      router.refresh()
    } else {
      router.push("/auth/sign-up-success")
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-balance">Đăng ký tài khoản giáo viên</CardTitle>
          <CardDescription>Tạo tài khoản để bắt đầu quản lý lớp học.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Họ và tên</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-col gap-3 text-sm">
              <label className="flex items-start gap-2">
                <Checkbox
                  id="age-confirm"
                  checked={ageConfirmed}
                  onCheckedChange={(v) => setAgeConfirmed(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Tôi xác nhận mình từ đủ 18 tuổi. Tài khoản này chỉ dành cho giáo viên.
                </span>
              </label>
              <label className="flex items-start gap-2">
                <Checkbox
                  id="privacy-consent"
                  checked={consentGiven}
                  onCheckedChange={(v) => setConsentGiven(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Tôi đã đọc và đồng ý với{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Chính sách bảo mật
                  </Link>{" "}
                  và{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Điều khoản sử dụng
                  </Link>
                  , bao gồm việc xử lý dữ liệu học sinh và chấm bài bằng AI như đã mô tả.
                </span>
              </label>
            </div>
            <Button type="submit" disabled={!canSubmit}>
              {loading && <Spinner className="mr-2" />}
              Đăng ký
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Đã có tài khoản?{" "}
              <Link href="/auth/login" className="text-primary underline">
                Đăng nhập
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
