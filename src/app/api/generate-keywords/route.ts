import { NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { requireInternalToken } from '@/shared/lib/server/internal-token';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { seedKeyword, provider = '', modelName = '', apiKey = '' } = body;

    if (!seedKeyword) {
      return NextResponse.json({ error: "Seed keyword is required" }, { status: 400 });
    }

    const pythonEngineUrl = process.env.PYTHON_ENGINE_URL || 'http://127.0.0.1:8082';
    const internalToken = requireInternalToken();
    const response = await fetch(`${pythonEngineUrl}/api/keywords/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': internalToken
      },
      body: JSON.stringify({
        seed_keyword: seedKeyword,
        mode: 'FULL',
        provider: provider || 'google',
        model: modelName,
        api_keys: apiKey
          ? {
              openai: provider.toLowerCase() === 'openai' ? apiKey : '',
              gemini: provider.toLowerCase() === 'gemini' || provider.toLowerCase() === 'google' ? apiKey : '',
              groq: provider.toLowerCase() === 'groq' ? apiKey : '',
              claude: provider.toLowerCase() === 'claude' || provider.toLowerCase() === 'anthropic' ? apiKey : '',
              deepseek: provider.toLowerCase() === 'deepseek' ? apiKey : '',
            }
          : body.apiKeys
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.error || "Lỗi trong quá trình xử lý dữ liệu Python.");
    }

    try {
      const keywords = await response.json();
      return NextResponse.json({ keywords });
    } catch (e) {
      logger.error("JSON Parse Error on keyword engine output");
      return NextResponse.json({ error: "Lỗi định dạng dữ liệu từ công cụ phân tích." }, { status: 500 });
    }

  } catch (error: any) {
    logger.error(`Keyword Gen Error: ${error.message || error}`);
    return NextResponse.json({ error: error.message || "Lỗi nghiên cứu từ khóa" }, { status: 500 });
  }
}
