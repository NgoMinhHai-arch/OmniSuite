/**
 * Maps "Nhà cung cấp AI mặc định" (Cấu hình hệ thống) → slug dùng cho API LLM / Keywords.
 * `shouldExposeOllamaInUi` chỉ đọc localStorage — an toàn cho "use client".
 */

import { shouldExposeOllamaInUi } from "@/shared/lib/ollama";

/** Provider id dùng chung Keywords / AI Hỗ trợ (google = Gemini API). */
export function getDashboardLlmProviderFromSettings(parsed: Record<string, unknown>): string {
  const fromDefault = uiProviderLabelToKeywordsProviderId(
    typeof parsed.default_provider === "string" ? parsed.default_provider : undefined
  );
  const settingsKeyForLlm = fromDefault === "google" ? "gemini" : fromDefault;
  const apiKeyVal = parsed[`${settingsKeyForLlm}_api_key`];

  const defaultHasKey =
    fromDefault === "ollama"
      ? shouldExposeOllamaInUi(parsed)
      : typeof apiKeyVal === "string" && apiKeyVal.trim().length > 0;

  if (defaultHasKey) return fromDefault;

  const firstConnected = [
    { id: "google", key: parsed.gemini_api_key },
    { id: "openai", key: parsed.openai_api_key },
    { id: "groq", key: parsed.groq_api_key },
    { id: "claude", key: parsed.claude_api_key },
    { id: "deepseek", key: parsed.deepseek_api_key },
    { id: "openrouter", key: parsed.openrouter_api_key },
    {
      id: "ollama",
      key: parsed.ollama_base_url || parsed.ollama_api_key || (parsed.default_provider === "Ollama" ? "local" : ""),
    },
  ].find((p) => {
    const k = p.key;
    return typeof k === "string" ? k.trim().length > 0 : !!k;
  });

  return firstConnected?.id ?? "google";
}

export function uiProviderLabelToLlmSlug(label: string | undefined | null): string {
  const key = (label || "").trim();
  const map: Record<string, string> = {
    OpenAI: "openai",
    Gemini: "gemini",
    Claude: "claude",
    Groq: "groq",
    DeepSeek: "deepseek",
    OpenRouter: "openrouter",
    Ollama: "ollama",
  };
  if (map[key]) return map[key];
  const lower = key.toLowerCase();
  if (["openai", "gemini", "google", "claude", "groq", "deepseek", "openrouter", "ollama"].includes(lower)) {
    return lower === "google" ? "gemini" : lower;
  }
  return "gemini";
}

/** Trang Keywords dùng id `google` cho Gemini (khớp getLlmCredentialsFromSettings). */
export function uiProviderLabelToKeywordsProviderId(label: string | undefined | null): string {
  const key = (label || "Gemini").trim();
  const map: Record<string, string> = {
    Gemini: "google",
    OpenAI: "openai",
    Claude: "claude",
    Groq: "groq",
    DeepSeek: "deepseek",
    OpenRouter: "openrouter",
    Ollama: "ollama",
  };
  return map[key] || "google";
}
