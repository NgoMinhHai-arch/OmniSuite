import { NextResponse } from 'next/server';
import { getPythonEngineUrl } from '@/shared/lib/python-engine-url';
import { logger } from '@/shared/lib/logger';
import { internalTokenHeaders } from '@/shared/lib/server/internal-token';
import {
  parsePythonJsonOrThrow,
  pythonBridgeErrorResponse,
} from '@/shared/lib/server/python-bridge';

export async function POST(req: Request) {
  const engine = getPythonEngineUrl();
  try {
    const { keyword, url } = await req.json();
    if (!keyword) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const response = await fetch(`${engine}/api/seo/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalTokenHeaders(),
      },
      body: JSON.stringify({ url, keyword }),
    });

    const data = await parsePythonJsonOrThrow(response, engine);
    return NextResponse.json({ audit: data });
  } catch (error: unknown) {
    logger.error(`Audit API Error (density): ${error instanceof Error ? error.message : String(error)}`);
    return pythonBridgeErrorResponse(error, engine);
  }
}
