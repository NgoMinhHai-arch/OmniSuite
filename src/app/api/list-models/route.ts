import { NextResponse } from 'next/server';
import { fetchModelsForProvider } from '@/shared/lib/model-catalog';

export async function POST(req: Request) {
  try {
    const { provider, apiKey, customBaseUrl } = await req.json();
    if (!apiKey && String(provider || '').toLowerCase() !== 'claude' && String(provider || '').toLowerCase() !== 'anthropic') {
      return NextResponse.json({ error: "API Key is required" }, { status: 400 });
    }

    const models = await fetchModelsForProvider({ provider, apiKey, customBaseUrl, strict: true });

    return NextResponse.json({ models });

  } catch (error: any) {
    console.error("List Models Critical Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
