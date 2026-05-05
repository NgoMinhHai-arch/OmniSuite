import { NextResponse } from "next/server";
import { serpApiSearch } from "@/lib/seo/serpapi";
import { getSystemConfig } from "@/shared/lib/config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = (body?.query || "").trim();
    if (!query) return NextResponse.json({ error: "Thiếu query" }, { status: 400 });
    const apiKey = body?.apiKey || getSystemConfig().serpapi_key || "";
    const result = await serpApiSearch(apiKey, {
      query,
      hl: body?.hl || "vi",
      gl: body?.gl || "vn",
      num: body?.num || 20,
      engine: body?.engine || "google",
      location: body?.location,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json(result.data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
