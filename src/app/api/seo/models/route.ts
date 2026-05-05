import { NextResponse } from 'next/server';
import { fetchModelsForProvider, filterVisionModels } from '@/shared/lib/model-catalog';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const provider = (searchParams.get('provider') || 'google').toLowerCase();
    const apiKeysParam = searchParams.get('apiKeys') || '{}';
    const preferVision = searchParams.get('prefer_vision') === 'true';

    let apiKey = '';
    try {
      const keys = JSON.parse(apiKeysParam);
      const keyMap: Record<string, string> = {
        google: 'google', gemini: 'google',
        openai: 'openai',
        claude: 'claude', anthropic: 'claude',
        groq: 'groq',
        deepseek: 'deepseek',
        openrouter: 'openrouter'
      };
      const keyField = keyMap[provider] || provider;
      apiKey = keys[keyField] || '';
    } catch { apiKey = ''; }

    let models = await fetchModelsForProvider({ provider, apiKey, includeProviderPrefix: false });

    // If prefer_vision, return only vision-capable models
    if (preferVision) {
      const visionModels = filterVisionModels(provider, models);
      if (visionModels.length > 0) {
        return NextResponse.json({ models: visionModels, selected: visionModels[0], vision: true });
      }
    }

    return NextResponse.json({ models });
  } catch (error) {
    return NextResponse.json({ models: ['gpt-4'] });
  }
}
