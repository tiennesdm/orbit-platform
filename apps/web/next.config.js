/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@orbit/types', '@orbit/crypto', '@orbit/db'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.orbit.com' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;
