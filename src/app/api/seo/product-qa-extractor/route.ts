import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface QA { q: string; a: string }
interface Row { url: string; ok: boolean; error?: string; qas?: QA[] }

async function extract(url: string): Promise<Row> {
  if (!url.startsWith("http")) return { url, ok: false, error: "URL không hợp lệ" };
  try {
    const resp = await fetch(url, { headers: { "User-Agent": "OmniSuite-ProductQA/1.0" } });
    if (!resp.ok) return { url, ok: false, error: `HTTP ${resp.status}` };
    const html = await resp.text();
    const $ = cheerio.load(html);

    const qas: QA[] = [];
    // 1. JSON-LD Question
    $('script[type="application/ld+json"]').each((_, el) => {
      const txt = $(el).contents().text() || $(el).html() || "";
      try {
        const parsed = JSON.parse(txt);
        const visit = (n: { "@type"?: string | string[]; name?: string; acceptedAnswer?: { text?: string } | { text?: string }[]; "@graph"?: unknown[]; mainEntity?: unknown[] | unknown }) => {
          if (!n) return;
          const types = Array.isArray(n["@type"]) ? n["@type"] : n["@type"] ? [n["@type"]] : [];
          if (types.map((t) => t.toLowerCase()).includes("question") && n.name && n.acceptedAnswer) {
            const arr = Array.isArray(n.acceptedAnswer) ? n.acceptedAnswer : [n.acceptedAnswer];
            const a = arr.map((x) => x?.text || "").filter(Boolean).join("\n");
            if (a) qas.push({ q: String(n.name).trim(), a: a.trim() });
          }
          if (n["@graph"]) (n["@graph"] as unknown[]).forEach((x) => visit(x as Parameters<typeof visit>[0]));
          if (n.mainEntity) {
            const arr = Array.isArray(n.mainEntity) ? n.mainEntity : [n.mainEntity];
            arr.forEach((x) => visit(x as Parameters<typeof visit>[0]));
          }
        };
        if (Array.isArray(parsed)) parsed.forEach(visit);
        else visit(parsed);
      } catch {
        /* ignore */
      }
    });

    // 2. Heuristic blocks: tìm các pattern Q:/A: hoặc class chứa "question"
    $('[class*="question"], [class*="faq"], details').each((_, el) => {
      const $el = $(el);
      const q = $el.find("summary, h3, h4, .q, .question-title, [class*='title']").first().text().trim();
      const a = $el.find("p, .a, .answer, [class*='content']").first().text().trim();
      if (q && a && q.length < 300 && a.length < 2000) qas.push({ q, a });
    });

    // dedupe
    const seen = new Set<string>();
    const dedup = qas.filter((qa) => {
      const k = (qa.q + "::" + qa.a.slice(0, 80)).toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    return { url, ok: true, qas: dedup };
  } catch (e) {
    return { url, ok: false, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const urls: string[] = Array.isArray(body?.urls) ? body.urls.filter((u: string) => typeof u === "string") : [];
    if (!urls.length) return NextResponse.json({ error: "Thiếu URLs" }, { status: 400 });
    const limit = urls.slice(0, 15);
    const results = await Promise.all(limit.map(extract));
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
