import { NextResponse } from 'next/server';
import { requestOutline } from '@/shared/lib/content-engine-client';
import type { ContentOutlineRequest } from '@/shared/contracts/content-engine';
import { pythonBridgeErrorResponse } from '@/shared/lib/server/python-bridge';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ContentOutlineRequest & { sampleArticle?: string; demand?: string };
    const {
      topic,
      keyword,
      secondaryKeywords,
      masterContext,
      framework = 'Tá»± do',
      provider,
      modelName,
      apiKey,
      customBaseUrl,
      tavilyApiKey,
      platformPreset = 'googleSeoLongForm',
    } = body;

    if (!keyword) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    const result = await requestOutline({
      topic,
      keyword,
      secondaryKeywords,
      masterContext,
      framework,
      provider,
      modelName,
      apiKey,
      customBaseUrl,
      tavilyApiKey,
      platformPreset,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return pythonBridgeErrorResponse(error);
  }
}
