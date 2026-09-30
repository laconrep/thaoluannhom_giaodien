/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['.monkeycode-ai.live'],
  serverActions: {
    allowedOrigins: ['*.monkeycode-ai.live'],
  },
  serverExternalPackages: ['sharp'],
}

export default nextConfig
