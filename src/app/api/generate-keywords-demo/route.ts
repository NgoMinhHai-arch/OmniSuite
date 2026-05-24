import { NextResponse } from 'next/server';
import { requireInternalToken } from '@/shared/lib/server/internal-token';
import { spawn } from 'child_process';
import path from 'path';
import { logger } from '@/shared/lib/logger';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { seedKeyword, provider, model, mode, keywordList, ranks, disableAI } = body;
    
    const pythonEngineUrl = process.env.PYTHON_ENGINE_URL || 'http://127.0.0.1:8082';
    const internalToken = requireInternalToken();

    const response = await fetch(`${pythonEngineUrl}/api/keywords/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': internalToken
      },
      body: JSON.stringify({
        seed_keyword: seedKeyword,
        mode: mode || "FULL",
        keyword_list: keywordList,
        ranks: ranks,
        provider: provider || "google",
        model: model,
        disable_ai: disableAI === true,
        api_keys: body.apiKeys
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ 
        error: 'Python Engine failed', 
        details: errorData.detail || response.statusText 
      }, { status: response.status });
    }

    const data = await response.json();

    // Stream the data back to the client to maintain the original UI experience
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const item of data) {
          controller.enqueue(encoder.encode(JSON.stringify(item) + '\n'));
          // Small delay to simulate real-time processing and ensure smooth UI rendering
          await new Promise(resolve => setTimeout(resolve, 50)); 
        }
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    logger.error(`Next.js API Error (Keywords Demo): ${error.message || error}`);
    return NextResponse.json({ error: "Lỗi API: " + error.message }, { status: 500 });
  }
}
