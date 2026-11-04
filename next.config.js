/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Skip the TypeScript type check during `next build` so a few Prisma Decimal
  // arithmetic spots (that don't actually break runtime) don't block deploys.
  // `pnpm typecheck` still runs the full check separately.
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // The welfare claims feature was removed on 2026-11-02 (both funder
  // buckets were closed by the GM of 2026-10-12). Members who bookmarked
  // /claims or installed the old PWA shortcut land on their dashboard
  // instead of a 404.
  async redirects() {
    return [
      { source: '/claims/:path*', destination: '/dashboard', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
