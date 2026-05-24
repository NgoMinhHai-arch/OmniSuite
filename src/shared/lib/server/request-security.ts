import type { NextRequest } from 'next/server';

/** Chi cho phep truy cap tu localhost khi OMNISUITE_LOCALHOST_ONLY bat (mac dinh). */
export function isLocalhostRequest(req: NextRequest): boolean {
  if (process.env.OMNISUITE_LOCALHOST_ONLY === '0') return true;

  const forwarded = req.headers.get('x-forwarded-for');
  const ip = (forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || '127.0.0.1')
    .trim()
    .replace(/^\[|\]$/g, '');

  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip === '0.0.0.0') {
    return true;
  }
  if (ip.startsWith('::ffff:127.')) return true;

  const host = req.headers.get('host') || '';
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) return true;

  return false;
}

/** Bat buoc dang nhap (NextAuth). Mac dinh TAT — dung local khong can login. */
export function isAuthRequired(): boolean {
  const v = (process.env.OMNISUITE_REQUIRE_AUTH || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function localhostOnlyDeniedResponse() {
  return new Response(
    JSON.stringify({
      error:
        'Truy cap bi chan. OmniSuite chi cho phep localhost. Dat OMNISUITE_LOCALHOST_ONLY=0 trong .env neu can LAN (rui ro).',
    }),
    { status: 403, headers: { 'Content-Type': 'application/json' } },
  );
}
