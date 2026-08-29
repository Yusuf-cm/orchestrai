import { NextRequest } from "next/server";

/**
 * Same-origin reverse proxy onto the API.
 *
 * The live frontend is on a different Render hostname from the API. Browsers
 * send an Origin header; older API deploys throw a 500 on a CORS mismatch,
 * which is exactly what broke the public demo. This route forwards the request
 * server-side and deliberately drops Origin so the API treats it as
 * server-to-server — which already works on the currently deployed API.
 *
 * NEXT_PUBLIC_API_URL is inlined at build time on Render.
 */
const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DROP_REQUEST_HEADERS = new Set([
  "connection",
  "content-length",
  "cookie",
  "host",
  "origin",
  "referer",
  "accept-encoding",
]);

const DROP_RESPONSE_HEADERS = new Set([
  "connection",
  "content-encoding",
  "transfer-encoding",
]);

async function proxy(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = `${API_URL}/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!DROP_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) {
      init.body = buf;
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return Response.json(
      {
        error:
          "Could not reach the Waypoint API. Free-tier services sleep after inactivity — wait a minute and try again.",
      },
      { status: 502 }
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (DROP_RESPONSE_HEADERS.has(lower)) return;
    if (lower.startsWith("access-control-")) return;
    out.set(key, value);
  });

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
