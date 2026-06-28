import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "vercel.com",
      },
      {
        protocol: "https",
        hostname: "*.vercel.com",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  webpack: (config) => {
    // Ignore missing source maps from @workflow/serde beta package
    // This is a beta package issue and doesn't affect functionality
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /@workflow\/serde/,
        message: /failed to read input source map/,
      },
    ];
    return config;
  },
};

export default withWorkflow(withBotId(nextConfig));
