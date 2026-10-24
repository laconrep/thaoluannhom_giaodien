/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  // Bảo mật 24/10/2026: chặn clickjacking (trang chấm bị nhúng vào iframe lạ)
  // và MIME-sniffing. Chưa thêm CSP vì app nhúng nhiều iframe PPTX/Canva —
  // CSP làm sau khi rà soát xong danh sách nguồn nhúng.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]
  },
  allowedDevOrigins: ['.monkeycode-ai.live'],
  serverActions: {
    allowedOrigins: ['*.monkeycode-ai.live'],
  },
  serverExternalPackages: ['sharp'],
  experimental: {
    // Prefetch các tab giữ "tươi" 3 phút: bấm tab đã prefetch = hiện ngay,
    // không chờ fetch lại (mặc định chỉ 30s).
    staleTimes: { dynamic: 180 },
  },
}

export default nextConfig
