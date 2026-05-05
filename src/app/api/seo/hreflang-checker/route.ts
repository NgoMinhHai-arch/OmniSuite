import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface UrlIssue {
  url: string;
  ok: boolean;
  error?: string;
  hreflangs?: { lang: string; href: string; rel: string }[];
  hasXDefault?: boolean;
  duplicates?: string[];
  selfReferences?: boolean;
}

async function inspect(url: string, timeoutMs = 12000): Promise<UrlIssue> {
  if (!url.startsWith("http")) return { url, ok: false, error: "URL không hợp lệ" };
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "OmniSuite-Hreflang/1.0" },
      redirect: "follow",
    });
    if (!resp.ok) return { url, ok: false, error: `HTTP ${resp.status}` };
    const html = await resp.text();
    const $ = cheerio.load(html);
    const links = $("link[rel='alternate'][hreflang]");
    const hreflangs: { lang: string; href: string; rel: string }[] = [];
    links.each((_, el) => {
      const lang = ($(el).attr("hreflang") || "").trim();
      const href = ($(el).attr("href") || "").trim();
      const rel = ($(el).attr("rel") || "").trim();
      if (lang && href) hreflangs.push({ lang, href, rel });
    });
    const counts = new Map<string, number>();
    hreflangs.forEach((h) => counts.set(h.lang, (counts.get(h.lang) || 0) + 1));
    const duplicates = Array.from(counts.entries()).filter(([, c]) => c > 1).map(([l]) => l);
    return {
      url,
      ok: true,
      hreflangs,
      hasXDefault: hreflangs.some((h) => h.lang.toLowerCase() === "x-default"),
      duplicates,
      selfReferences: hreflangs.some((h) => h.href === url || h.href === url.replace(/\/$/, "")),
    };
  } catch (e) {
    return { url, ok: false, error: e instanceof Error ? e.message : "fetch failed" };
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const urls: string[] = Array.isArray(body?.urls) ? body.urls.filter((u: string) => typeof u === "string") : [];
    if (!urls.length) return NextResponse.json({ error: "Thiếu danh sách URLs." }, { status: 400 });
    const limit = urls.slice(0, 25);
    const results = await Promise.all(limit.map((u) => inspect(u)));
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
