import { NextResponse } from "next/server";

interface Hit { title: string; pageid: number; snippet: string; url: string }

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = (body?.query || "").trim();
    const lang = (body?.lang || "vi").toLowerCase();
    if (!query) return NextResponse.json({ error: "Thiếu query" }, { status: 400 });

    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&srlimit=10&origin=*`;
    const resp = await fetch(searchUrl, { headers: { "User-Agent": "OmniSuite-WikiCitation/1.0" } });
    if (!resp.ok) return NextResponse.json({ error: `Wiki HTTP ${resp.status}` }, { status: 502 });
    const data = (await resp.json()) as { query?: { search?: Array<{ title: string; pageid: number; snippet: string }> } };
    const hits: Hit[] = (data.query?.search || []).map((h) => ({
      title: h.title,
      pageid: h.pageid,
      snippet: h.snippet.replace(/<[^>]+>/g, ""),
      url: `https://${lang}.wikipedia.org/?curid=${h.pageid}`,
    }));
    return NextResponse.json({ hits });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
