/**
 * INTERNAL_TOKEN — không dùng fallback yếu khi bật strict security.
 */
export function getInternalToken(): string | null {
  const t = process.env.INTERNAL_TOKEN?.trim();
  if (t) return t;
  const strict =
    process.env.OMNISUITE_STRICT_SECURITY === '1' ||
    process.env.OMNISUITE_STRICT_SECURITY === 'true' ||
    process.env.OMNISUITE_STRICT_SECURITY === undefined;
  if (strict) return null;
  return null;
}

export function requireInternalToken(): string {
  const t = getInternalToken();
  if (!t) {
    throw new Error(
      'INTERNAL_TOKEN chưa cấu hình. Đặt trong .env (launcher tự sinh khi chạy lần đầu).',
    );
  }
  return t;
}

export function internalTokenHeaders(): Record<string, string> {
  const t = requireInternalToken();
  return { 'x-internal-token': t };
}
