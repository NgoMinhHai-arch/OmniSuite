import { NextResponse } from "next/server";
import { getInterpreterUrl } from "@/shared/lib/interpreter-url";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${getInterpreterUrl()}/api/task/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({ status: res.ok ? "cancelled" : "error" }));
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
