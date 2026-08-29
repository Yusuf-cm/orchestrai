import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Do not rewrite `/backend` here. A rewrite forwards the browser Origin
  // header to the API, which is what made older deploys return HTTP 500.
  // The App Router handler at `src/app/backend/[...path]/route.ts` strips it.
};

export default nextConfig;
