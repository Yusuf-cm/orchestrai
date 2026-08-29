import { describe, expect, it } from 'vitest';
import {
  isLocalDevOrigin,
  isOnrenderOrigin,
  isOriginAllowed,
  originMatchesPattern,
  parseAllowedOrigins,
} from '../lib/cors';

describe('CORS origin matching', () => {
  it('strips trailing slashes and empty entries', () => {
    expect(parseAllowedOrigins(' https://a.example/ , ,http://localhost:43123')).toEqual([
      'https://a.example',
      'http://localhost:43123',
    ]);
  });

  it('matches an exact origin', () => {
    expect(
      originMatchesPattern('https://waypoint-web-bw9d.onrender.com', 'https://waypoint-web-bw9d.onrender.com')
    ).toBe(true);
  });

  it('matches a single Render subdomain wildcard', () => {
    expect(
      originMatchesPattern('https://waypoint-web-bw9d.onrender.com', 'https://*.onrender.com')
    ).toBe(true);
  });

  it('always allows localhost even when CORS_ORIGIN is a production URL', () => {
    expect(isLocalDevOrigin('http://localhost:43123')).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:43123', ['https://waypoint-web.onrender.com'])).toBe(true);
  });

  it('always allows https Render frontends, which is what unblocks the live demo', () => {
    expect(isOnrenderOrigin('https://waypoint-web-bw9d.onrender.com')).toBe(true);
    expect(isOriginAllowed('https://waypoint-web-bw9d.onrender.com', ['https://waypoint-web.onrender.com'])).toBe(
      true
    );
  });

  it('does not allow http onrender origins or unrelated hosts', () => {
    expect(isOnrenderOrigin('http://waypoint-web-bw9d.onrender.com')).toBe(false);
    expect(isOriginAllowed('https://evil.example', ['https://*.onrender.com'])).toBe(false);
  });
});
