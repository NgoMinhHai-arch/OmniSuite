import { NextRequest, NextResponse } from "next/server";
import {
  fetchPageMainText,
  pageAlreadyLinksTo,
  pickSentenceWithKeyword,
} from "@/lib/seo/fetch-page-content";

interface Body {
  urls?: string[];
  targetKeyword?: string;
  moneyPageUrl?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const rawUrls = Array.isArray(body.urls) ? body.urls : [];
    const urls = rawUrls
      .map((u) => String(u).trim())
      .filter((u) => u.startsWith("http"))
      .slice(0, 12);

    const targetKeyword = (body.targetKeyword || "").trim();
    if (urls.length < 2) {
      return NextResponse.json(
        { error: "Cần ít nhất 2 URL hợp lệ (http/https)." },
        { status: 400 }
      );
    }
    if (!targetKeyword) {
      return NextResponse.json({ error: "Thiếu từ khóa mục tiêu." }, { status: 400 });
    }

    let moneyPage =
      (body.moneyPageUrl || "").trim() ||
      urls[urls.length - 1] ||
      urls[0];

    if (!moneyPage.startsWith("http")) {
      return NextResponse.json({ error: "Money page URL không hợp lệ." }, { status: 400 });
    }

    const sources = urls.filter((u) => u !== moneyPage);
    if (sources.length === 0) {
      return NextResponse.json(
        { error: "Danh sách URL phải có ít nhất một trang nguồn khác money page." },
        { status: 400 }
      );
    }

    const moneyFetch = await fetchPageMainText(moneyPage);
    if (!moneyFetch.ok) {
      return NextResponse.json(
        { error: `Không tải được money page: ${moneyFetch.error}` },
        { status: 502 }
      );
    }

    const suggestions: Array<{
      sourceUrl: string;
      targetUrl: string;
      anchorText: string;
      context: string;
      score: number;
    }> = [];

    for (const sourceUrl of sources) {
      const page = await fetchPageMainText(sourceUrl);
      if (!page.ok) continue;

      const hay = page.text.toLowerCase();
      const needle = targetKeyword.toLowerCase();
      if (!hay.includes(needle)) continue;

      if (pageAlreadyLinksTo(page.html, moneyPage)) continue;

      const ctx = pickSentenceWithKeyword(page.text, targetKeyword);
      const titleBoost = page.title?.toLowerCase().includes(needle) ? 12 : 0;
      const h1Boost = page.h1?.toLowerCase().includes(needle) ? 8 : 0;
      const lenPenalty = Math.min(15, Math.max(0, ctx.length / 40));
      const score = Math.min(
        98,
        Math.max(
          52,
          65 + titleBoost + h1Boost - Math.round(lenPenalty)
        )
      );

      suggestions.push({
        sourceUrl,
        targetUrl: moneyPage,
        anchorText: targetKeyword,
        context:
          ctx ||
          `Thêm liên kết tới trang đích khi nhắc tới “${targetKeyword}”.`,
        score,
      });
    }

    suggestions.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      moneyPageUrl: moneyPage,
      keyword: targetKeyword,
      suggestions,
      moneyTitle: moneyFetch.title,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lỗi máy chủ";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
