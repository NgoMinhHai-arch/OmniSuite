import { NextResponse } from "next/server";
import { firecrawlScrape } from "@/lib/seo/firecrawl";
import { getSystemConfig } from "@/shared/lib/config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = (body?.url || "").trim();
    if (!url) return NextResponse.json({ error: "Thiếu URL" }, { status: 400 });
    const apiKey = body?.apiKey || getSystemConfig().firecrawl_api_key || "";
    const result = await firecrawlScrape(apiKey, url, {
      formats: body?.formats || ["markdown"],
      onlyMainContent: body?.onlyMainContent ?? true,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
