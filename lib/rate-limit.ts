// Giới hạn gọi API theo IP (báo cáo bảo mật 24/10/2026, GĐ4 — mục "không có
// rate limit ở bất kỳ đâu").
//
// Cơ chế: đếm trong bộ nhớ của tiến trình đang chạy. LƯU Ý THẬT: Vercel
// serverless mỗi instance có bộ nhớ riêng nên lớp này chỉ chặn được spam
// từ một nguồn dồn vào một instance và vòng lặp client chạy quá đà — không
// chặn được spam phân tán. Muốn chặn bền vững cần Vercel Firewall hoặc
// Upstash (đề xuất trong báo cáo, chưa triển khai vì cần thêm dịch vụ).
// Ngưỡng chọn rộng tay để không chặn nhầm cả lớp học sau một NAT trường học
// (một lớp 40 em nộp bài cùng lúc cũng chỉ ~120 request/phút).

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** Trả true nếu được phép gọi tiếp, false nếu vượt ngưỡng. */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= limit) return false
  bucket.count += 1
  return true
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0]?.trim() || "unknown"
}

/** Giới hạn chung cho route API: 300 request/phút/IP. */
export function checkApiRateLimit(request: Request): boolean {
  return checkRateLimit(`api:${clientIp(request)}`, 300, 60_000)
}

/** Giới hạn riêng cho route chấm AI (đắt, chạy tới 300s): 10 lần/phút/IP. */
export function checkGradeRunRateLimit(request: Request): boolean {
  return checkRateLimit(`grade-run:${clientIp(request)}`, 10, 60_000)
}
