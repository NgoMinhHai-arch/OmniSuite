import NextAuth from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const handler = NextAuth(authOptions);

export async function GET(request: NextRequest, { params }: any) {
  try {
    const awaitedParams = await params;
    return await handler(request, { params: awaitedParams });
  } catch (error: any) {
    console.error("NextAuth GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: any) {
  try {
    const awaitedParams = await params;
    return await handler(request, { params: awaitedParams });
  } catch (error: any) {
    console.error("NextAuth POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
