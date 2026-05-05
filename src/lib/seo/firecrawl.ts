export interface FirecrawlScrapeResult {
  ok: boolean;
  url: string;
  markdown?: string;
  html?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

const BASE = "https://api.firecrawl.dev/v1";

export async function firecrawlScrape(
  apiKey: string,
  url: string,
  opts: { formats?: ("markdown" | "html")[]; onlyMainContent?: boolean; timeoutMs?: number } = {}
): Promise<FirecrawlScrapeResult> {
  if (!apiKey) return { ok: false, url, error: "Thiếu Firecrawl API key." };
  if (!url?.startsWith("http")) return { ok: false, url, error: "URL không hợp lệ." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);

  try {
    const resp = await fetch(`${BASE}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: opts.formats ?? ["markdown"],
        onlyMainContent: opts.onlyMainContent ?? true,
      }),
      signal: controller.signal,
    });

    const json = (await resp.json().catch(() => null)) as {
      success?: boolean;
      data?: { markdown?: string; html?: string; metadata?: Record<string, unknown> };
      error?: string;
    } | null;

    if (!resp.ok || !json?.success) {
      return { ok: false, url, error: json?.error || `Firecrawl HTTP ${resp.status}` };
    }

    return {
      ok: true,
      url,
      markdown: json.data?.markdown,
      html: json.data?.html,
      metadata: json.data?.metadata,
    };
  } catch (e) {
    return { ok: false, url, error: e instanceof Error ? e.message : "Firecrawl error" };
  } finally {
    clearTimeout(timeout);
  }
}
