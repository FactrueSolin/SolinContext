import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": [
      "app/lib/db/migrations/**/*",
      "node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/Release/*.node",
    ],
  },
};

export default nextConfig;
