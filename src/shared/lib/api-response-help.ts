/**
 * Helpers for detecting HTML error pages returned instead of JSON / NDJSON from Next API routes.
 */

const HTML_START_RE = /^\s*<!DOCTYPE\s|^[\s]*<html\b/i;

export function peekStartsLikeHtml(raw: string): boolean {
  const head = raw.trimStart().slice(0, 96);
  return HTML_START_RE.test(head) || head.startsWith('<');
}

export function responseContentTypeLooksHtml(ct: string): boolean {
  const lower = (ct || '').toLowerCase();
  return lower.includes('text/html');
}

/** Vietnamese hints when /api/* returns HTML or wrong host (404 document, preview, static-only hosting). */
export function buildApiRouteUnavailableLines(opts: {
  status: number;
  endpointLabel: string;
  contentType: string;
  bodyPeek: string;
}): string[] {
  const looksHtml =
    responseContentTypeLooksHtml(opts.contentType) || peekStartsLikeHtml(opts.bodyPeek);

  const head =
    opts.status === 0
      ? `Lỗi mạng hoặc không tới được "${opts.endpointLabel}" (không có phản hồi HTTP).`
      : `Lỗi API "${opts.endpointLabel}": HTTP ${opts.status}${looksHtml ? ' (trả về trang HTML thay vì JSON/stream)' : ''}.`;

  const lines: string[] = [
    head,
    '',
    'Nguyên nhân thường gặp:',
    '- Next.js chưa chạy hoặc mở nhầm tab (preview/embed không cùng máy chủ với API).',
    '- Chạy dev/start không đúng thư mục app có src/app/api (thư mục chứa package.json của OmniSuite).',
    '- Hosting chỉ phục vụ static, không có Route Handler Node.',
    '',
    'Việc nên làm:',
    '- Trong thư mục app: chạy npm run dev (hoặc npm run start sau npm run build).',
    '- Mở Quản gia trên đúng URL máy chủ đó (ví dụ http://127.0.0.1:3000), không phải file hoặc origin khác.',
    `- Thử trên cùng tab: ${typeof window !== 'undefined' ? `${window.location.origin}/api/ai-support/capabilities` : '/api/ai-support/capabilities'} — phải thấy JSON, không phải trang HTML.`,
  ];

  if (looksHtml && opts.bodyPeek.trim()) {
    lines.push('', `(Đoạn đầu phản hồi: ${opts.bodyPeek.trim().slice(0, 120)}${opts.bodyPeek.length > 120 ? '…' : ''})`);
  }

  return lines;
}

/** Dòng đầu của body NDJSON dạng `{ type: "error", error: "..." }` (run/route reject). */
export function tryParseNdjsonErrorLine(raw: string): string | null {
  const line = raw.trim().split('\n')[0] ?? '';
  if (!line.startsWith('{')) return null;
  try {
    const o = JSON.parse(line) as { type?: string; error?: string };
    if (o?.type === 'error' && typeof o.error === 'string' && o.error.trim()) return o.error.trim();
  } catch {
    /* noop */
  }
  return null;
}

/** HTTP 403 trên POST /api/ai-support/run — runner tắt hoặc AI_SUPPORT_RUNNER_SECRET không khớp (không phải lỗi Next/HTML). */
export function buildAiSupportRunner403Lines(serverMessage?: string): string[] {
  const lines: string[] = [
    'Runner bị từ chối (HTTP 403): máy chủ đang chặn có chủ đích — không phải do Next.js “không chạy” hay sai origin.',
    '',
  ];
  if (serverMessage) {
    lines.push(`Phản hồi máy chủ: ${serverMessage}`, '');
  }
  lines.push(
    'Việc nên làm:',
    '- Trong .env (root app): đặt AI_SUPPORT_RUNNER_ENABLED=true rồi khởi động lại Next (npm run dev / next start).',
    '- Nếu .env có AI_SUPPORT_RUNNER_SECRET: nhập đúng giá trị đó vào Cấu hình (Runner secret) để gửi header x-internal-token.',
    '- Dev đơn giản: không đặt AI_SUPPORT_RUNNER_SECRET trong .env — không cần nhập ô Runner secret (INTERNAL_TOKEN không dùng cho /run).',
  );
  return lines;
}
