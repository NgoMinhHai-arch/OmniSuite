import { NextResponse } from 'next/server';
import { scrapeGoogleMapsPlaywright, scrapeGoogleMapsSerpApi, MapsRow } from '@/modules/maps/services/mapsService';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { keyword, maxResults = 20, mode = 'playwright', provider = 'serpapi', apiKey, deepScan = false } = await req.json();

    if (!keyword) {
      return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        const onLog = (message: string) => send({ type: 'log', message });
        const onRow = (row: MapsRow) => send({ type: 'row', data: row });

        try {
          onLog(`🚀 Bắt đầu quét Maps cho từ khóa: "${keyword}"`);

          if (mode === 'playwright') {
            await scrapeGoogleMapsPlaywright({ keyword, maxResults, deepScan, onRow, onLog });
          } else {
            if (!apiKey) {
              onLog(`❌ Lỗi: Thiếu API Key cho chế độ ${provider}`);
            } else {
              let rows: MapsRow[] = [];
              if (provider === 'serpapi') {
                rows = await scrapeGoogleMapsSerpApi({ keyword, apiKey, maxResults });
              } else {
                onLog(`❌ Lỗi: Nhà cung cấp ${provider} chưa được hỗ trợ.`);
              }

              if (rows.length > 0) {
                if (deepScan) {
                  onLog(`📋 Lấy được ${rows.length} kết quả từ API. Bắt đầu Deep Scan...`);
                  const { chromium } = await import('playwright');
                  const browser = await chromium.launch({ headless: true });
                  try {
                    const { discoverWebPresence, findEmailFromWebsite } = await import('@/modules/maps/services/mapsService');
                    for (const row of rows) {
                      onLog(`🔍 Thu thập web/social cho: ${row.name}...`);
                      const found = await discoverWebPresence(row.name, row.address, row.phone, browser);

                      row.web_sources = Array.from(new Set([...(row.web_sources || []), ...(found.links || [])])).slice(0, 8);
                      if (!row.url_web) {
                        row.url_web = found.primaryWebsite || row.web_sources.find((u) => !/facebook|instagram|tiktok|zalo|youtube|linkedin|x\.com|twitter/i.test(u)) || row.web_sources[0] || '';
                      }

                      if (row.url_web || (row.web_sources && row.web_sources.length > 0)) {
                        const targets = Array.from(new Set([row.url_web, ...(row.web_sources || [])])).filter(Boolean).slice(0, 4);
                        for (const target of targets) {
                          onLog(`📧 Tìm Email từ: ${target}...`);
                          row.email = await findEmailFromWebsite(target, browser);
                          if (row.email) break;
                        }
                      }

                      onRow(row);
                    }
                  } finally {
                    await browser.close();
                  }
                } else {
                  rows.forEach(onRow);
                }
              } else {
                onLog('⚠️ Không tìm thấy kết quả nào từ API.');
              }
            }
          }

          send({ type: 'done', message: 'Hoàn thành!' });
        } catch (err: any) {
          onLog(`💥 Lỗi hệ thống: ${err.message}`);
          send({ type: 'error', message: err.message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Maps Scrape Route Error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
