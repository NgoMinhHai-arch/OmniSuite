import { NextResponse } from "next/server";
import { getSystemConfig } from "@/shared/lib/config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sys = getSystemConfig();
    const apiKey = body?.apiKey || sys.oncrawl_api_key;
    const projectId = body?.projectId || sys.oncrawl_project_id;
    if (!apiKey) return NextResponse.json({ error: "Thiếu Oncrawl API key" }, { status: 400 });
    if (!projectId) return NextResponse.json({ error: "Thiếu Oncrawl project ID" }, { status: 400 });

    const resp = await fetch(`https://app.oncrawl.com/api/v2/projects/${encodeURIComponent(projectId)}/crawls?limit=20&sort=-created_at`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) return NextResponse.json({ error: (data && data.message) || `Oncrawl HTTP ${resp.status}` }, { status: 502 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
