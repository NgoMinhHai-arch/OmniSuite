type ProviderName =
  | 'openai'
  | 'gemini'
  | 'google'
  | 'groq'
  | 'claude'
  | 'anthropic'
  | 'openrouter'
  | 'deepseek'
  | 'custom';

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

export function normalizeProvider(provider?: string): ProviderName {
  const lower = (provider || '').trim().toLowerCase();
  if (lower === 'google') return 'gemini';
  if (lower === 'anthropic') return 'claude';
  if (lower === 'custom') return 'custom';
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
      const models = (data.data || [])
        .map((m: any) => m.id)
        .filter((id: string) => id.includes('gpt') || id.includes('o1') || id.includes('o3'));
      return normalizeModels(models.length > 0 ? models : DEFAULT_MODELS.openai);
    }

    if (provider === 'gemini') {
      if (!apiKey) return DEFAULT_MODELS.gemini;
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'Failed to fetch Gemini models');
      const models = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', ''))
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
      const models = (data.data || []).map((m: any) => `groq/${m.id}`);
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
      const models = (data.data || []).map((m: any) => `openrouter/${m.id}`);
      return normalizeModels(models);
    }

    if (provider === 'deepseek') {
      if (!apiKey) return DEFAULT_MODELS.deepseek;
      const resp = await fetch('https://api.deepseek.com/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'Failed to fetch DeepSeek models');
      const models = (data.data || []).map((m: any) => m.id);
      return normalizeModels(models.length > 0 ? models : DEFAULT_MODELS.deepseek);
    }

    if (provider === 'custom') {
      if (!apiKey || !customBaseUrl) return [];
      const resp = await fetch(`${customBaseUrl.replace(/\/$/, '')}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'Failed to fetch custom models');
      return normalizeModels((data.data || []).map((m: any) => m.id));
    }

    return [];
  } catch (error) {
    if (strict) throw error;
    const fallback = DEFAULT_MODELS[provider] || [];
    return normalizeModels(fallback);
  }
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
