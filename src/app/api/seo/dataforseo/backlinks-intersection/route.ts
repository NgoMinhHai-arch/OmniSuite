import { NextResponse } from "next/server";
import { dataForSeoClient } from "@/lib/seo/dataforseo";
import { getSystemConfig } from "@/shared/lib/config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const targets: string[] = Array.isArray(body?.targets) ? body.targets.filter((t: string) => typeof t === "string" && t.trim()) : [];
    const exclude = (body?.exclude_target || "").trim();
    if (targets.length < 1) return NextResponse.json({ error: "Cần ít nhất 1 target" }, { status: 400 });
    const sys = getSystemConfig();
    const client = dataForSeoClient({
      user: body?.user || sys.dataforseo_user,
      pass: body?.pass || sys.dataforseo_pass,
    });
    const targetsObj: Record<string, string> = {};
    targets.slice(0, 20).forEach((t, i) => { targetsObj[String(i + 1)] = t; });
    const payload: Record<string, unknown> = { targets: targetsObj, limit: 100 };
    if (exclude) payload.exclude_targets = [exclude];

    const result = await client.post<{ tasks?: Array<{ result?: Array<{ items?: Array<unknown> }> }> }>(
      "/v3/backlinks/domain_intersection/live",
      [payload]
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ items: result.data?.tasks?.[0]?.result?.[0]?.items || [], cost: result.cost });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
