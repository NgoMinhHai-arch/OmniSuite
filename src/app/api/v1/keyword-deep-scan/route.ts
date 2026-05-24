import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { logger } from '@/shared/lib/logger';
import { requireInternalToken } from '@/shared/lib/server/internal-token';

export async function POST(req: NextRequest) {
  try {
    const { keyword } = await req.json();

    if (!keyword) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    const pythonEngineUrl = process.env.PYTHON_ENGINE_URL || 'http://127.0.0.1:8082';
    const internalToken = requireInternalToken();

    const response = await fetch(`${pythonEngineUrl}/api/keywords/deep-scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': internalToken
      },
      body: JSON.stringify({ keyword })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ 
        error: 'Python Engine failed', 
        details: errorData.detail || response.statusText 
      }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (err: any) {
    logger.error(`Next.js API Error (Keyword Deep Scan): ${err.message || err}`);
    return NextResponse.json({ error: 'Server error', message: err.message }, { status: 500 });
  }
}
