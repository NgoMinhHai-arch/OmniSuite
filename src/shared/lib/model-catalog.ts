import { normalizeOllamaOrigin, ollamaOpenAiV1Base } from './ollama';

type ProviderName =
  | 'openai'
  | 'gemini'
  | 'google'
  | 'groq'
  | 'claude'
  | 'anthropic'
  | 'openrouter'
  | 'deepseek'
  | 'ollama'
  | 'custom';

export interface OpenRouterModelMeta {
  id: string;
  displayName: string;
  isFree: boolean;
  inputCostPer1M: number;
  outputCostPer1M: number;
  contextWindow: number;
  modality: string;
  category: 'balanced' | 'reasoning' | 'coding' | 'fast' | 'general';
}

type ModelIdItem = { id: string };
type GeminiModelItem = { name: string; supportedGenerationMethods?: string[] };

const DEFAULT_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4'],
  gemini: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'],
  google: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'],
  groq: ['groq/llama-3.3-70b-versatile', 'groq/llama-3.1-70b-versatile', 'groq/mixtral-8x7b-32768'],
  claude: [
    'anthropic/claude-3-7-sonnet-latest',
    'anthropic/claude-3-5-sonnet-latest',
    'anthropic/claude-3-5-haiku-latest',
    'anthropic/claude-3-opus-latest',
    'anthropic/claude-3-sonnet-20240229',
    'anthropic/claude-3-haiku-20240307'
  ],
  anthropic: [
    'anthropic/claude-3-7-sonnet-latest',
    'anthropic/claude-3-5-sonnet-latest',
    'anthropic/claude-3-5-haiku-latest',
    'anthropic/claude-3-opus-latest',
    'anthropic/claude-3-sonnet-20240229',
    'anthropic/claude-3-haiku-20240307'
  ],
  deepseek: ['deepseek-chat', 'deepseek-coder'],
  ollama: ['llama3.2', 'llama3.1', 'mistral', 'qwen2.5'],
};

const VISION_MODEL_HINTS: Record<string, string[]> = {
  google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  claude: ['claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'],
  anthropic: ['claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'],
  groq: [],
  deepseek: [],
  openrouter: [],
  ollama: [],
  custom: [],
};

function extractVersion(modelId: string): number {
  const match = modelId.match(/(\d+\.\d+)/);
  return match ? parseFloat(match[1]) : 0;
}

function getModelTier(modelId: string): number {
  const id = modelId.toLowerCase();
  if (id.includes('opus')) return 35;
  if (id.includes('pro')) return 30;
  if (id.includes('sonnet')) return 25;
  if (id.includes('turbo')) return 20;
  if (id.includes('flash')) return 15;
  if (id.includes('haiku') || id.includes('mini') || id.includes('lite')) return 10;
  return 5;
}

function sortModels(models: string[]) {
  return [...new Set(models)].sort((a, b) => {
    const versionDiff = extractVersion(b) - extractVersion(a);
    if (versionDiff !== 0) return versionDiff;
    return getModelTier(b) - getModelTier(a);
  });
}

function inferModelCategory(modelId: string): OpenRouterModelMeta['category'] {
  const id = modelId.toLowerCase();
  if (id.includes('coder') || id.includes('code') || id.includes('dev')) return 'coding';
  if (id.includes('reason') || id.includes('r1') || id.includes('thinking')) return 'reasoning';
  if (id.includes('flash') || id.includes('mini') || id.includes('haiku') || id.includes('fast')) return 'fast';
  if (id.includes('sonnet') || id.includes('pro') || id.includes('opus') || id.includes('gpt-4')) return 'balanced';
  return 'general';
}

export function normalizeProvider(provider?: string): ProviderName {
  const lower = (provider || '').trim().toLowerCase();
  if (lower === 'google') return 'gemini';
  if (lower === 'anthropic') return 'claude';
  if (lower === 'custom') return 'custom';
  if (lower === 'ollama') return 'ollama';
  if (lower === 'openai' || lower === 'gemini' || lower === 'groq' || lower === 'claude' || lower === 'openrouter' || lower === 'deepseek') {
    return lower;
  }
  return 'gemini';
}

