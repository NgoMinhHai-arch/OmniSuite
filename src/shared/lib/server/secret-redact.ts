/**
 * Redact secrets from strings before logging or returning to clients.
 * Patterns aligned with scripts/lib/security-patterns.js
 */

const SECRET_ASSIGNMENT =
  /(INTERNAL_TOKEN|NEXTAUTH_SECRET|SERPAPI_KEY|TAVILY_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|GROQ_API_KEY|LLM_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|OPENROUTER_API_KEY|DEEPSEEK_API_KEY|AI_SUPPORT_RUNNER_SECRET|OMNISUITE_INSTALL_SECRET|OMNISUITE_OWNER_KEY|api_key|apiKey)\s*[:=]\s*["']?([^\s"'`]{6,})/gi;

const TOKEN_PATTERNS = [
  /\bsk-[A-Za-z0-9]{12,}\b/g,
  /\bsk-or-v1-[A-Za-z0-9]{12,}\b/g,
  /\bgsk_[A-Za-z0-9]{12,}\b/g,
  /\bAIza[0-9A-Za-z\-_]{12,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{12,}\b/g,
  /\bsk-ant-[A-Za-z0-9\-_]{12,}\b/g,
  /api_key=[A-Za-z0-9\-_]{8,}/gi,
];

export function redactSecrets(input: string): string {
  if (!input) return input;
  let out = input;
  out = out.replace(SECRET_ASSIGNMENT, (_, name) => `${name}=[REDACTED]`);
  for (const re of TOKEN_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
    re.lastIndex = 0;
  }
  return out;
}

export function safeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  return redactSecrets(raw);
}
