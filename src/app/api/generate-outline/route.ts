import { NextResponse } from 'next/server';
import { requestOutline } from '@/shared/lib/content-engine-client';
import type { ContentOutlineRequest } from '@/shared/contracts/content-engine';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ContentOutlineRequest & { sampleArticle?: string; demand?: string };
    const {
      topic,
      keyword,
      secondaryKeywords,
      masterContext,
      framework = 'Tự do',
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
    console.error('Outline Gen Error:', error);
    const msg = error instanceof Error ? error.message : 'Lỗi tạo dàn ý';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
