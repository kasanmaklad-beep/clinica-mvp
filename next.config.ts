import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "10.0.0.234",
    "10.0.0.234:3000",
    "192.168.*",
  ],
};

export default nextConfig;
