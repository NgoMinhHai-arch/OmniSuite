import { NextResponse } from "next/server";
import { callLlm, type LlmKeys } from "@/lib/seo/llm-call";
import { getSystemConfig } from "@/shared/lib/config";

interface ClientKeys {
  openai_api_key?: string;
  gemini_api_key?: string;
  claude_api_key?: string;
  groq_api_key?: string;
  deepseek_api_key?: string;
  openrouter_api_key?: string;
  ollama_base_url?: string;
  ollama_api_key?: string;
}

function buildKeys(client?: ClientKeys): LlmKeys {
  const sys = getSystemConfig();
  return {
    openai_api_key: client?.openai_api_key || sys.openai_api_key,
    gemini_api_key: client?.gemini_api_key || sys.gemini_api_key,
    claude_api_key: client?.claude_api_key || sys.claude_api_key,
    groq_api_key: client?.groq_api_key || sys.groq_api_key,
    deepseek_api_key: client?.deepseek_api_key || sys.deepseek_api_key,
    openrouter_api_key: client?.openrouter_api_key || sys.openrouter_api_key,
    ollama_base_url: client?.ollama_base_url || sys.ollama_base_url,
    ollama_api_key: client?.ollama_api_key || sys.ollama_api_key,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { system, prompt, provider, model, jsonMode, temperature, maxTokens, keys, preferredProvider } =
      body || {};
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Thiếu prompt" }, { status: 400 });
    }
    const result = await callLlm(
      {
        system,
        prompt,
        provider,
        model,
        preferredProvider: typeof preferredProvider === "string" ? preferredProvider : undefined,
        jsonMode: !!jsonMode,
        temperature,
        maxTokens,
      },
      buildKeys(keys)
    );
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
