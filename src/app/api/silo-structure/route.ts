import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `Please ignore all previous instructions. Respond only in Vietnamese. You are a Keyword Research Expert. Create a detailed SILO structure for: "{seed_keyword}".
Rule 1: Generate exactly 5 UNIQUE pillar pages (trang trụ cột). Each pillar must represent a distinct major topic angle of the seed keyword. Ensure no overlapping meanings between pillars.
Rule 2: For each pillar page, generate 4-6 UNIQUE sub-categories (clusters/trang con). Ensure no overlapping meanings between sub-categories within the same pillar.
Rule 3: ONLY focus on the pillar names and Topic names (subpage_name). DO NOT generate long-tail keywords here.
Rule 4: Return ONLY a valid JSON object:
{
  "seed_keyword": "{seed_keyword}",
  "pillars": [
    {
      "pillar_keyword": "Tên trang trụ cột 1",
      "clusters": [
        { "subpage_name": "Tên chủ đề con duy nhất" }
      ]
    }
  ]
}`;

const VISION_MODELS = {
  google: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
  claude: ['claude-3-5-sonnet-latest'],
  groq: [],
  deepseek: []
};

function extractVersion(modelId: string): number {
  const match = modelId.match(/(\d+\.\d+)/);
  return match ? parseFloat(match[1]) : 0;
}

function getModelTier(modelId: string): number {
  const id = modelId.toLowerCase();
  if (id.includes('pro')) return 30;
  if (id.includes('turbo')) return 20;
  if (id.includes('flash')) return 15;
  if (id.includes('lite')) return 10;
  return 5;
}

async function fetchModels(provider: string, apiKey: string): Promise<string[]> {
  let models: string[] = [];
  try {
    if (provider === 'google' || provider === 'gemini') {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (resp.ok) {
        const data = await resp.json();
        models = data.models
          ?.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name.replace('models/', ''))
          .filter((name: string) => name.includes('gemini')) || [];
      }
      if (models.length === 0) models = ['gemini-1.5-pro', 'gemini-1.5-flash'];
    } else if (provider === 'openai') {
      const resp = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        models = data.data?.map((m: any) => m.id).filter((id: string) => id.startsWith('gpt-')) || [];
      }
      if (models.length === 0) models = ['gpt-4o', 'gpt-4o-mini'];
    } else if (provider === 'claude') {
      models = ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'];
    } else if (provider === 'groq') {
      const resp = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        models = data.data?.map((m: any) => m.id) || [];
      }
      if (models.length === 0) models = ['llama-3.3-70b-versatile'];
    } else if (provider === 'deepseek') {
      const resp = await fetch('https://api.deepseek.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        models = data.data?.map((m: any) => m.id) || [];
      }
      if (models.length === 0) models = ['deepseek-chat'];
    }
  } catch { models = ['gpt-4o']; }
  
  models = models.sort((a, b) => {
    const va = extractVersion(a), vb = extractVersion(b);
    const ta = getModelTier(a), tb = getModelTier(b);
    if (va !== vb) return vb - va;
    return tb - ta;
  });
  
  return models;
}

async function callLLM(
  provider: string,
  apiKey: string,
  model: string,
  seedKeyword: string,
  customPrompt?: string
) {
  console.time('LLM_CALL');
  const prompt = customPrompt || SYSTEM_PROMPT.replace('{seed_keyword}', seedKeyword);
  
  let url = '', headers: Record<string, string> = {}, body: any = {};
  
  if (provider === 'google' || provider === 'gemini') {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 4000 } };
  } else if (provider === 'openai') {
    url = 'https://api.openai.com/v1/chat/completions';
    headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 4000 };
  } else if (provider === 'claude') {
    url = 'https://api.anthropic.com/v1/messages';
    headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' };
    body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 4000 };
  } else if (provider === 'deepseek') {
    url = 'https://api.deepseek.com/v1/chat/completions';
    headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    body = { model: model || 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 4000 };
  } else {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    body = { model: model || 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 4000 };
  }
  
  // Add timeout for LLM call to avoid hanging
  const llmTimeout = 60000; // 60 seconds
  const llmPromise = fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const resp = await (Promise.race([
    llmPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('LLM request timeout')), llmTimeout))
  ]) as any) as Response;
  
  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(`API error ${resp.status}: ${JSON.stringify(errorData)}`);
  }
  
  const data = await resp.json();
  console.timeEnd('LLM_CALL');
  
  // Check for API errors
  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }
  
  if (provider === 'google' || provider === 'gemini') {
    if (data.promptFeedback?.blockReason) {
      throw new Error('Content blocked: ' + data.promptFeedback.blockReason);
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else if (provider === 'claude') {
    if (data.type === 'error') {
      throw new Error(data.error?.message || 'Claude API error');
    }
    return data.content?.[0]?.text || '';
  } else {
    if (data.error) {
      throw new Error(data.error.message || 'API error');
    }
    return data.choices?.[0]?.message?.content || '';
  }
}

function parseSILOJson(text: string): any {
  if (!text) return null;
  
  // Remove markdown code blocks
  let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.log('JSON parse error:', e);
      // Try to find JSON-like structure
      const braceStart = cleanText.indexOf('{');
      if (braceStart >= 0) {
        try {
          // Try to find closing brace
          let depth = 0;
          let endIdx = -1;
          for (let i = braceStart; i < cleanText.length; i++) {
            if (cleanText[i] === '{') depth++;
            else if (cleanText[i] === '}') depth--;
            if (depth === 0) { endIdx = i + 1; break; }
          }
          if (endIdx > 0) {
            return JSON.parse(cleanText.substring(braceStart, endIdx));
          }
        } catch {}
      }
      return null;
    }
  }
  return null;
}

