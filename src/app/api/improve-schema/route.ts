import { NextResponse } from 'next/server';

const PYTHON_BACKEND = 'http://127.0.0.1:8082';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Proxy to Python Backend
    const pyRes = await fetch(`${PYTHON_BACKEND}/api/seo/improve-schema`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!pyRes.ok) {
      const errText = await pyRes.text();
      return NextResponse.json({ error: `Python Backend Error: ${errText}` }, { status: pyRes.status });
    }

    const data = await pyRes.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('[Improve Schema API] Error:', error);
    return NextResponse.json({ error: `Internal Server Error: ${error.message || error}`, stack: error.stack }, { status: 500 });
  }
}
