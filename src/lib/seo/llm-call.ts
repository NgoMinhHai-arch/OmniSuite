/* Centralised multi-provider LLM helper for SEO tools (server-side). */

import { getSystemConfig } from "@/shared/lib/config";
import {
  defaultOllamaTimeoutMs,
  ollamaOpenAiV1Base,
  readOllamaKeepAlive,
  readOllamaNumCtx,
  withOllamaInferenceLock,
} from "@/shared/lib/ollama";
import { uiProviderLabelToLlmSlug } from "@/shared/lib/llm-default-provider";

export type LlmProvider =
  | "openai"
  | "gemini"
  | "google"
  | "claude"
  | "groq"
  | "deepseek"
  | "openrouter"
  | "ollama";

export interface LlmKeys {
  openai_api_key?: string;
  gemini_api_key?: string;
  claude_api_key?: string;
  groq_api_key?: string;
  deepseek_api_key?: string;
  openrouter_api_key?: string;
  ollama_base_url?: string;
  ollama_api_key?: string;
}

export interface LlmRequest {
  provider?: string;
  model?: string;
  /** Nhãn Cấu hình (vd. Gemini) hoặc slug — dùng khi auto-chọn provider theo thứ tự ưu tiên. */
  preferredProvider?: string;
  apiKey?: string;
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
}

export interface LlmResult {
  text: string;
  provider: string;
  model: string;
}

const DEFAULT_TIMEOUT = 60_000;

const FALLBACK_MODEL: Record<LlmProvider, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-1.5-flash",
  google: "gemini-1.5-flash",
  claude: "claude-3-5-sonnet-latest",
  groq: "llama-3.3-70b-versatile",
  deepseek: "deepseek-chat",
  openrouter: "openrouter/auto",
  ollama: "llama3.2",
};

/**
 * Danh sách model từ /api/list-models có tiền tố provider (groq/, anthropic/, …).
 * Các endpoint native (Groq OpenAI-compatible, Gemini generateContent, Anthropic messages)
 * cần id không có tiền tố đó.
 */
