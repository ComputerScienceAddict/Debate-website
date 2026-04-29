import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Webpack config must not be set when using Turbopack or dev can corrupt `.next` (missing manifests on Windows). */
const usingTurbopackDev =
  process.argv.includes("--turbo") || process.argv.includes("--turbopack");

const nextConfig: NextConfig = {
  // Avoid picking a parent folder when another package-lock.json exists on the machine.
  outputFileTracingRoot: path.join(__dirname),
};

// Mitigate dev-only Webpack HMR chunk corruption:
// "__webpack_modules__[moduleId] is not a function" after many fast refreshes / mixed .next states.
// Only apply under `next dev` (no --turbo); `next dev --turbo` uses Turbopack and must not load this hook.
if (!usingTurbopackDev) {
  nextConfig.webpack = (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  };
}

export default nextConfig;
