import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Prisma from being bundled by webpack/turbopack
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('@prisma/client');
    }
    return config;
  },
  serverExternalPackages: ['@prisma/client', 'prisma'],
  turbopack: {},
};

export default nextConfig;
