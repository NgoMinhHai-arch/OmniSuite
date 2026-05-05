import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

function fingerprint(html: string): string {
  const $ = cheerio.load(html);
  $("script, style").remove();
  const counts: Record<string, number> = {};
  $("body *").each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() || "";
    counts[tag] = (counts[tag] || 0) + 1;
  });
  const sig = Object.keys(counts)
    .sort()
    .map((k) => `${k}:${counts[k]}`)
    .join("|");
  return sig;
}

async function fetchOne(url: string): Promise<{ url: string; ok: boolean; signature?: string; error?: string; size?: number }> {
  if (!url.startsWith("http")) return { url, ok: false, error: "URL không hợp lệ" };
  try {
    const resp = await fetch(url, { headers: { "User-Agent": "OmniSuite-Fingerprint/1.0" } });
    if (!resp.ok) return { url, ok: false, error: `HTTP ${resp.status}` };
    const html = await resp.text();
    return { url, ok: true, signature: fingerprint(html), size: html.length };
  } catch (e) {
    return { url, ok: false, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const urls: string[] = Array.isArray(body?.urls) ? body.urls.filter((u: string) => typeof u === "string") : [];
    if (!urls.length) return NextResponse.json({ error: "Thiếu URLs" }, { status: 400 });
    const limit = urls.slice(0, 30);
    const results = await Promise.all(limit.map(fetchOne));

    const groups = new Map<string, { signature: string; urls: { url: string; size: number }[] }>();
    results.forEach((r) => {
      if (!r.ok || !r.signature) return;
      if (!groups.has(r.signature)) groups.set(r.signature, { signature: r.signature, urls: [] });
      groups.get(r.signature)!.urls.push({ url: r.url, size: r.size || 0 });
    });

    const clusters = Array.from(groups.values()).sort((a, b) => b.urls.length - a.urls.length);
    return NextResponse.json({ results, clusters });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
