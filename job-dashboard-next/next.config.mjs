/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      // Silence the browser's automatic favicon.ico request
      { source: '/favicon.ico', destination: '/icon.svg', permanent: false },
    ]
  },
}

export default nextConfig
