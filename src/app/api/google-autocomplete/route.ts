import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json([]);
  }

  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`;
    const resp = await fetch(url);
    const data = await resp.json();
    
    // Google Suggest returns [query, [suggestions]]
    return NextResponse.json(data[1] || []);
  } catch (error) {
    console.error("Google Autocomplete Error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
