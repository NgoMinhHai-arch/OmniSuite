import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

/* eslint-disable @typescript-eslint/no-explicit-any */

const DATAFORSEO_BASE = 'https://api.dataforseo.com';

type DataForSeoCall = {
  ok: boolean;
  data?: any;
  cost?: number;
  error?: string;
};

function normalizeTarget(input: string) {
  const value = input.trim();
  if (!value) return '';

  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
  }
}

function toAuthHeader(user: string, pass: string) {
  return `Basic ${Buffer.from(`${user}:${pass}`, 'utf8').toString('base64')}`;
}

function taskItems(payload: any) {
  return payload?.tasks?.[0]?.result?.[0]?.items ?? [];
}

function taskResult(payload: any) {
  return payload?.tasks?.[0]?.result?.[0] ?? null;
}

function taskResults(payload: any) {
  return payload?.tasks?.[0]?.result ?? [];
}

function firstTaskItems(payload: any, taskIndex: number) {
  return payload?.tasks?.[taskIndex]?.result?.[0]?.items ?? [];
}

function findTargetRank(items: any[], target: string) {
  const targetPosition = items.find((item: any) => {
    const itemDomain = String(item?.domain || '').replace(/^www\./i, '').toLowerCase();
    return item?.type === 'organic' && (itemDomain === target || itemDomain.endsWith(`.${target}`));
  });

  return targetPosition
    ? {
        position: targetPosition.rank_absolute ?? targetPosition.rank_group ?? null,
        url: targetPosition.url ?? null,
      }
    : { position: null, url: null };
}

