import { NextResponse } from 'next/server';
import { fetchModelsForProvider } from '@/shared/lib/model-catalog';

export async function POST(req: Request) {
  try {
    const { provider, apiKey, customBaseUrl } = await req.json();
    if (!provider) {
      return NextResponse.json({ models: [] });
    }

    const models = await fetchModelsForProvider({ provider, apiKey, customBaseUrl, includeProviderPrefix: false });

    return NextResponse.json({ models });
  } catch (err: any) {
    console.error('Fetch models error:', err.message);
    return NextResponse.json({ models: [] }); // return empty array on failure
  }
}
