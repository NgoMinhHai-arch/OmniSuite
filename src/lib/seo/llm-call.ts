/* Centralised multi-provider LLM helper for SEO tools (server-side). */

export type LlmProvider =
  | "openai"
  | "gemini"
  | "google"
  | "claude"
  | "groq"
  | "deepseek"
  | "openrouter";

export interface LlmKeys {
  openai_api_key?: string;
  gemini_api_key?: string;
  claude_api_key?: string;
  groq_api_key?: string;
  deepseek_api_key?: string;
  openrouter_api_key?: string;
}

export interface LlmRequest {
  provider?: string;
  model?: string;
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
};

export function pickProviderFromKeys(keys: LlmKeys): { provider: LlmProvider; apiKey: string } | null {
  if (keys.openai_api_key) return { provider: "openai", apiKey: keys.openai_api_key };
  if (keys.gemini_api_key) return { provider: "gemini", apiKey: keys.gemini_api_key };
  if (keys.claude_api_key) return { provider: "claude", apiKey: keys.claude_api_key };
  if (keys.groq_api_key) return { provider: "groq", apiKey: keys.groq_api_key };
  if (keys.deepseek_api_key) return { provider: "deepseek", apiKey: keys.deepseek_api_key };
  if (keys.openrouter_api_key) return { provider: "openrouter", apiKey: keys.openrouter_api_key };
  return null;
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(id) };
}

export async function callLlm(req: LlmRequest, fallbackKeys: LlmKeys = {}): Promise<LlmResult> {
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
      "";
    if (pickedKey) apiKey = pickedKey;
  }

  if (!apiKey) {
    const auto = pickProviderFromKeys(fallbackKeys);
    if (!auto) {
      throw new Error("Chưa có API key cho bất kỳ LLM nào. Hãy mở Cấu hình hệ thống và thêm OpenAI/Gemini/Claude/Groq/DeepSeek/OpenRouter.");
    }
    providerLower = auto.provider;
    apiKey = auto.apiKey;
  }

  const provider = providerLower || "openai";
  const model = req.model && req.model.trim() ? req.model.trim() : FALLBACK_MODEL[provider as LlmProvider] || "gpt-4o-mini";
  const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT;
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
    if (provider === "openai") url = "https://api.openai.com/v1/chat/completions";
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
    };
  }

  const t = withTimeout(timeoutMs);
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: t.signal,
      cache: "no-store",
    });
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
