/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['.monkeycode-ai.live'],
  serverExternalPackages: ['isomorphic-dompurify', 'jsdom'],
}

export default nextConfig
