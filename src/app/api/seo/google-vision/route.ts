import { NextResponse } from "next/server";
import { getSystemConfig } from "@/shared/lib/config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiKey = body?.apiKey || getSystemConfig().google_vision_api_key;
    if (!apiKey) return NextResponse.json({ error: "Thiếu Google Vision API key" }, { status: 400 });
    const imageUrl: string = (body?.imageUrl || "").trim();
    if (!imageUrl) return NextResponse.json({ error: "Thiếu imageUrl" }, { status: 400 });
    const features = (body?.features as string[]) || ["IMAGE_PROPERTIES", "WEB_DETECTION"];

    const resp = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { source: { imageUri: imageUrl } },
            features: features.map((t) => ({ type: t, maxResults: 10 })),
          },
        ],
      }),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) return NextResponse.json({ error: (data && data.error?.message) || `Vision HTTP ${resp.status}` }, { status: 502 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Lỗi" }, { status: 500 });
  }
}
