import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Avoid picking a parent folder when another package-lock.json exists on the machine.
  outputFileTracingRoot: path.join(__dirname),
  // Workaround: Next 15 dev can throw "SegmentViewNode ... not in the React Client Manifest"
  // and corrupt .next chunk refs after many HMR cycles. Disabling avoids the buggy devtools path.
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;
