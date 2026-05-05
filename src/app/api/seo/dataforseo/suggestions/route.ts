import { NextResponse } from "next/server";
import { dataForSeoClient } from "@/lib/seo/dataforseo";
import { getSystemConfig } from "@/shared/lib/config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const keyword = (body?.keyword || "").trim();
    if (!keyword) return NextResponse.json({ error: "Thiếu keyword" }, { status: 400 });
    const sys = getSystemConfig();
    const client = dataForSeoClient({
      user: body?.user || sys.dataforseo_user,
      pass: body?.pass || sys.dataforseo_pass,
    });
    const result = await client.post<{ tasks?: Array<{ result?: Array<{ items?: Array<unknown> }> }> }>(
      "/v3/dataforseo_labs/google/keyword_suggestions/live",
      [
        {
          keyword,
          location_code: body?.location_code || 2840,
          language_code: body?.language_code || "vi",
          include_seed_keyword: true,
          limit: body?.limit || 100,
        },
      ]
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    const items = result.data?.tasks?.[0]?.result?.[0]?.items || [];
    return NextResponse.json({ items, cost: result.cost });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
