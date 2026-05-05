export interface SerpApiSearchOptions {
  query: string;
  engine?: string;
  hl?: string;
  gl?: string;
  num?: number;
  location?: string;
}

export interface SerpApiResponse {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

const BASE = "https://serpapi.com/search.json";

export async function serpApiSearch(apiKey: string, opts: SerpApiSearchOptions): Promise<SerpApiResponse> {
  if (!apiKey) return { ok: false, error: "Thiếu SerpApi key." };
  if (!opts.query?.trim()) return { ok: false, error: "Thiếu query." };

  const params = new URLSearchParams({
    api_key: apiKey,
    q: opts.query,
    engine: opts.engine || "google",
    hl: opts.hl || "vi",
    gl: opts.gl || "vn",
    num: String(opts.num ?? 20),
  });
  if (opts.location) params.set("location", opts.location);

  try {
    const resp = await fetch(`${BASE}?${params.toString()}`, { cache: "no-store" });
    const data = (await resp.json().catch(() => null)) as Record<string, unknown> | null;

    if (!resp.ok || !data) {
      const err = (data as { error?: string } | null)?.error || `SerpApi HTTP ${resp.status}`;
      return { ok: false, error: err };
    }
    if ((data as { error?: string }).error) {
      return { ok: false, error: (data as { error?: string }).error };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SerpApi error" };
  }
}
