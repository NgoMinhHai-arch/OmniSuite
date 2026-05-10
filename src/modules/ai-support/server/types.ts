import type { LlmKeys } from '@/lib/seo/llm-call';
import { getSystemConfig } from '@/shared/lib/config';

export interface ClientKeys {
  openai_api_key?: string;
  gemini_api_key?: string;
  claude_api_key?: string;
  groq_api_key?: string;
  deepseek_api_key?: string;
  openrouter_api_key?: string;
  ollama_base_url?: string;
  ollama_api_key?: string;
  /** Tavily — Quản gia có thể tìm web khi có key (Cấu hình hoặc .env). */
  tavily_api_key?: string;
  /** SerpAPI — fallback tìm web cho Quản gia. */
  serpapi_key?: string;
}

export interface AiSupportLlmParams {
  provider?: string;
  model?: string;
  keys?: ClientKeys;
}

export function buildKeys(client?: ClientKeys): LlmKeys {
  const sys = getSystemConfig();
  return {
    openai_api_key: client?.openai_api_key || sys.openai_api_key,
    gemini_api_key: client?.gemini_api_key || sys.gemini_api_key,
    claude_api_key: client?.claude_api_key || sys.claude_api_key,
    groq_api_key: client?.groq_api_key || sys.groq_api_key,
    deepseek_api_key: client?.deepseek_api_key || sys.deepseek_api_key,
    openrouter_api_key: client?.openrouter_api_key || sys.openrouter_api_key,
    ollama_base_url: client?.ollama_base_url || sys.ollama_base_url,
    ollama_api_key: client?.ollama_api_key || sys.ollama_api_key,
  };
}
