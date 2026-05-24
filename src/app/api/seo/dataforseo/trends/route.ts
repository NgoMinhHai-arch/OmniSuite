import { NextResponse } from "next/server";
import { dataForSeoClient } from "@/lib/seo/dataforseo";
import { getSystemConfig } from "@/shared/lib/config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const keywords: string[] = Array.isArray(body?.keywords) ? body.keywords.filter((k: string) => typeof k === "string" && k.trim()) : [];
    if (!keywords.length) return NextResponse.json({ error: "Thiếu keywords" }, { status: 400 });
    const sys = getSystemConfig();
    const client = dataForSeoClient({
      user: body?.user || sys.dataforseo_user,
      pass: body?.pass || sys.dataforseo_pass,
    });
    const result = await client.post<{ tasks?: Array<{ result?: Array<unknown> }> }>(
      "/v3/keywords_data/google_trends/explore/live",
      [
        {
          keywords: keywords.slice(0, 5),
          location_code: body?.location_code || 2840,
          language_code: body?.language_code || "vi",
          time_range: body?.time_range || "past_12_months",
        },
      ]
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    const items = result.data?.tasks?.[0]?.result || [];
    return NextResponse.json({ items, cost: result.cost });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
