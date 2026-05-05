"use client";

const SETTINGS_KEY = "omnisuite_settings";

interface KeyBag {
  openai_api_key?: string;
  gemini_api_key?: string;
  claude_api_key?: string;
  groq_api_key?: string;
  deepseek_api_key?: string;
  openrouter_api_key?: string;
}

function readClientKeys(): KeyBag {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: KeyBag = {};
    (["openai_api_key", "gemini_api_key", "claude_api_key", "groq_api_key", "deepseek_api_key", "openrouter_api_key"] as const)
      .forEach((k) => {
        const v = parsed[k];
        if (typeof v === "string" && v.trim()) (out as Record<string, string>)[k] = v.trim();
      });
    return out;
  } catch {
    return {};
  }
}

export interface LlmRunOptions {
  system?: string;
  prompt: string;
  provider?: string;
  model?: string;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export async function runLlm(opts: LlmRunOptions): Promise<{ text: string; provider: string; model: string }> {
  const keys = readClientKeys();
  const resp = await fetch("/api/seo/llm-run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...opts, keys }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || "LLM lỗi");
  return data;
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
      try { return JSON.parse(objMatch[0]) as T; } catch { /* */ }
    }
    const arrMatch = candidate.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try { return JSON.parse(arrMatch[0]) as T; } catch { /* */ }
    }
    return null;
  }
}
