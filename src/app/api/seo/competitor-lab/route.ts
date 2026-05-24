import { NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { domainA, domainB } = await req.json();
    const scriptPath = path.join(process.cwd(), 'scripts', 'seo_analyzer.py');

    // Run Competitor Gap Analysis
    const result = spawnSync('python', [scriptPath, 'competitor_gap', domainA, domainB], { encoding: 'utf-8' });

    if (result.error) {
      return NextResponse.json({ error: 'Competitor Lab script failed' }, { status: 500 });
    }

    try {
      const data = JSON.parse(result.stdout);
      return NextResponse.json({ results: data });
    } catch (e) {
      return NextResponse.json({ error: 'Could not parse gap results', raw: result.stdout }, { status: 500 });
    }
    
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
