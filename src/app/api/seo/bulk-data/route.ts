import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { seeds, provider, apiKeys, model } = await req.json();
    if (!seeds || !Array.isArray(seeds)) {
      return NextResponse.json({ error: 'Invalid seeds provided' }, { status: 400 });
    }

    // Call the FastAPI Python Backend (V.FINAL)
    // Pass provider and apiKeys as query params
    const queryParams = new URLSearchParams({
      provider: provider || 'google',
      model: model || '',
      api_keys: JSON.stringify(apiKeys || {})
    });

    const response = await fetch(`http://127.0.0.1:8001/analyze?${queryParams}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: seeds })
    });

    if (!response.ok || !response.body) {
      return NextResponse.json({ error: 'Failed to connect to SEO Engine' }, { status: 500 });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error: any) {
    console.error('SEO API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

