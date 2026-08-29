import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Preview and the cloud browser hit 127.0.0.1, not localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Do not rewrite `/backend` here. A rewrite forwards the browser Origin
  // header to the API, which is what made older deploys return HTTP 500.
  // The App Router handler at `src/app/backend/[...path]/route.ts` strips it.
};

export default nextConfig;
