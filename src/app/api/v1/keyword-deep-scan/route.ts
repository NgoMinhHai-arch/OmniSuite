import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { getPythonEngineUrl } from '@/shared/lib/python-engine-url';
import { internalTokenHeaders } from '@/shared/lib/server/internal-token';
import {
  parsePythonJsonOrThrow,
  pythonBridgeErrorResponse,
} from '@/shared/lib/server/python-bridge';

export async function POST(req: NextRequest) {
  const pythonEngineUrl = getPythonEngineUrl();
  try {
    const { keyword } = await req.json();

    if (!keyword) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    const response = await fetch(`${pythonEngineUrl}/api/keywords/deep-scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalTokenHeaders(),
      },
      body: JSON.stringify({ keyword }),
    });

    const data = await parsePythonJsonOrThrow(response, pythonEngineUrl);
    return NextResponse.json(data);
  } catch (error: unknown) {
    logger.error(`Next.js API Error (Keyword Deep Scan): ${error instanceof Error ? error.message : String(error)}`);
    return pythonBridgeErrorResponse(error, pythonEngineUrl);
  }
}
