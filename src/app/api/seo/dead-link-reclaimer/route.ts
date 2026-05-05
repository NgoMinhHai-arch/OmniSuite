import { NextResponse } from "next/server";

interface Row { url: string; status: number | null; finalUrl?: string; ok: boolean; error?: string; redirected?: boolean }

async function check(url: string): Promise<Row> {
  if (!url.startsWith("http")) return { url, status: null, ok: false, error: "URL không hợp lệ" };
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "OmniSuite-DeadLink/1.0" },
      redirect: "follow",
      signal: controller.signal,
    });
    return {
      url,
      status: resp.status,
      ok: resp.ok,
      finalUrl: resp.url,
      redirected: resp.url !== url,
    };
  } catch (e) {
    return { url, status: null, ok: false, error: e instanceof Error ? e.message : "fetch failed" };
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const urls: string[] = Array.isArray(body?.urls) ? body.urls.filter((u: string) => typeof u === "string") : [];
    if (!urls.length) return NextResponse.json({ error: "Thiếu URLs" }, { status: 400 });
    const limit = urls.slice(0, 50);
    const results = await Promise.all(limit.map(check));
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
