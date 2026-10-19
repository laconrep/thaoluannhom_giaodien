/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
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
