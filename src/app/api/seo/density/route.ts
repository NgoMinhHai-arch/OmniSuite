import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { keyword } = await req.json();
    if (!keyword) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    // Step 1: Find Top 1 URL using Google (can be done in Python for consistency)
    // For V.FINAL, we want high performance 10% effort -> 80% result.
    // We'll call the Python /audit endpoint with a Google Search URL first.
    
    const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&hl=en`;
    
    // Call Python FastAPI /audit
    const response = await fetch('http://127.0.0.1:8001/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        keyword, 
        url: targetUrl // In the Python script, we could make it smarter to find the first result if it's a search URL
      })
    });

    if (!response.ok) {
      throw new Error('Audit Failed');
    }

    const data = await response.json();
    return NextResponse.json({ audit: data });
    
  } catch (error: any) {
    console.error('Audit API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

