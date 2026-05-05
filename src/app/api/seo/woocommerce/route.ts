import { NextResponse } from "next/server";
import { getSystemConfig } from "@/shared/lib/config";

interface ReqBody {
  storeUrl?: string;
  consumerKey?: string;
  consumerSecret?: string;
  endpoint?: string;
  query?: Record<string, string | number>;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    const sys = getSystemConfig();
    const storeUrl = (body.storeUrl || sys.woo_store_url || "").replace(/\/$/, "");
    const ck = body.consumerKey || sys.woo_consumer_key;
    const cs = body.consumerSecret || sys.woo_consumer_secret;
    if (!storeUrl) return NextResponse.json({ error: "Thiếu store URL" }, { status: 400 });
    if (!ck || !cs) return NextResponse.json({ error: "Thiếu consumer key/secret" }, { status: 400 });
    const endpoint = body.endpoint || "products";
    const params = new URLSearchParams({ consumer_key: ck, consumer_secret: cs, per_page: "50" });
    if (body.query) Object.entries(body.query).forEach(([k, v]) => params.set(k, String(v)));
    const resp = await fetch(`${storeUrl}/wp-json/wc/v3/${endpoint}?${params.toString()}`, { cache: "no-store" });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) return NextResponse.json({ error: (data && (data.message || data.code)) || `Woo HTTP ${resp.status}` }, { status: 502 });
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
