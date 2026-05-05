import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/shared/lib/auth";
import { getGSCClient, getSiteStats } from '@/shared/lib/gsc';

function isInvalidAuthError(err: any): boolean {
  const message = String(err?.message || '').toLowerCase();
  const status = err?.status || err?.code || err?.response?.status;
  return status === 401 || message.includes('invalid authentication credentials') || message.includes('invalid_grant') || message.includes('unauthenticated');
}

export async function POST(req: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions);
    const body = await req.json();
    const siteUrl = body.siteUrl || process.env.DEFAULT_GSC_PROPERTY_URI;

    if (!siteUrl) {
      return NextResponse.json({ error: 'Site URL (Property URI) is required' }, { status: 400 });
    }

    let client;

    // 1. Try Service Account (Global Default or User Provided)
    if (body.serviceAccountKey || process.env.GSC_SERVICE_ACCOUNT_JSON) {
      try {
        client = await getGSCClient('service', body.serviceAccountKey);
      } catch (e) {
        console.warn("Service account failed, falling back to OAuth if available...");
      }
    }

    // 2. Fallback to OAuth if session has tokens
    if (!client && session?.accessToken) {
      client = await getGSCClient('oauth', { access_token: session.accessToken });
    }

    if (!client) {
      return NextResponse.json({ 
        error: 'Authentication needed', 
        details: 'No global Service Account found and user is not authenticated with Google.' 
      }, { status: 401 });
    }

    let stats;
    try {
      stats = await getSiteStats(client, siteUrl);
    } catch (queryErr: any) {
      const hasServiceAccount = !!(body.serviceAccountKey || process.env.GSC_SERVICE_ACCOUNT_JSON);
      if (!hasServiceAccount && isInvalidAuthError(queryErr)) {
        return NextResponse.json({
          error: 'Google OAuth token has expired or is invalid',
          details: 'Vui lòng đăng xuất/đăng nhập lại Google để cấp mới quyền Search Console.'
        }, { status: 401 });
      }
      throw queryErr;
    }
    
    return NextResponse.json({
      siteUrl,
      stats,
      authenticated_via: body.serviceAccountKey || process.env.GSC_SERVICE_ACCOUNT_JSON ? 'service_account' : 'oauth'
    });

  } catch (error: any) {
    console.error('GSC API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch GSC data', 
      details: error.message 
    }, { status: 500 });
  }
}
