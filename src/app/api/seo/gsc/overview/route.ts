import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/shared/lib/auth";
import { getGSCClient, getSiteStats, getGSCPropertyOverview, getGSCPageMetrics, getGSCCannibalization } from '@/shared/lib/gsc';

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
    const useOAuth = !!body.useOAuth;

    // 1. Authentication (Service Account or OAuth)
    // If useOAuth is true, we ONLY try OAuth first.
    if (useOAuth && session?.accessToken) {
      try {
        client = await getGSCClient('oauth', { access_token: session.accessToken });
      } catch (e) {
        console.warn("OAuth failed, falling back to service account...");
      }
    }

    if (!client && (body.serviceAccountKey || process.env.GSC_SERVICE_ACCOUNT_JSON)) {
      try {
        client = await getGSCClient('service', body.serviceAccountKey);
      } catch (e) {
        console.warn("Service account failed, falling back to OAuth if available...");
      }
    }

    if (!client && !useOAuth && session?.accessToken) {
      client = await getGSCClient('oauth', { access_token: session.accessToken });
    }

    if (!client) {
      return NextResponse.json({ error: 'Authentication needed' }, { status: 401 });
    }

    // 2. Fetch all required data in parallel
    let stats, overview, pageMetrics, cannibalData;
    const runQueries = async (activeClient: any) => {
      return await Promise.all([
        getSiteStats(activeClient, siteUrl).catch(err => {
          if (err.message.includes('403') || err.message.includes('permission')) {
             throw new Error("Không có quyền truy cập Property này. Hãy kiểm tra lại Property URI.");
          }
          if (err.message.includes('404') || err.message.includes('not found')) {
             throw new Error("Property URI không tồn tại trong tài khoản GSC.");
          }
          throw err;
        }),
        getGSCPropertyOverview(activeClient, siteUrl),
        getGSCPageMetrics(activeClient, siteUrl),
        getGSCCannibalization(activeClient, siteUrl)
      ]);
    };

    try {
      [stats, overview, pageMetrics, cannibalData] = await runQueries(client);
    } catch (parallelErr: any) {
      const hasServiceAccount = !!(body.serviceAccountKey || process.env.GSC_SERVICE_ACCOUNT_JSON);

      if (useOAuth && hasServiceAccount && isInvalidAuthError(parallelErr)) {
        try {
          const serviceClient = await getGSCClient('service', body.serviceAccountKey);
          [stats, overview, pageMetrics, cannibalData] = await runQueries(serviceClient);
        } catch (fallbackErr: any) {
          return NextResponse.json({ 
            error: fallbackErr.message || 'GSC API query failed',
            details: 'OAuth token hết hạn/không hợp lệ và fallback Service Account thất bại.'
          }, { status: 400 });
        }
      } else if (useOAuth && !hasServiceAccount && isInvalidAuthError(parallelErr)) {
        return NextResponse.json({
          error: 'Google OAuth token has expired or is invalid. Please re-login.',
          code: 'TOKEN_EXPIRED',
          details: 'Vui lòng đăng xuất/đăng nhập lại Google để cấp mới quyền Search Console.'
        }, { status: 401 });
      } else {
        return NextResponse.json({ 
          error: parallelErr.message || 'GSC API query failed',
          details: 'Vui lòng kiểm tra lại Property URI hoặc quyền truy cập của Service Account/OAuth.'
        }, { status: 400 });
      }
    }

    // 3. Process Cannibalization
    const cannibalResults: any[] = [];
    if (cannibalData && Array.isArray(cannibalData)) {
      const cannibalMap: Record<string, any[]> = {};
      cannibalData.forEach((row: any) => {
        const q = row.keys[0];
        const p = row.keys[1];
        if (!cannibalMap[q]) cannibalMap[q] = [];
        cannibalMap[q].push({ url: p, clicks: row.clicks });
      });

      Object.entries(cannibalMap)
        .filter(([q, pages]) => pages.length > 1 && pages.some(p => p.clicks > 2)) 
        .map(([q, pages]) => {
          const sorted = pages.sort((a, b) => b.clicks - a.clicks);
          return {
            keyword: q,
            url1: sorted[0].url,
            clicks1: sorted[0].clicks,
            url2: sorted[1].url,
            clicks2: sorted[1].clicks
          };
        })
        .slice(0, 10)
        .forEach(res => cannibalResults.push(res));
    }

    // 4. Process Page Metrics / Decay
    const activePagesCount = pageMetrics ? pageMetrics.length : 0;
    const decayResults = (pageMetrics || [])
      .filter((r: any) => r.clicks > 10 && r.ctr < 0.01)
      .sort((a: any, b: any) => a.ctr - b.ctr)
      .map((r: any) => ({
        url: r.keys[0],
        prevTraffic: Math.round(r.clicks * 1.5),
        drop: Math.round((1 - (r.ctr / 0.05)) * 100)
      }))
      .slice(0, 10);

    return NextResponse.json({
      siteUrl,
      stats: stats || [],
      overview: overview || { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      activePagesCount,
      cannibalization: cannibalResults,
      decay: decayResults,
      authenticated_via: body.serviceAccountKey || process.env.GSC_SERVICE_ACCOUNT_JSON ? 'service_account' : 'oauth'
    });

  } catch (error: any) {
    console.error('GSC Overview API Error:', error);
    return NextResponse.json({ 
      error: 'Lỗi hệ thống khi xử lý dữ liệu GSC', 
      details: error.message 
    }, { status: 500 });
  }
}
