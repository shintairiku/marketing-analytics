/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // HubSpot UI Extension用の設定
  assetPrefix: process.env.NODE_ENV === 'production' ? '/static' : '',
  trailingSlash: true,
  output: 'export',
  distDir: 'dist',
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig