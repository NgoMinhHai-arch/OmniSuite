/** Shared 9Router (OpenAI-compatible /v1) URL helpers — https://github.com/decolua/9router */

/** Default dashboard/API port per 9Router docs. Prefer 127.0.0.1 over localhost (IPv6). */
export const DEFAULT_NINEROUTER_ORIGIN = "http://127.0.0.1:20128";

/**
 * Normalize user-pasted 9Router URL to origin (no trailing /v1):
 * - `http://127.0.0.1:20128`
 * - `http://localhost:20128/v1/chat/completions` (common paste mistake)
 */
export function normalizeNineRouterOrigin(input?: string | null): string {
  let raw = (input || "").trim();
  if (!raw) return DEFAULT_NINEROUTER_ORIGIN;

  raw = raw.replace(/\/+$/, "");
  raw = raw
    .replace(/\/v1\/chat\/completions$/i, "")
    .replace(/\/v1\/models$/i, "")
    .replace(/\/v1$/i, "")
    .replace(/\/dashboard$/i, "");

  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}` || DEFAULT_NINEROUTER_ORIGIN;
  } catch {
    return raw || DEFAULT_NINEROUTER_ORIGIN;
  }
}

/** Base URL for OpenAI SDK / chat completions: `{origin}/v1`. */
export function nineRouterOpenAiV1Base(input?: string | null): string {
  return `${normalizeNineRouterOrigin(input)}/v1`;
}

export function shouldExposeNineRouterInUi(settings: Record<string, unknown>): boolean {
  const url = String(settings.ninerouter_base_url ?? "").trim();
  const key = String(settings.ninerouter_api_key ?? "").trim();
  const def = String(settings.default_provider ?? "").trim();
  return !!(url || key || def === "9Router");
}
