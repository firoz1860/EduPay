/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Next 13.5.1's SWC minifier mis-escapes certain nested template literals in
  // vendored code, producing invalid JS during page-data collection. Use Terser.
  swcMinify: false,
  images: { unoptimized: true },
};

module.exports = nextConfig;
