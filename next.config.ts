import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
    middlewareClientMaxBodySize: "12mb",
  },
};

export default nextConfig;
