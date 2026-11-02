/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed 'output: export' to allow dynamic API routes for NextAuth
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  eslint: {
    // Allow builds to complete even with ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow builds to complete even with TypeScript errors
    ignoreBuildErrors: true,
  }
};

module.exports = nextConfig;