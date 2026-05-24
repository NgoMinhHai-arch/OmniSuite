/**
 * Hành động “quản gia” — điều hướng /dashboard, slash whitelist, hoặc mở tìm DuckDuckGo.
 */

export type ButlerAction =
  | { type: 'open'; href: string; label: string }
  | { type: 'slash'; command: string; label: string }
  /** Mở DuckDuckGo với query (tab mới). */
  | { type: 'web'; query: string; label: string };

function safeWebQuery(raw: string): string | null {
  const t = raw.trim().slice(0, 400);
  if (!t) return null;
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f<>"]/.test(t)) return null;
  return t;
}

const SLASH_ALLOW = new Set(
  [
    '/help',
    '/tour',
    '/tools',
    '/howto',
    '/settings',
    '/llm',
    '/troubleshoot',
    '/check',
    '/run',
    '/run-browser',
    '/integrations',
    '/apply',
    '/score',
    '/plan',
    '/browser',
    '/web',
  ].map((s) => s.toLowerCase()),
);

function safeDashboardHref(href: string): string | null {
  const h = href.trim();
  if (!h.startsWith('/') || h.startsWith('//') || /[\s<>"']/.test(h) || h.includes('://')) {
    return null;
  }
  if (h === '/dashboard' || h.startsWith('/dashboard/') || h.startsWith('/dashboard?')) {
    return h;
  }
  return null;
}

function safeSlashCommand(raw: string): string | null {
  const s = raw.trim();
  if (!s.startsWith('/') || s.length > 800) return null;
  const first = s.split(/\s+/)[0]?.toLowerCase() ?? '';
  if (!SLASH_ALLOW.has(first)) return null;
  return s;
}

/** Chuẩn hoá tối đa 6 thao tác hợp lệ từ payload LLM. */
export function sanitizeButlerActions(raw: unknown): ButlerAction[] {
  if (!Array.isArray(raw)) return [];
  const out: ButlerAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const type = typeof o.type === 'string' ? o.type.toLowerCase() : '';
    const label = typeof o.label === 'string' ? o.label.trim().slice(0, 120) : '';
    if (!label) continue;

    if (type === 'open') {
      const href = typeof o.href === 'string' ? safeDashboardHref(o.href) : null;
      if (href) out.push({ type: 'open', href, label });
    } else if (type === 'slash') {
      const command = typeof o.command === 'string' ? safeSlashCommand(o.command) : null;
      if (command) out.push({ type: 'slash', command, label });
    } else if (type === 'web') {
      const query = typeof o.query === 'string' ? safeWebQuery(o.query) : null;
      if (query) out.push({ type: 'web', query, label });
    }
    if (out.length >= 6) break;
  }
  return out;
}
