import { NextResponse } from 'next/server';
import { fetchModelsForProvider, fetchOpenRouterModelCatalog } from '@/shared/lib/model-catalog';
import { safeErrorMessage } from '@/shared/lib/server/secret-redact';

export async function POST(req: Request) {
  try {
    const { provider, apiKey, customBaseUrl } = await req.json();
    const pl = String(provider || '').toLowerCase();
    const allowEmptyKey = pl === 'claude' || pl === 'anthropic' || pl === 'ollama' || pl === '9router' || pl === 'ninerouter';
    if (!apiKey && !allowEmptyKey) {
      return NextResponse.json({ error: "API Key is required" }, { status: 400 });
    }

    const providerLower = String(provider || '').toLowerCase();
    const models = await fetchModelsForProvider({ provider, apiKey, customBaseUrl, strict: true });
    const openrouterCatalog =
      providerLower === 'openrouter' ? await fetchOpenRouterModelCatalog(apiKey) : undefined;

    return NextResponse.json({ models, openrouterCatalog });

  } catch (error: unknown) {
    const message = safeErrorMessage(error);
    console.error('List Models Critical Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
