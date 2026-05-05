import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface SpecRow { name: string; value: string }
interface Row { url: string; ok: boolean; error?: string; specs?: SpecRow[] }

async function extract(url: string, selectors: { row: string; name: string; value: string } | null): Promise<Row> {
  if (!url.startsWith("http")) return { url, ok: false, error: "URL không hợp lệ" };
  try {
    const resp = await fetch(url, { headers: { "User-Agent": "OmniSuite-ProductSpec/1.0" } });
    if (!resp.ok) return { url, ok: false, error: `HTTP ${resp.status}` };
    const html = await resp.text();
    const $ = cheerio.load(html);

    const specs: SpecRow[] = [];
    if (selectors && selectors.row && selectors.name && selectors.value) {
      $(selectors.row).each((_, el) => {
        const $el = $(el);
        const name = $el.find(selectors.name).text().trim();
        const value = $el.find(selectors.value).text().trim();
        if (name) specs.push({ name, value });
      });
    } else {
      // Heuristic fallback: <table> rows or <dl> pairs
      $("table tr").each((_, el) => {
        const cells = $(el).find("th, td");
        if (cells.length === 2) {
          const name = $(cells[0]).text().trim();
          const value = $(cells[1]).text().trim();
          if (name && name.length < 80) specs.push({ name, value });
        }
      });
      $("dl").each((_, el) => {
        const dts = $(el).find("dt");
        const dds = $(el).find("dd");
        const len = Math.min(dts.length, dds.length);
        for (let i = 0; i < len; i++) {
          specs.push({ name: $(dts[i]).text().trim(), value: $(dds[i]).text().trim() });
        }
      });
    }

    // dedupe & cleanup
    const seen = new Set<string>();
    const out = specs
      .filter((s) => s.name && (seen.has(s.name.toLowerCase()) ? false : (seen.add(s.name.toLowerCase()), true)))
      .slice(0, 200);

    return { url, ok: true, specs: out };
  } catch (e) {
    return { url, ok: false, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const urls: string[] = Array.isArray(body?.urls) ? body.urls.filter((u: string) => typeof u === "string") : [];
    const selectors = body?.selectors || null;
    if (!urls.length) return NextResponse.json({ error: "Thiếu URLs" }, { status: 400 });
    const limit = urls.slice(0, 15);
    const results = await Promise.all(limit.map((u) => extract(u, selectors)));
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
