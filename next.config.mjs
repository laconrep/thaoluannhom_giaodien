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
}

export default nextConfig