export async function fetchModelsForProvider(params: {
  provider?: string;
  apiKey?: string;
  customBaseUrl?: string;
  strict?: boolean;
  includeProviderPrefix?: boolean;
}): Promise<string[]> {
  const provider = normalizeProvider(params.provider);
  const apiKey = params.apiKey?.trim() || '';
  const customBaseUrl = params.customBaseUrl?.trim();
  const strict = params.strict === true;
  const includeProviderPrefix = params.includeProviderPrefix !== false;

  const maybePrefix = (model: string) => {
    if (!includeProviderPrefix) {
      if (model.startsWith('groq/')) return model.slice('groq/'.length);
      if (model.startsWith('anthropic/')) return model.slice('anthropic/'.length);
      if (model.startsWith('openrouter/')) return model.slice('openrouter/'.length);
    }
    return model;
  };

  const normalizeModels = (models: string[]) => sortModels(models.map(maybePrefix));

  try {
    if (provider === 'openai') {
      if (!apiKey) return DEFAULT_MODELS.openai;
      const resp = await fetch(`${customBaseUrl || 'https://api.openai.com'}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'Failed to fetch OpenAI models');
      const models = ((data.data || []) as ModelIdItem[])
        .map((m) => m.id)
        .filter((id: string) => id.includes('gpt') || id.includes('o1') || id.includes('o3'));
      return normalizeModels(models.length > 0 ? models : DEFAULT_MODELS.openai);
    }

    if (provider === 'gemini') {
      if (!apiKey) return DEFAULT_MODELS.gemini;
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'Failed to fetch Gemini models');
      const models = ((data.models || []) as GeminiModelItem[])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace('models/', ''))
        .filter((name: string) => name.includes('gemini'));
      return normalizeModels(models.length > 0 ? models : DEFAULT_MODELS.gemini);
    }

    if (provider === 'groq') {
      if (!apiKey) return DEFAULT_MODELS.groq;
      const resp = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'Failed to fetch Groq models');
      const models = ((data.data || []) as ModelIdItem[]).map((m) => `groq/${m.id}`);
      return normalizeModels(models.length > 0 ? models : DEFAULT_MODELS.groq);
    }

    if (provider === 'claude') {
      return normalizeModels(DEFAULT_MODELS.claude);
    }

    if (provider === 'openrouter') {
      if (!apiKey) return [];
      const resp = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'OmniSuite AI'
        }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'OpenRouter connection failed');
      const models = ((data.data || []) as ModelIdItem[]).map((m) => `openrouter/${m.id}`);
      return normalizeModels(models);
    }

    if (provider === 'deepseek') {
      if (!apiKey) return DEFAULT_MODELS.deepseek;
      const resp = await fetch('https://api.deepseek.com/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'Failed to fetch DeepSeek models');
      const models = ((data.data || []) as ModelIdItem[]).map((m) => m.id);
      return normalizeModels(models.length > 0 ? models : DEFAULT_MODELS.deepseek);
    }

    if (provider === 'ollama') {
      const origin = normalizeOllamaOrigin(customBaseUrl);
      const requestHeaders: Record<string, string> = { Accept: 'application/json' };
      if (apiKey && apiKey.trim()) {
        requestHeaders.Authorization = `Bearer ${apiKey.trim()}`;
      }

      let resp: Response;
      try {
        resp = await fetch(`${origin}/api/tags`, {
          cache: 'no-store',
          headers: requestHeaders,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Không kết nối được Ollama tại ${origin}. ` +
          `Nếu bạn đang dùng Cloudflare Tunnel, hãy kiểm tra tunnel còn chạy. (${message})`
        );
      }

      // Some tunnels/proxies only expose OpenAI-compatible routes (/v1/*).
      if (!resp.ok && [401, 403, 404].includes(resp.status)) {
        const v1 = ollamaOpenAiV1Base(origin);
        try {
          const v1Resp = await fetch(`${v1}/models`, {
            cache: 'no-store',
            headers: requestHeaders,
          });
          const v1Data = await v1Resp.json().catch(() => ({}));
          if (v1Resp.ok) {
            const v1Models = ((v1Data as { data?: Array<{ id?: string }> }).data || [])
              .map((m) => m.id || '')
              .filter(Boolean);
            return normalizeModels(v1Models.length > 0 ? v1Models : DEFAULT_MODELS.ollama);
          }
        } catch {
          // Continue to detailed error below.
        }
      }

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const detail = (data as { error?: string }).error || `Ollama HTTP ${resp.status}`;
        throw new Error(
          `Ollama trả lỗi khi lấy danh sách model: ${detail}. ` +
          `Cloudflare Tunnel có thể đang chặn /api/tags; thử nhập OLLAMA_API_KEY (nếu có auth) hoặc kiểm tra endpoint có mở /v1/models.`
        );
      }
      const tagged = ((data as { models?: Array<{ name?: string; model?: string }> }).models || [])
        .map((m) => m.name || m.model || '')
        .filter(Boolean);
      return normalizeModels(tagged.length > 0 ? tagged : DEFAULT_MODELS.ollama);
    }

    if (provider === 'custom') {
      if (!apiKey || !customBaseUrl) return [];
      const resp = await fetch(`${customBaseUrl.replace(/\/$/, '')}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'Failed to fetch custom models');
      return normalizeModels(((data.data || []) as ModelIdItem[]).map((m) => m.id));
    }

    return [];
  } catch (error) {
    if (strict) throw error;
    const fallback = DEFAULT_MODELS[provider] || [];
    return normalizeModels(fallback);
  }
}

export async function fetchOpenRouterModelCatalog(apiKey: string): Promise<OpenRouterModelMeta[]> {
  if (!apiKey?.trim()) return [];

  const resp = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'OmniSuite AI',
    },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error?.message || 'OpenRouter connection failed');
  }

  const models = (data.data || []) as Array<{
    id?: string;
    name?: string;
    architecture?: { modality?: string };
    context_length?: number;
    pricing?: { prompt?: string; completion?: string };
  }>;

  return models
    .filter((m) => Boolean(m.id))
    .map((m) => {
      const inputPerToken = Number(m.pricing?.prompt || 0);
      const outputPerToken = Number(m.pricing?.completion || 0);
      const inputCostPer1M = Number.isFinite(inputPerToken) ? inputPerToken * 1_000_000 : 0;
      const outputCostPer1M = Number.isFinite(outputPerToken) ? outputPerToken * 1_000_000 : 0;
      const id = `openrouter/${m.id as string}`;
      const modality = m.architecture?.modality || 'text->text';

      return {
        id,
        displayName: m.name || (m.id as string),
        isFree: inputCostPer1M === 0 && outputCostPer1M === 0,
        inputCostPer1M,
        outputCostPer1M,
        contextWindow: Number(m.context_length || 0),
        modality,
        category: inferModelCategory(m.id as string),
      };
    })
    .sort((a, b) => {
      if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      if (a.inputCostPer1M !== b.inputCostPer1M) return a.inputCostPer1M - b.inputCostPer1M;
      return b.contextWindow - a.contextWindow;
    });
}

export function filterVisionModels(provider: string | undefined, models: string[]) {
  const normalized = normalizeProvider(provider);
  const hints = VISION_MODEL_HINTS[normalized] || [];
  if (hints.length === 0) return models;

  const filtered = models.filter((model) =>
    hints.some((hint) => model.toLowerCase().includes(hint.toLowerCase()))
  );

  return filtered.length > 0 ? filtered : models;
}
