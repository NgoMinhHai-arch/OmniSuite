/**
 * INTERNAL_TOKEN:
 * - development local: allow fallback to default token with a clear warning
 * - strict mode / production: require a non-default token
 */
export const DEFAULT_INTERNAL_TOKEN = 'omnisuite_secret_token_123';

let warnedDefaultToken = false;

function isStrictSecurityMode(): boolean {
  return (
    process.env.OMNISUITE_STRICT_SECURITY === '1' ||
    process.env.OMNISUITE_STRICT_SECURITY === 'true' ||
    process.env.NODE_ENV === 'production'
  );
}

function warnDefaultToken(message: string) {
  if (warnedDefaultToken) return;
  warnedDefaultToken = true;
  console.warn(`[security] ${message}`);
}

export function getInternalToken(): string | null {
  const token = process.env.INTERNAL_TOKEN?.trim() || '';
  const strict = isStrictSecurityMode();

  if (strict) {
    if (!token) return null;
    if (token === DEFAULT_INTERNAL_TOKEN) {
      throw new Error(
        'INTERNAL_TOKEN Ä‘ang dÃ¹ng giÃ¡ trá»‹ máº·c Ä‘á»‹nh trong strict mode/production. HÃ£y Ä‘áº·t token riÃªng trong .env.',
      );
    }
    return token;
  }

  if (!token) {
    warnDefaultToken(
      `INTERNAL_TOKEN chÆ°a Ä‘Æ°á»£c Ä‘áº·t. Development sáº½ fallback sang token máº·c Ä‘á»‹nh "${DEFAULT_INTERNAL_TOKEN}".`,
    );
    return DEFAULT_INTERNAL_TOKEN;
  }

  if (token === DEFAULT_INTERNAL_TOKEN) {
    warnDefaultToken(
      `INTERNAL_TOKEN Ä‘ang dÃ¹ng giÃ¡ trá»‹ máº·c Ä‘á»‹nh "${DEFAULT_INTERNAL_TOKEN}". Chá»‰ nÃªn dÃ¹ng cho development local.`,
    );
  }

  return token;
}

export function requireInternalToken(): string {
  const token = getInternalToken();
  if (!token) {
    throw new Error(
      'INTERNAL_TOKEN chÆ°a cáº¥u hÃ¬nh há»£p lá»‡. Äáº·t token riÃªng trong .env hoáº·c táº¯t strict mode khi cháº¡y development.',
    );
  }
  return token;
}

export function internalTokenHeaders(): Record<string, string> {
  const token = requireInternalToken();
  return { 'x-internal-token': token };
}
