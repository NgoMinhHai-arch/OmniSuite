import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { getSystemConfig } from './config';
import { ollamaOpenAiV1Base } from './ollama';
import { nineRouterOpenAiV1Base } from './ninerouter';

export function getAIModel(provider: string, apiKey: string, modelName: string, customBaseUrl?: string) {
  const system = getSystemConfig();
  let finalKey = apiKey;

  // Fallback to system env if user key is missing
  if (!finalKey) {
    const p = provider.toLowerCase();
    if (p === 'openai') finalKey = system.openai_api_key || '';
    else if (p === 'gemini' || p === 'google') finalKey = system.gemini_api_key || '';
    else if (p === 'claude' || p === 'anthropic') finalKey = system.claude_api_key || '';
    else if (p === 'groq') finalKey = system.groq_api_key || '';
    else if (p === 'deepseek') finalKey = system.deepseek_api_key || '';
    else if (p === 'openrouter') finalKey = system.openrouter_api_key || '';
    else if (p === 'ollama')
      finalKey = (system.ollama_api_key || '').trim() || 'ollama';
    else if (p === '9router' || p === 'ninerouter')
      finalKey = (system.ninerouter_api_key || '').trim() || '9router';
  }

  if (!finalKey) throw new Error(`API Key for ${provider} is required but missing.`);
  if (!modelName) throw new Error("Model Name is required");

  // Xử lý tiền tố nếu có (do list-models thêm vào để phân biệt)
  // Ví dụ: "openrouter/anthropic/claude-3" -> "anthropic/claude-3"
  //       "groq/llama3-8b" -> "llama3-8b"
  let cleanModelName = modelName;
  const prefixes = ['openrouter/', 'groq/', 'anthropic/', 'google/', 'gemini/', 'ollama/', '9router/'];
  for (const p of prefixes) {
    if (cleanModelName.startsWith(p)) {
      cleanModelName = cleanModelName.slice(p.length);
      break;
    }
  }

  switch (provider.toLowerCase()) {
    case 'openai':
      const openai = createOpenAI({ apiKey: finalKey });
      return openai(cleanModelName);
    case 'claude':
    case 'anthropic':
      const anthropic = createAnthropic({ apiKey: finalKey });
      return anthropic(cleanModelName);
    case 'gemini':
    case 'google':
      const google = createGoogleGenerativeAI({ apiKey: finalKey });
      return google(cleanModelName);
    case 'groq':
      const groq = createGroq({ apiKey: finalKey });
      return groq(cleanModelName);
    case 'deepseek':
      const deepseek = createOpenAI({ 
        baseURL: 'https://api.deepseek.com/v1',
        apiKey: finalKey 
      });
      return deepseek.chat(cleanModelName);
    case 'openrouter':
      const openrouter = createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: finalKey,
        headers: {
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'OmniSuite AI',
        }
      });
      return openrouter.chat(cleanModelName);
    case 'ollama': {
      const base = ollamaOpenAiV1Base(customBaseUrl?.trim() || system.ollama_base_url);
      const ollama = createOpenAI({ baseURL: base, apiKey: finalKey });
      return ollama.chat(cleanModelName);
    }
    case '9router':
    case 'ninerouter': {
      const base = nineRouterOpenAiV1Base(customBaseUrl?.trim() || system.ninerouter_base_url);
      const router = createOpenAI({ baseURL: base, apiKey: finalKey });
      return router.chat(cleanModelName);
    }
    case 'custom':
      if (!customBaseUrl) throw new Error("Custom Base URL is required for Custom provider");
      const custom = createOpenAI({ baseURL: customBaseUrl, apiKey: finalKey });
      return custom.chat(cleanModelName);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
