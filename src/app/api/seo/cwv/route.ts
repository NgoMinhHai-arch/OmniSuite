import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { PLAYWRIGHT_HEADLESS, PLAYWRIGHT_LAUNCH_ARGS } from '@/shared/lib/playwright/config';

const RUN_TIMEOUT_MS = 25000;
const COLLECT_DELAY_MS = 5000;

type CwvScore = 'good' | 'needs-improvement' | 'poor';

type CwvResult = {
  url: string;
  ok: boolean;
  error?: string;
  LCP: number | null;
  CLS: number | null;
  FCP: number | null;
  TTFB: number | null;
  scoreLCP: CwvScore | null;
  scoreCLS: CwvScore | null;
  scoreFCP: CwvScore | null;
  scoreTTFB: CwvScore | null;
  overall: CwvScore | 'unknown';
};

function scoreLCP(value: number | null): CwvScore | null {
  if (value === null) return null;
  if (value <= 2500) return 'good';
  if (value <= 4000) return 'needs-improvement';
  return 'poor';
}

function scoreCLS(value: number | null): CwvScore | null {
  if (value === null) return null;
  if (value <= 0.1) return 'good';
  if (value <= 0.25) return 'needs-improvement';
  return 'poor';
}

function scoreFCP(value: number | null): CwvScore | null {
  if (value === null) return null;
  if (value <= 1800) return 'good';
  if (value <= 3000) return 'needs-improvement';
  return 'poor';
}

function scoreTTFB(value: number | null): CwvScore | null {
  if (value === null) return null;
  if (value <= 800) return 'good';
  if (value <= 1800) return 'needs-improvement';
  return 'poor';
}

function aggregate(scores: (CwvScore | null)[]): CwvScore | 'unknown' {
  const filtered = scores.filter((s): s is CwvScore => s !== null);
  if (!filtered.length) return 'unknown';
  if (filtered.some((s) => s === 'poor')) return 'poor';
  if (filtered.some((s) => s === 'needs-improvement')) return 'needs-improvement';
  return 'good';
}

async function runCwv(url: string): Promise<CwvResult> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    browser = await chromium.launch({
      headless: PLAYWRIGHT_HEADLESS,
      args: PLAYWRIGHT_LAUNCH_ARGS,
    });
    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 18000 }).catch(async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 });
    });

    try {
      await page.addScriptTag({ url: 'https://unpkg.com/web-vitals@4/dist/web-vitals.iife.js' });
    } catch {
      await page.addScriptTag({
        url: 'https://cdn.jsdelivr.net/npm/web-vitals@4/dist/web-vitals.iife.js',
      });
    }

    const metrics = await page.evaluate(
      (waitMs) =>
        new Promise<{ LCP?: number; CLS?: number; FCP?: number; TTFB?: number }>((resolve) => {
          const out: Record<string, number> = {};
          const wv = (window as unknown as { webVitals?: any }).webVitals;
          if (!wv) {
            setTimeout(() => resolve(out), waitMs);
            return;
          }
          try {
            wv.onLCP((m: any) => {
              out.LCP = m.value;
            });
            wv.onCLS((m: any) => {
              out.CLS = m.value;
            });
            wv.onFCP((m: any) => {
              out.FCP = m.value;
            });
            wv.onTTFB((m: any) => {
              out.TTFB = m.value;
            });
          } catch {}

          let scrolled = false;
          setTimeout(() => {
            if (!scrolled) {
              window.scrollTo(0, document.body.scrollHeight);
              scrolled = true;
              setTimeout(() => window.scrollTo(0, 0), 300);
            }
          }, 800);

          setTimeout(() => resolve(out), waitMs);
        }),
      COLLECT_DELAY_MS,
    );

    const LCP = typeof metrics?.LCP === 'number' ? Math.round(metrics.LCP) : null;
    const CLS = typeof metrics?.CLS === 'number' ? Number(metrics.CLS.toFixed(3)) : null;
    const FCP = typeof metrics?.FCP === 'number' ? Math.round(metrics.FCP) : null;
    const TTFB = typeof metrics?.TTFB === 'number' ? Math.round(metrics.TTFB) : null;

    const sLCP = scoreLCP(LCP);
    const sCLS = scoreCLS(CLS);
    const sFCP = scoreFCP(FCP);
    const sTTFB = scoreTTFB(TTFB);

    return {
      url,
      ok: true,
      LCP,
      CLS,
      FCP,
      TTFB,
      scoreLCP: sLCP,
      scoreCLS: sCLS,
      scoreFCP: sFCP,
      scoreTTFB: sTTFB,
      overall: aggregate([sLCP, sCLS, sFCP, sTTFB]),
    };
  } catch (err: any) {
    return {
      url,
      ok: false,
      error: err?.message || 'cwv failed',
      LCP: null,
      CLS: null,
      FCP: null,
      TTFB: null,
      scoreLCP: null,
      scoreCLS: null,
      scoreFCP: null,
      scoreTTFB: null,
      overall: 'unknown',
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'invalid url' }, { status: 400 });
    }

    const result = await Promise.race<CwvResult>([
      runCwv(url),
      new Promise<CwvResult>((resolve) =>
        setTimeout(() => {
          resolve({
            url,
            ok: false,
            error: 'timeout',
            LCP: null,
            CLS: null,
            FCP: null,
            TTFB: null,
            scoreLCP: null,
            scoreCLS: null,
            scoreFCP: null,
            scoreTTFB: null,
            overall: 'unknown',
          });
        }, RUN_TIMEOUT_MS),
      ),
    ]);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'unexpected error' }, { status: 500 });
  }
}
