import { NextResponse } from "next/server";
import { getInterpreterUrl } from "@/shared/lib/interpreter-url";
import { logger } from "@/shared/lib/logger";
import { internalTokenHeaders } from "@/shared/lib/server/internal-token";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${getInterpreterUrl()}/api/task/cancel`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...internalTokenHeaders()
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({ status: res.ok ? "cancelled" : "error" }));
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[Interpreter Cancel API] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
