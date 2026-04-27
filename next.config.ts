import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Avoid picking a parent folder when another package-lock.json exists on the machine.
  outputFileTracingRoot: path.join(__dirname),
  // Mitigate dev-only Webpack HMR chunk corruption:
  // "__webpack_modules__[moduleId] is not a function" after many fast refreshes / mixed .next states.
  // Turbopack (`next dev --turbo`, see package.json) avoids this path entirely.
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
