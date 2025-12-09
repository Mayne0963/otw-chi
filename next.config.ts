import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // App Router is enabled by using the /app directory
  }
};

export default nextConfig;