export function sanitizeModelForOutboundApi(provider: string, rawModel: string): string {
  let m = (rawModel || "").trim();
  if (!m) return m;
  const p = (provider || "").toLowerCase();

  if (p === "groq") {
    return m.replace(/^groq\//i, "");
  }
  if (p === "openai") {
    return m.replace(/^openai\//i, "");
  }
  if (p === "deepseek") {
    return m.replace(/^deepseek\//i, "");
  }
  if (p === "claude") {
    return m.replace(/^anthropic\//i, "");
  }
  if (p === "openrouter") {
    return m.replace(/^openrouter\//i, "");
  }
  if (p === "ollama") {
    return m.replace(/^ollama\//i, "");
  }
  if (p === "gemini" || p === "google") {
    return m
      .replace(/^models\//i, "")
      .replace(/^google\//i, "")
      .replace(/^gemini\//i, "");
  }
  return m;
}

function ollamaConfigured(
  keys: LlmKeys,
  sys: ReturnType<typeof getSystemConfig>,
  preferredSlug?: string | null
): boolean {
  if (
    keys.ollama_base_url?.trim() ||
    keys.ollama_api_key?.trim() ||
    sys.ollama_base_url?.trim() ||
    sys.ollama_api_key?.trim()
  ) {
    return true;
  }
  return (preferredSlug || "").trim().toLowerCase() === "ollama";
}

/**
 * Chọn provider đầu tiên có key. Ưu tiên `preferredSlug` (openai|gemini|…) nếu có key tương ứng,
 * rồi mới tới thứ tự mặc định — tránh luôn ăn OpenAI khi user đặt mặc định Gemini/Groq.
 */
export function pickProviderFromKeys(
  keys: LlmKeys,
  preferredLabelOrSlug?: string | null
): { provider: LlmProvider; apiKey: string } | null {
  const sys = getSystemConfig();
  const preferredSlug = preferredLabelOrSlug?.trim()
    ? uiProviderLabelToLlmSlug(preferredLabelOrSlug)
    : null;

  /** Ollama local / tunnel: không cần cloud key; ưu tiên khi user đặt mặc định Ollama. */
  if (preferredSlug === "ollama") {
    return { provider: "ollama", apiKey: keys.ollama_api_key?.trim() || sys.ollama_api_key?.trim() || "ollama" };
  }

  const tryOpenaiCompatible = (p: LlmProvider): { provider: LlmProvider; apiKey: string } | null => {
    if (p === "openai" && keys.openai_api_key?.trim()) return { provider: "openai", apiKey: keys.openai_api_key };
    if (p === "gemini" && keys.gemini_api_key?.trim()) return { provider: "gemini", apiKey: keys.gemini_api_key };
    if (p === "claude" && keys.claude_api_key?.trim()) return { provider: "claude", apiKey: keys.claude_api_key };
    if (p === "groq" && keys.groq_api_key?.trim()) return { provider: "groq", apiKey: keys.groq_api_key };
    if (p === "deepseek" && keys.deepseek_api_key?.trim()) return { provider: "deepseek", apiKey: keys.deepseek_api_key };
    if (p === "openrouter" && keys.openrouter_api_key?.trim())
      return { provider: "openrouter", apiKey: keys.openrouter_api_key };
    return null;
  };

  const baseOrder: LlmProvider[] = ["openai", "gemini", "claude", "groq", "deepseek", "openrouter"];
  const order: LlmProvider[] = [];
  if (preferredSlug && baseOrder.includes(preferredSlug as LlmProvider)) {
    order.push(preferredSlug as LlmProvider);
  }
  for (const p of baseOrder) {
    if (!order.includes(p)) order.push(p);
  }

  for (const p of order) {
    const hit = tryOpenaiCompatible(p);
    if (hit) return hit;
  }

  if (ollamaConfigured(keys, sys, preferredSlug)) {
    return { provider: "ollama", apiKey: keys.ollama_api_key?.trim() || sys.ollama_api_key?.trim() || "ollama" };
  }
  return null;
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(id) };
}

export async function callLlm(req: LlmRequest, fallbackKeys: LlmKeys = {}): Promise<LlmResult> {
  const sysCfg = getSystemConfig();
  let providerLower = (req.provider || "").toLowerCase() as LlmProvider;
  let apiKey = req.apiKey || "";

  if (!apiKey) {
    const pickedKey =
      providerLower === "openai" ? fallbackKeys.openai_api_key :
      providerLower === "gemini" || providerLower === "google" ? fallbackKeys.gemini_api_key :
      providerLower === "claude" ? fallbackKeys.claude_api_key :
      providerLower === "groq" ? fallbackKeys.groq_api_key :
      providerLower === "deepseek" ? fallbackKeys.deepseek_api_key :
      providerLower === "openrouter" ? fallbackKeys.openrouter_api_key :
      providerLower === "ollama" ? fallbackKeys.ollama_api_key || sysCfg.ollama_api_key || "ollama" :
      "";
    if (pickedKey) apiKey = pickedKey;
  }

  if (!apiKey && providerLower !== "ollama") {
    const auto = pickProviderFromKeys(fallbackKeys, req.preferredProvider);
    if (!auto) {
      throw new Error("Chưa có API key cho bất kỳ LLM nào. Hãy mở Cấu hình hệ thống và thêm OpenAI/Gemini/Claude/Groq/DeepSeek/OpenRouter, hoặc cấu hình Ollama (URL máy chủ).");
    }
    providerLower = auto.provider;
    apiKey = auto.apiKey;
  }

  if (providerLower === "ollama" && !apiKey) {
    apiKey = fallbackKeys.ollama_api_key?.trim() || sysCfg.ollama_api_key?.trim() || "ollama";
  }

  const provider = providerLower;
  if (!provider) {
    throw new Error("Thiếu provider LLM. Hãy chọn nhà cung cấp trong Cấu hình hoặc gửi provider trong request.");
  }
  const rawModel =
    req.model && req.model.trim() ? req.model.trim() : FALLBACK_MODEL[provider as LlmProvider] || "gpt-4o-mini";
  let model = sanitizeModelForOutboundApi(provider, rawModel);
  if (!model) {
    model = sanitizeModelForOutboundApi(
      provider,
      FALLBACK_MODEL[provider as LlmProvider] || "gpt-4o-mini"
    );
  }
  const timeoutMs =
    req.timeoutMs ?? (provider === "ollama" ? defaultOllamaTimeoutMs() : DEFAULT_TIMEOUT);
  const temperature = req.temperature ?? 0.4;
  const maxTokens = req.maxTokens ?? 2000;

  let url = "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: Record<string, unknown> = {};

  if (provider === "google" || provider === "gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    body = {
      contents: [
        {
          parts: [{ text: req.system ? `${req.system}\n\n${req.prompt}` : req.prompt }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        ...(req.jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    };
  } else if (provider === "claude") {
    url = "https://api.anthropic.com/v1/messages";
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model,
      messages: [{ role: "user", content: req.prompt }],
      ...(req.system ? { system: req.system } : {}),
      temperature,
      max_tokens: maxTokens,
    };
  } else {
    let ollamaOriginSource: string | undefined;
    if (provider === "ollama") {
      ollamaOriginSource =
        fallbackKeys.ollama_base_url?.trim() || sysCfg.ollama_base_url?.trim() || undefined;
      url = `${ollamaOpenAiV1Base(ollamaOriginSource)}/chat/completions`;
    } else if (provider === "openai") url = "https://api.openai.com/v1/chat/completions";
    else if (provider === "deepseek") url = "https://api.deepseek.com/v1/chat/completions";
    else if (provider === "groq") url = "https://api.groq.com/openai/v1/chat/completions";
    else if (provider === "openrouter") url = "https://openrouter.ai/api/v1/chat/completions";
    else url = "https://api.openai.com/v1/chat/completions";

    headers["Authorization"] = `Bearer ${apiKey}`;
    body = {
      model,
      messages: [
        ...(req.system ? [{ role: "system", content: req.system }] : []),
        { role: "user", content: req.prompt },
      ],
      temperature,
      max_tokens: maxTokens,
      ...(req.jsonMode ? { response_format: { type: "json_object" } } : {}),
      ...(provider === "ollama"
        ? (() => {
            const numCtx = readOllamaNumCtx();
            return {
              keep_alive: readOllamaKeepAlive(),
              // Ollama OpenAI-compat passthrough: cả root + options để chắc ăn.
              ...(numCtx > 0 ? { options: { num_ctx: numCtx }, num_ctx: numCtx } : {}),
            };
          })()
        : {}),
    };
  }

  const t = withTimeout(timeoutMs);
  let resp: Response;
  try {
    const doFetch = () =>
      fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: t.signal,
        cache: "no-store",
      });
    resp =
      provider === "ollama"
        ? await withOllamaInferenceLock(doFetch, {
            origin:
              fallbackKeys.ollama_base_url?.trim() ||
              sysCfg.ollama_base_url?.trim() ||
              undefined,
          })
        : await doFetch();
  } catch (e) {
    t.cancel();
    const msg = e instanceof Error ? e.message : "LLM request failed";
    throw new Error(`Không gọi được LLM (${provider}): ${msg}`);
  }
  t.cancel();

  const data = await resp.json().catch(() => null) as Record<string, unknown> | null;
  if (!resp.ok || !data) {
    const errMsg =
      (data as { error?: { message?: string } } | null)?.error?.message ||
      `LLM HTTP ${resp.status}`;
    throw new Error(`LLM (${provider}/${model}) lỗi: ${errMsg}`);
  }

  let text = "";
  if (provider === "google" || provider === "gemini") {
    const candidates = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
    text = candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } else if (provider === "claude") {
    const content = (data as { content?: Array<{ text?: string }> }).content;
    text = content?.[0]?.text ?? "";
  } else {
    const choices = (data as { choices?: Array<{ message?: { content?: string } }> }).choices;
    text = choices?.[0]?.message?.content ?? "";
  }

  return { text: text || "", provider, model };
}

export function tryParseJson<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const objMatch = candidate.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]) as T;
      } catch {
        return null;
      }
    }
    const arrMatch = candidate.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        return JSON.parse(arrMatch[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
