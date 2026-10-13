/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'bcryptjs', '@aws-sdk/client-s3', 'stripe'],
  agentRules: false,
  // The bottom-left "N" is the Next.js development indicator (dev-only).
  // Disable it so it never appears during next dev. Production builds do not include it.
  devIndicators: false,
  images: {
    unoptimized: true,
  },
  // Allow opening the app via http://127.0.0.1:3000 as well as localhost.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
}

export default nextConfig
