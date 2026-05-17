import { NextResponse } from "next/server";
import { getInterpreterUrl } from "@/shared/lib/interpreter-url";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const pyRes = await fetch(`${getInterpreterUrl()}/api/analyze-single`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!pyRes.ok) {
      const errText = await pyRes.text();
      return NextResponse.json({ error: `Python Backend Error: ${errText}` }, { status: pyRes.status });
    }

    const data = await pyRes.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Analyze Single API] Error:", message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
