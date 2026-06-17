import { NextResponse } from 'next/server';
import { getPythonEngineUrl } from '@/shared/lib/python-engine-url';
import { logger } from '@/shared/lib/logger';
import { internalTokenHeaders } from '@/shared/lib/server/internal-token';
import {
  parsePythonJsonOrThrow,
  pythonBridgeErrorResponse,
} from '@/shared/lib/server/python-bridge';

function normalizeKeywordProvider(provider: unknown): string {
  const value = String(provider || 'google').trim().toLowerCase();
  if (value === 'gemini') return 'google';
  if (value === 'anthropic') return 'claude';
  if (value === 'ninerouter') return '9router';
  return value || 'google';
}

export async function POST(req: Request) {
  const engine = getPythonEngineUrl();
  try {
    const { seeds, provider, apiKeys, model } = await req.json();
    if (!seeds || !Array.isArray(seeds)) {
      return NextResponse.json({ error: 'Invalid seeds provided' }, { status: 400 });
    }

    const response = await fetch(`${engine}/api/keywords/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalTokenHeaders(),
      },
      body: JSON.stringify({
        seed_keyword: seeds[0] ?? '',
        keyword_list: seeds,
        provider: normalizeKeywordProvider(provider),
        model: model || undefined,
        api_keys: apiKeys || {},
        mode: 'ANALYZE',
      }),
    });

    const data = await parsePythonJsonOrThrow(response, engine);
    return NextResponse.json(data);
  } catch (error: unknown) {
    logger.error(`SEO API Error (bulk-data): ${error instanceof Error ? error.message : String(error)}`);
    return pythonBridgeErrorResponse(error, engine);
  }
}
