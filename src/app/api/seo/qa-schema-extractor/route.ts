import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface FAQ { q: string; a: string }
interface ResultRow { url: string; ok: boolean; error?: string; faqs?: FAQ[]; rawCount?: number }

function asArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

type JsonLdNode = {
  "@type"?: string | string[];
  "@graph"?: JsonLdNode[];
  mainEntity?: JsonLdNode | JsonLdNode[];
  name?: string;
  acceptedAnswer?: { text?: string } | { text?: string }[];
};

function extractFromJsonLd(json: unknown): FAQ[] {
  const out: FAQ[] = [];
  const visit = (node: JsonLdNode) => {
    if (!node) return;
    const types = asArray(node["@type"]).map((t) => String(t).toLowerCase());
    if (types.includes("question") && node.name && node.acceptedAnswer) {
      const a = asArray(node.acceptedAnswer)
        .map((x) => (x && (x as { text?: string }).text ? (x as { text?: string }).text! : ""))
        .filter(Boolean)
        .join("\n\n");
      if (a) out.push({ q: String(node.name).trim(), a: a.trim() });
    }
    if (types.includes("faqpage") && node.mainEntity) {
      asArray(node.mainEntity).forEach(visit);
    }
    if (node["@graph"]) node["@graph"].forEach(visit);
  };
  if (Array.isArray(json)) (json as JsonLdNode[]).forEach(visit);
  else visit(json as JsonLdNode);
  return out;
}

async function extract(url: string): Promise<ResultRow> {
  if (!url.startsWith("http")) return { url, ok: false, error: "URL không hợp lệ" };
  try {
    const resp = await fetch(url, { headers: { "User-Agent": "OmniSuite-FAQ/1.0" } });
    if (!resp.ok) return { url, ok: false, error: `HTTP ${resp.status}` };
    const html = await resp.text();
    const $ = cheerio.load(html);
    const faqs: FAQ[] = [];
    let raw = 0;
    $('script[type="application/ld+json"]').each((_, el) => {
      raw++;
      const txt = $(el).contents().text() || $(el).html() || "";
      try {
        const parsed = JSON.parse(txt);
        faqs.push(...extractFromJsonLd(parsed));
      } catch {
        // try to fix multiple JSON blobs separated by commas
        try {
          const fixed = JSON.parse(`[${txt}]`);
          faqs.push(...extractFromJsonLd(fixed));
        } catch {
          /* ignore */
        }
      }
    });
    return { url, ok: true, faqs, rawCount: raw };
  } catch (e) {
    return { url, ok: false, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const urls: string[] = Array.isArray(body?.urls) ? body.urls.filter((u: string) => typeof u === "string") : [];
    if (!urls.length) return NextResponse.json({ error: "Thiếu URLs" }, { status: 400 });
    const limit = urls.slice(0, 20);
    const results = await Promise.all(limit.map(extract));
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