async function postDataForSeo(path: string, body: any[], authHeader: string): Promise<DataForSeoCall> {
  try {
    const response = await fetch(`${DATAFORSEO_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => null);
    const task = payload?.tasks?.[0];
    const statusCode = task?.status_code ?? payload?.status_code;

    if (!response.ok || (statusCode && statusCode !== 20000)) {
      return {
        ok: false,
        error: task?.status_message || payload?.status_message || `DataForSEO HTTP ${response.status}`,
        cost: task?.cost ?? payload?.cost ?? 0,
      };
    }

    return {
      ok: true,
      data: payload,
      cost: task?.cost ?? payload?.cost ?? 0,
    };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Cannot connect to DataForSEO' };
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'OmniSuite-AdvancedSEO/1.0',
      },
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function runQuickAudit(target: string) {
  const url = `https://${target}`;
  const issues: Array<{ label: string; status: 'pass' | 'warn' | 'fail'; detail: string }> = [];

  try {
    const pageResponse = await fetchWithTimeout(url);
    const html = await pageResponse.text();
    const $ = cheerio.load(html);
    const title = $('title').first().text().trim();
    const description = $('meta[name="description"]').attr('content')?.trim() || '';
    const canonical = $('link[rel="canonical"]').attr('href')?.trim() || '';
    const h1Count = $('h1').length;
    const viewport = $('meta[name="viewport"]').attr('content')?.trim() || '';
    const lang = $('html').attr('lang')?.trim() || '';
    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || '';

    issues.push({
      label: 'HTTP status',
      status: pageResponse.ok ? 'pass' : 'fail',
      detail: `${pageResponse.status} ${pageResponse.statusText}`,
    });
    issues.push({
      label: 'Title',
      status: title.length >= 30 && title.length <= 65 ? 'pass' : title ? 'warn' : 'fail',
      detail: title ? `${title.length} ký tự` : 'Thiếu title',
    });
    issues.push({
      label: 'Meta description',
      status: description.length >= 120 && description.length <= 170 ? 'pass' : description ? 'warn' : 'fail',
      detail: description ? `${description.length} ký tự` : 'Thiếu meta description',
    });
    issues.push({
      label: 'Canonical',
      status: canonical ? 'pass' : 'warn',
      detail: canonical || 'Chưa thấy canonical',
    });
    issues.push({
      label: 'H1',
      status: h1Count === 1 ? 'pass' : h1Count > 1 ? 'warn' : 'fail',
      detail: `${h1Count} thẻ H1`,
    });
    issues.push({
      label: 'Mobile viewport',
      status: viewport ? 'pass' : 'fail',
      detail: viewport || 'Thiếu viewport',
    });
    issues.push({
      label: 'HTML lang',
      status: lang ? 'pass' : 'warn',
      detail: lang || 'Chưa khai báo lang',
    });
    issues.push({
      label: 'Open Graph title',
      status: ogTitle ? 'pass' : 'warn',
      detail: ogTitle || 'Thiếu og:title',
    });
  } catch (error: any) {
    issues.push({
      label: 'Homepage crawl',
      status: 'fail',
      detail: error?.message || 'Không tải được homepage',
    });
  }

  try {
    const robots = await fetchWithTimeout(`https://${target}/robots.txt`, 8000);
    issues.push({
      label: 'robots.txt',
      status: robots.ok ? 'pass' : 'warn',
      detail: robots.ok ? 'Tìm thấy robots.txt' : `Không thấy robots.txt (${robots.status})`,
    });
  } catch {
    issues.push({ label: 'robots.txt', status: 'warn', detail: 'Không tải được robots.txt' });
  }

  try {
    const sitemap = await fetchWithTimeout(`https://${target}/sitemap.xml`, 8000);
    issues.push({
      label: 'sitemap.xml',
      status: sitemap.ok ? 'pass' : 'warn',
      detail: sitemap.ok ? 'Tìm thấy sitemap.xml' : `Không thấy sitemap.xml (${sitemap.status})`,
    });
  } catch {
    issues.push({ label: 'sitemap.xml', status: 'warn', detail: 'Không tải được sitemap.xml' });
  }

  const score = Math.round((issues.filter((issue) => issue.status === 'pass').length / Math.max(issues.length, 1)) * 100);
  return { score, issues };
}

export async function POST(req: Request) {
  try {
    const {
      domain,
      seedKeyword,
      trackingKeywords = [],
      includeAiVisibility = false,
      locationCode = 2704,
      languageCode = 'vi',
      limit = 25,
      dataforseoUser,
      dataforseoPass,
    } = await req.json();

    const target = normalizeTarget(domain || '');
    const keyword = String(seedKeyword || '').trim();
    const safeLimit = Math.min(100, Math.max(10, Number(limit) || 25));
    const rankKeywords = Array.from(
      new Set(
        [keyword, ...(Array.isArray(trackingKeywords) ? trackingKeywords : [])]
          .map((item) => String(item || '').trim())
          .filter(Boolean),
      ),
    ).slice(0, 10);

    if (!target) {
      return NextResponse.json({ error: 'Vui lòng nhập domain cần phân tích.' }, { status: 400 });
    }

    if (!dataforseoUser || !dataforseoPass) {
      return NextResponse.json({ error: 'Thiếu DataForSEO Login hoặc API Password trong Cấu hình hệ thống.' }, { status: 400 });
    }

    const authHeader = toAuthHeader(dataforseoUser, dataforseoPass);
    const location = Number(locationCode) || 2704;
    const language = String(languageCode || 'vi');
    const llmTarget = {
      domain: target,
      include_subdomains: true,
      search_filter: 'include',
      search_scope: ['any'],
    };

    const emptyDataForSeoCall: DataForSeoCall = { ok: true, data: null, cost: 0 };

    const [domainOverview, rankedKeywords, keywordIdeas, serpSnapshot, rankTracking, backlinks, backlinkRows, referringDomains, domainPages, aiGoogleMetrics, aiGoogleTopPages, aiChatGptMetrics, quickAudit] = await Promise.all([
      postDataForSeo('/v3/dataforseo_labs/google/domain_rank_overview/live', [
        { target, location_code: location, language_code: language, limit: 1 },
      ], authHeader),
      postDataForSeo('/v3/dataforseo_labs/google/ranked_keywords/live', [
        {
          target,
          location_code: location,
          language_code: language,
          limit: safeLimit,
          order_by: ['keyword_data.keyword_info.search_volume,desc'],
        },
      ], authHeader),
      keyword
        ? postDataForSeo('/v3/dataforseo_labs/google/keyword_suggestions/live', [
            {
              keyword,
              location_code: location,
              language_code: language,
              limit: safeLimit,
              include_clickstream_data: true,
              include_serp_info: true,
              include_seed_keyword: true,
              ignore_synonyms: false,
              exact_match: false,
            },
          ], authHeader)
        : Promise.resolve(emptyDataForSeoCall),
      keyword
        ? postDataForSeo('/v3/serp/google/organic/live/advanced', [
            {
              keyword,
              location_code: location,
              language_code: language,
              device: 'desktop',
              os: 'windows',
              depth: 50,
            },
          ], authHeader)
        : Promise.resolve(emptyDataForSeoCall),
      rankKeywords.length > 0
        ? postDataForSeo('/v3/serp/google/organic/live/advanced', rankKeywords.map((rankKeyword) => ({
            keyword: rankKeyword,
            location_code: location,
            language_code: language,
            device: 'desktop',
            os: 'windows',
            depth: 50,
          })), authHeader)
        : Promise.resolve(emptyDataForSeoCall),
      postDataForSeo('/v3/backlinks/summary/live', [
        {
          target,
          include_subdomains: true,
          include_indirect_links: true,
          exclude_internal_backlinks: true,
          backlinks_status_type: 'live',
          rank_scale: 'one_hundred',
        },
      ], authHeader),
      postDataForSeo('/v3/backlinks/backlinks/live', [
        {
          target,
          include_subdomains: true,
          include_indirect_links: true,
          exclude_internal_backlinks: true,
          backlinks_status_type: 'live',
          rank_scale: 'one_hundred',
          limit: Math.min(safeLimit, 50),
          order_by: ['rank,desc'],
        },
      ], authHeader),
      postDataForSeo('/v3/backlinks/referring_domains/live', [
        {
          target,
          include_subdomains: true,
          include_indirect_links: true,
          exclude_internal_backlinks: true,
          backlinks_status_type: 'live',
          rank_scale: 'one_hundred',
          limit: Math.min(safeLimit, 50),
          order_by: ['backlinks,desc'],
        },
      ], authHeader),
      postDataForSeo('/v3/backlinks/domain_pages_summary/live', [
        {
          target,
          include_subdomains: true,
          include_indirect_links: true,
          exclude_internal_backlinks: true,
          backlinks_status_type: 'live',
          rank_scale: 'one_hundred',
          limit: Math.min(safeLimit, 50),
          order_by: ['backlinks,desc'],
        },
      ], authHeader),
      includeAiVisibility
        ? postDataForSeo('/v3/ai_optimization/llm_mentions/aggregated_metrics/live', [
            {
              target: [llmTarget],
              platform: 'google',
              location_code: location,
              language_code: language,
              internal_list_limit: 10,
            },
          ], authHeader)
        : Promise.resolve(emptyDataForSeoCall),
      includeAiVisibility
        ? postDataForSeo('/v3/ai_optimization/llm_mentions/top_pages/live', [
            {
              target: [llmTarget],
              platform: 'google',
              location_code: location,
              language_code: language,
              links_scope: 'sources',
              items_list_limit: 10,
              internal_list_limit: 5,
            },
          ], authHeader)
        : Promise.resolve(emptyDataForSeoCall),
      includeAiVisibility
        ? postDataForSeo('/v3/ai_optimization/llm_mentions/aggregated_metrics/live', [
            {
              target: [llmTarget],
              platform: 'chat_gpt',
              location_code: 2840,
              language_code: 'en',
              internal_list_limit: 10,
            },
          ], authHeader)
        : Promise.resolve(emptyDataForSeoCall),
      runQuickAudit(target),
    ]);

    const overview = taskResult(domainOverview.data);
    const ranked = taskItems(rankedKeywords.data);
    const ideas = taskItems(keywordIdeas.data);
    const serp = taskItems(serpSnapshot.data);
    const backlinkSummary = taskResult(backlinks.data);
    const totalCost = [domainOverview, rankedKeywords, keywordIdeas, serpSnapshot, rankTracking, backlinks, backlinkRows, referringDomains, domainPages, aiGoogleMetrics, aiGoogleTopPages, aiChatGptMetrics]
      .reduce((sum, item) => sum + (item.cost || 0), 0);
    const rankChecks = rankKeywords.map((rankKeyword, index) => ({
      keyword: rankKeyword,
      ...findTargetRank(firstTaskItems(rankTracking.data, index), target),
    }));

    return NextResponse.json({
      target,
      seedKeyword: keyword,
      totalCost,
      partialErrors: {
        domainOverview: domainOverview.ok ? null : domainOverview.error,
        rankedKeywords: rankedKeywords.ok ? null : rankedKeywords.error,
        keywordIdeas: keywordIdeas.ok ? null : keywordIdeas.error,
        serpSnapshot: serpSnapshot.ok ? null : serpSnapshot.error,
        rankTracking: rankTracking.ok ? null : rankTracking.error,
        backlinks: backlinks.ok ? null : backlinks.error,
        backlinkRows: backlinkRows.ok ? null : backlinkRows.error,
        referringDomains: referringDomains.ok ? null : referringDomains.error,
        domainPages: domainPages.ok ? null : domainPages.error,
        aiGoogleMetrics: aiGoogleMetrics.ok ? null : aiGoogleMetrics.error,
        aiGoogleTopPages: aiGoogleTopPages.ok ? null : aiGoogleTopPages.error,
        aiChatGptMetrics: aiChatGptMetrics.ok ? null : aiChatGptMetrics.error,
      },
      overview,
      rankedKeywords: ranked,
      keywordIdeas: ideas,
      serp,
      backlinks: backlinkSummary,
      backlinkRows: taskResults(backlinkRows.data),
      referringDomains: taskResults(referringDomains.data),
      domainPages: taskResults(domainPages.data),
      rankCheck: findTargetRank(serp, target),
      rankChecks,
      aiVisibility: {
        enabled: Boolean(includeAiVisibility),
        google: taskResult(aiGoogleMetrics.data)?.total ?? null,
        googleTopPages: taskResult(aiGoogleTopPages.data)?.items ?? [],
        chatGpt: taskResult(aiChatGptMetrics.data)?.total ?? null,
      },
      quickAudit,
    });
  } catch (error: any) {
    console.error('Advanced SEO API Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
