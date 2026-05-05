import { NextResponse } from "next/server";
import { dataForSeoClient } from "@/lib/seo/dataforseo";
import { getSystemConfig } from "@/shared/lib/config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const target = (body?.target || "").trim();
    if (!target) return NextResponse.json({ error: "Thiếu target domain" }, { status: 400 });
    const sys = getSystemConfig();
    const client = dataForSeoClient({
      user: body?.user || sys.dataforseo_user,
      pass: body?.pass || sys.dataforseo_pass,
    });
    const result = await client.post<{ tasks?: Array<{ result?: Array<unknown> }> }>(
      "/v3/backlinks/summary/live",
      [{ target, internal_list_limit: 10, backlinks_status_type: "live" }]
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ items: result.data?.tasks?.[0]?.result || [], cost: result.cost });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
