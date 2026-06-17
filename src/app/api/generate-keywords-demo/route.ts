import { NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { getPythonEngineUrl } from '@/shared/lib/python-engine-url';
import { internalTokenHeaders } from '@/shared/lib/server/internal-token';
import {
  parsePythonJsonOrThrow,
  pythonBridgeErrorResponse,
} from '@/shared/lib/server/python-bridge';

export const maxDuration = 300;

function normalizeKeywordProvider(provider: unknown): string {
  const value = String(provider || 'google').trim().toLowerCase();
  if (value === 'gemini') return 'google';
  if (value === 'anthropic') return 'claude';
  if (value === 'ninerouter') return '9router';
  return value || 'google';
}

export async function POST(req: Request) {
  const pythonEngineUrl = getPythonEngineUrl();
  try {
    const body = await req.json();
    const { seedKeyword, provider, model, mode, keywordList, ranks, disableAI, enable_cpc } = body;
    const normalizedProvider = normalizeKeywordProvider(provider);

    const response = await fetch(`${pythonEngineUrl}/api/keywords/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalTokenHeaders(),
      },
      body: JSON.stringify({
        seed_keyword: seedKeyword,
        mode: mode || 'FULL',
        keyword_list: keywordList,
        ranks,
        provider: normalizedProvider,
        model,
        disable_ai: disableAI === true,
        enable_cpc: enable_cpc === true,
        api_keys: body.apiKeys || {},
      }),
    });

    const data = await parsePythonJsonOrThrow<any[]>(response, pythonEngineUrl);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const item of data) {
          controller.enqueue(encoder.encode(JSON.stringify(item) + '\n'));
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: unknown) {
    logger.error(`Next.js API Error (Keywords Demo): ${error instanceof Error ? error.message : String(error)}`);
    return pythonBridgeErrorResponse(error, pythonEngineUrl);
  }
}
