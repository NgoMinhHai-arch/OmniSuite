import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = (body?.query || "").trim();
    if (!query) return NextResponse.json({ error: "Thiếu query" }, { status: 400 });

    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`;
    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 OmniSuite-eBayRelated/1.0", Accept: "text/html" } });
    if (!resp.ok) return NextResponse.json({ error: `eBay HTTP ${resp.status}` }, { status: 502 });
    const html = await resp.text();
    const $ = cheerio.load(html);

    const related = new Set<string>();
    $("a[href*='_nkw=']").each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 2 && text.length < 80 && !/^\d+$/.test(text)) related.add(text);
    });
    $("li.related-search, .srp-related-searches li").each((_, el) => {
      related.add($(el).text().trim());
    });

    const items = Array.from(related)
      .filter((t) => t && !t.toLowerCase().includes(query.toLowerCase().slice(0, 10)) === false)
      .slice(0, 50);

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
