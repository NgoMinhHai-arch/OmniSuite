import { NextResponse } from 'next/server';

/** Minimal headers for API/dashboard responses — does not break local dev. */
export function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-DNS-Prefetch-Control', 'off');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res;
}

export function jsonWithSecurityHeaders(
  body: unknown,
  init?: { status?: number; headers?: HeadersInit },
): NextResponse {
  const res = NextResponse.json(body, init);
  return applySecurityHeaders(res);
}
