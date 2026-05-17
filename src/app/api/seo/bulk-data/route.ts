import { NextResponse } from "next/server";
import { getPythonEngineUrl } from "@/shared/lib/python-engine-url";

export async function POST(req: Request) {
  try {
    const { seeds, provider, apiKeys, model } = await req.json();
    if (!seeds || !Array.isArray(seeds)) {
      return NextResponse.json({ error: "Invalid seeds provided" }, { status: 400 });
    }

    const engine = getPythonEngineUrl();
    const response = await fetch(`${engine}/api/keywords/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seed_keyword: seeds[0] ?? "",
        keyword_list: seeds,
        provider: provider || "google",
        model: model || undefined,
        api_keys: apiKeys || {},
        mode: "ANALYZE",
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: "Failed to connect to SEO Engine", detail }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("SEO API Error:", message);
    return NextResponse.json({ error: "Internal Server Error", details: message }, { status: 500 });
  }
}
