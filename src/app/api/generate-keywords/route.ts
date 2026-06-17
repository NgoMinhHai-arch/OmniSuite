import { NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { getPythonEngineUrl } from '@/shared/lib/python-engine-url';
import { internalTokenHeaders } from '@/shared/lib/server/internal-token';
import {
  parsePythonJsonOrThrow,
  pythonBridgeErrorResponse,
} from '@/shared/lib/server/python-bridge';

export const maxDuration = 60;

function normalizeKeywordProvider(provider: unknown): string {
  const value = String(provider || 'google').trim().toLowerCase();
  if (value === 'gemini') return 'google';
  if (value === 'anthropic') return 'claude';
  if (value === 'ninerouter') return '9router';
  return value || 'google';
}

function buildKeywordApiKeys(provider: string, apiKey: string, bodyApiKeys: unknown) {
  if (bodyApiKeys && typeof bodyApiKeys === 'object' && !Array.isArray(bodyApiKeys)) {
    return bodyApiKeys;
  }
  if (!apiKey) return {};

  const normalizedProvider = normalizeKeywordProvider(provider);
  return {
    openai: normalizedProvider === 'openai' ? apiKey : '',
    gemini: normalizedProvider === 'google' ? apiKey : '',
    groq: normalizedProvider === 'groq' ? apiKey : '',
    claude: normalizedProvider === 'claude' ? apiKey : '',
    deepseek: normalizedProvider === 'deepseek' ? apiKey : '',
    openrouter: normalizedProvider === 'openrouter' ? apiKey : '',
    ollama: normalizedProvider === 'ollama' ? apiKey : '',
    ninerouter: normalizedProvider === '9router' ? apiKey : '',
  };
}

export async function POST(req: Request) {
  const pythonEngineUrl = getPythonEngineUrl();
  try {
    const body = await req.json();
    const { seedKeyword, provider = '', modelName = '', apiKey = '' } = body;

    if (!seedKeyword) {
      return NextResponse.json({ error: 'Seed keyword is required' }, { status: 400 });
    }

    const normalizedProvider = normalizeKeywordProvider(provider);
    const response = await fetch(`${pythonEngineUrl}/api/keywords/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalTokenHeaders(),
      },
      body: JSON.stringify({
        seed_keyword: seedKeyword,
        mode: 'FULL',
        provider: normalizedProvider,
        model: modelName,
        api_keys: buildKeywordApiKeys(normalizedProvider, apiKey, body.apiKeys),
      }),
    });

    const keywords = await parsePythonJsonOrThrow(response, pythonEngineUrl);
    return NextResponse.json({ keywords });
  } catch (error: unknown) {
    logger.error(`Keyword Gen Error: ${error instanceof Error ? error.message : String(error)}`);
    return pythonBridgeErrorResponse(error, pythonEngineUrl);
  }
}
