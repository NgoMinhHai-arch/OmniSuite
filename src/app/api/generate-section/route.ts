import { NextResponse } from 'next/server';
import { requestSection } from '@/shared/lib/content-engine-client';
import type { ContentSectionRequest } from '@/shared/contracts/content-engine';
import { pythonBridgeErrorResponse } from '@/shared/lib/server/python-bridge';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ContentSectionRequest;
    const {
      topic,
      keyword,
      secondaryKeywords,
      sectionTitle,
      sectionIndex,
      totalSections,
      masterContext,
      framework = 'Tá»± do',
      provider,
      modelName,
      apiKey,
      customBaseUrl,
      tavilyApiKey,
      tavilyContext: providedTavilyContext,
      platformPreset = 'googleSeoLongForm',
    } = body;

    if (!sectionTitle) {
      return NextResponse.json({ error: 'Section title is required' }, { status: 400 });
    }

    const text = await requestSection({
      topic,
      keyword,
      secondaryKeywords,
      sectionTitle,
      sectionIndex,
      totalSections,
      masterContext,
      framework,
      provider,
      modelName,
      apiKey,
      customBaseUrl,
      tavilyApiKey,
      tavilyContext: providedTavilyContext,
      platformPreset,
    });

    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error: unknown) {
    return pythonBridgeErrorResponse(error);
  }
}