function parseRelevanceJson(text: string): string[] {
  if (!text) return [];
  const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const accepted = parsed?.accepted_keywords;
    return Array.isArray(accepted) ? accepted : [];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[SILO-LOG] Received POST body:', body);
    const { seedKeyword, provider = 'google', apiKeys = {}, task } = body;
    
    if (!seedKeyword) {
      return NextResponse.json({ error: 'Thiếu từ khóa hạt giống' }, { status: 400 });
    }

    const keyMap: Record<string, string> = {
      google: 'gemini', gemini: 'gemini', openai: 'openai', claude: 'claude', groq: 'groq', deepseek: 'deepseek'
    };
    const keyField = keyMap[provider] || provider;
    
    // Frontend sends: google: settings.gemini_api_key, openai: settings.openai_api_key, etc.
    // So check both keyField (gemini) and provider (google)
    const apiKey = apiKeys[keyField] || apiKeys[provider] || process.env[`${keyField.toUpperCase()}_API_KEY`] || process.env[`${provider.toUpperCase()}_API_KEY`];
    console.log('[SILO-LOG] Resolving API key', { provider, keyField, apiKeyExists: !!apiKey, apiKey: apiKey ? '[REDACTED]' : null });
    
    if (!apiKey) {
      return NextResponse.json({ error: `Thiếu API Key cho provider: ${provider} (field: ${keyField})` }, { status: 400 });
    }

    const models = await fetchModels(provider, apiKey);
    const model = models[0];

    if (task === 'relevance_check') {
      const pillarKeyword = body.pillarKeyword || '';
      const clusterName = body.clusterName || '';
      const keywords: string[] = Array.isArray(body.keywords) ? body.keywords : [];
      if (!seedKeyword || !pillarKeyword || !clusterName || keywords.length === 0) {
        return NextResponse.json({ accepted_keywords: [] });
      }

      const relevancePrompt = `
Bạn là chuyên gia SEO SILO. Nhiệm vụ: giữ lại keyword liên quan chặt chẽ với chủ đề.

Seed Keyword gốc: "${seedKeyword}"
Trang trụ cột: "${pillarKeyword}"
Trang con: "${clusterName}"
Danh sách keyword cần lọc:
${JSON.stringify(keywords)}

Yêu cầu:
1) Loại keyword trôi chủ đề hoặc quá chung chung.
2) Chỉ giữ keyword thực sự phục vụ đúng Trang con.
3) Trả về JSON hợp lệ DUY NHẤT theo format:
{
  "accepted_keywords": ["kw1", "kw2"]
}
      `.trim();

      const llmResponse = await callLLM(provider, apiKey, model, seedKeyword, relevancePrompt);
      const accepted = parseRelevanceJson(llmResponse);
      const acceptedSet = new Set(accepted.map(item => item.toLowerCase().trim()));
      const finalAccepted = keywords.filter(item => acceptedSet.has(item.toLowerCase().trim()));
      return NextResponse.json({ accepted_keywords: finalAccepted });
    }
    
    const llmResponse = await callLLM(provider, apiKey, model, seedKeyword);
    console.log('LLM Response:', llmResponse.substring(0, 500));
    const siloData = parseSILOJson(llmResponse);
    
    if (!siloData) {
      console.log('Failed to parse JSON. Raw response:', llmResponse);
      return NextResponse.json({ error: 'Không thể parse JSON từ LLM', debug: llmResponse.substring(0, 200) }, { status: 500 });
    }

    // Support new multi-pillar format
    const pillars = siloData.pillars || [{
      pillar_keyword: siloData.pillar_keyword || seedKeyword,
      clusters: siloData.clusters || []
    }];

    const allKeywords: string[] = [];
    for (const pillar of pillars) {
      allKeywords.push(pillar.pillar_keyword);
      if (pillar.clusters) {
        for (const cluster of pillar.clusters) {
          if (cluster.target_keywords && Array.isArray(cluster.target_keywords)) {
            allKeywords.push(...cluster.target_keywords);
          }
        }
      }
    }

    return NextResponse.json({
      seed_keyword: seedKeyword,
      pillars,
      all_keywords: allKeywords,
      model_used: model
    });

  } catch (error: any) {
    console.error('SILO API Error:', error.message);
    return NextResponse.json({ error: 'Lỗi: ' + error.message }, { status: 500 });
  }
}
