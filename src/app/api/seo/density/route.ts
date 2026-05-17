import { NextResponse } from "next/server";
import { getPythonEngineUrl } from "@/shared/lib/python-engine-url";

export async function POST(req: Request) {
  try {
    const { keyword, url } = await req.json();
    if (!keyword) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const engine = getPythonEngineUrl();
    const response = await fetch(`${engine}/api/seo/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, keyword }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: "SEO analyze failed", detail }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ audit: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Audit API Error:", message);
    return NextResponse.json({ error: "Internal Server Error", details: message }, { status: 500 });
  }
}
