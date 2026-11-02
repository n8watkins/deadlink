import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static: `next build` writes plain HTML, CSS, JS and images to out/,
  // which Cloudflare Workers static assets serves (see wrangler.jsonc and DEPLOY.md).
  output: "export",
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
