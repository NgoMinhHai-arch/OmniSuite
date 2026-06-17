import { NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { getPythonEngineUrl } from '@/shared/lib/python-engine-url';
import { internalTokenHeaders } from '@/shared/lib/server/internal-token';
import {
  parsePythonJsonOrThrow,
  pythonBridgeErrorResponse,
} from '@/shared/lib/server/python-bridge';

export async function POST(req: Request) {
  const pythonEngineUrl = getPythonEngineUrl();
  try {
    const body = await req.json();
    const response = await fetch(`${pythonEngineUrl}/api/seo/improve-schema`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalTokenHeaders(),
      },
      body: JSON.stringify(body),
    });

    const data = await parsePythonJsonOrThrow(response, pythonEngineUrl);
    return NextResponse.json(data);
  } catch (error: unknown) {
    logger.error(`[Improve Schema API] Error: ${error instanceof Error ? error.message : String(error)}`);
    return pythonBridgeErrorResponse(error, pythonEngineUrl);
  }
}
