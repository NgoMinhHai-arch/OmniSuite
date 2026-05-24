import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/shared/lib/auth";
import { getGSCClient, normalizeSiteUrl } from "@/shared/lib/gsc";
import { getSystemConfig } from "@/shared/lib/config";

interface GscRequestBody {
  siteUrl?: string;
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
  startRow?: number;
  searchType?: string;
  type?: string;
  serviceAccountKey?: string;
  dimensionFilterGroups?: unknown[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: Request) {
  try {
    const session: any = await getServerSession(authOptions);
    const body = (await req.json()) as GscRequestBody;
    const sys = getSystemConfig();
    const siteUrl = body.siteUrl || sys.gsc_property_uri;
    if (!siteUrl) return NextResponse.json({ error: "Thiếu siteUrl (Property URI)" }, { status: 400 });
    if (!body.startDate || !body.endDate) return NextResponse.json({ error: "Thiếu startDate/endDate" }, { status: 400 });

    let client: any;
    if (body.serviceAccountKey || sys.gsc_service_account_key) {
      try {
        client = await getGSCClient("service", body.serviceAccountKey || sys.gsc_service_account_key);
      } catch {
        client = null;
      }
    }
    if (!client && session?.accessToken) {
      client = await getGSCClient("oauth", { access_token: session.accessToken });
    }
    if (!client) return NextResponse.json({ error: "Cần GSC Service Account hoặc đăng nhập Google." }, { status: 401 });

    const requestBody: Record<string, unknown> = {
      startDate: body.startDate,
      endDate: body.endDate,
      dimensions: body.dimensions || ["query"],
      rowLimit: body.rowLimit ?? 1000,
      startRow: body.startRow ?? 0,
    };
    if (body.searchType) requestBody.searchType = body.searchType;
    if (body.type) requestBody.type = body.type;
    if (body.dimensionFilterGroups) requestBody.dimensionFilterGroups = body.dimensionFilterGroups;

    const resp = await client.searchanalytics.query({
      siteUrl: normalizeSiteUrl(siteUrl),
      requestBody,
    });
    return NextResponse.json({ rows: resp.data?.rows || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi GSC" }, { status: 500 });
  }
}
