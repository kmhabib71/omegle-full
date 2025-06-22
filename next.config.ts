import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false,
  // Disable SSR hydration warnings globally to prevent browser extension interference
  experimental: {
    optimizePackageImports: ["socket.io-client"],
  },
};

export default nextConfig;
