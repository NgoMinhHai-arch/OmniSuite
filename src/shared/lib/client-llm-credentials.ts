import { DEFAULT_OLLAMA_ORIGIN } from "@/shared/lib/ollama";
import { DEFAULT_NINEROUTER_ORIGIN } from "@/shared/lib/ninerouter";

/** Browser settings bag (localStorage `omnisuite_settings`) → API key + optional OpenAI-compatible base (Ollama). */
export function getLlmCredentialsFromSettings(
  provider: string,
  settings: Record<string, string | undefined>
): { apiKey: string; customBaseUrl?: string } {
  const p = (provider || "").toLowerCase();
  if (p === "ollama") {
    return {
      apiKey: (settings.ollama_api_key || "").trim() || "ollama",
      customBaseUrl: (settings.ollama_base_url || "").trim() || DEFAULT_OLLAMA_ORIGIN,
    };
  }
  if (p === "9router" || p === "ninerouter") {
    return {
      apiKey: (settings.ninerouter_api_key || "").trim() || "9router",
      customBaseUrl: (settings.ninerouter_base_url || "").trim() || DEFAULT_NINEROUTER_ORIGIN,
    };
  }
  const keyField = p === "google" ? "gemini" : p;
  return { apiKey: (settings[`${keyField}_api_key`] || "").trim() };
}
