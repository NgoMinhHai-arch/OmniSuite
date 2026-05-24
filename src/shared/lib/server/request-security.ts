import type { NextRequest } from 'next/server';
import { jsonWithSecurityHeaders } from '@/shared/lib/server/security-headers';

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

/** Khi localhost-only: chan Origin ngoai localhost (trinh duyet / fetch tu site khac). */
export function isTrustedDevOrigin(req: NextRequest): boolean {
  if (process.env.OMNISUITE_LOCALHOST_ONLY === '0') return true;
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  } catch {
    return false;
  }
}

/** Bat buoc dang nhap (NextAuth). Mac dinh TAT — dung local khong can login. */
export function isAuthRequired(): boolean {
  const v = (process.env.OMNISUITE_REQUIRE_AUTH || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function localhostOnlyDeniedResponse() {
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
    console.warn(
      '[Bao mat] Truy cap bi chan — chi localhost. Dat OMNISUITE_LOCALHOST_ONLY=0 trong .env neu can LAN (rui ro).',
    );
  }
  return jsonWithSecurityHeaders(
    {
      error:
        'Truy cap bi chan. OmniSuite chi cho phep localhost. Dat OMNISUITE_LOCALHOST_ONLY=0 trong .env neu can LAN (rui ro).',
    },
    { status: 403 },
  );
}

export function untrustedOriginDeniedResponse() {
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
    console.warn('[Bao mat] Origin khong hop le — chi chap nhan localhost khi OMNISUITE_LOCALHOST_ONLY=1.');
  }
  return jsonWithSecurityHeaders(
    { error: 'Origin khong hop le. Chi truy cap tu http://localhost hoac http://127.0.0.1.' },
    { status: 403 },
  );
}
