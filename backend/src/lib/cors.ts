/**
 * Origin matching for the API. Render appends random suffixes to service
 * names (`waypoint-web-bw9d.onrender.com`), so a hardcoded frontend URL in
 * CORS_ORIGIN breaks the moment the web service is recreated. Wildcards and
 * a built-in onrender.com allow-list exist so a missed env var cannot take
 * the demo down.
 */

export function parseAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function originMatchesPattern(origin: string, allowed: string): boolean {
  if (allowed === origin) return true;
  if (!allowed.includes('*')) return false;
  const pattern = new RegExp(
    `^${allowed.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+')}$`,
    'i'
  );
  return pattern.test(origin);
}

export function isLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function isOnrenderOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'onrender.com' || url.hostname.endsWith('.onrender.com'))
    );
  } catch {
    return false;
  }
}

export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.some((allowed) => originMatchesPattern(origin, allowed))) {
    return true;
  }
  return isLocalDevOrigin(origin) || isOnrenderOrigin(origin);
}
