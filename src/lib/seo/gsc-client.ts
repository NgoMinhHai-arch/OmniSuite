/* Minimal Google Search Console helper supporting:
 *  - Service-account JSON (server-side JWT exchange)
 *  - User OAuth bearer token (already in next-auth session)
 */

export type GscAuth =
  | { mode: "oauth"; accessToken: string }
  | { mode: "service_account"; serviceAccountJson: string };

export interface GscRequest {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: Array<"query" | "page" | "date" | "country" | "device" | "searchAppearance">;
  type?: "web" | "image" | "video" | "news" | "discover" | "googleNews";
  rowLimit?: number;
  startRow?: number;
  dimensionFilterGroups?: unknown[];
  searchType?: string;
}

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscResponse {
  ok: boolean;
  rows?: GscRow[];
  error?: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = "https://www.googleapis.com/auth/webmasters.readonly";

function base64UrlEncode(buf: Uint8Array | string): string {
  const data = typeof buf === "string" ? Buffer.from(buf, "utf8") : Buffer.from(buf);
  return data.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessTokenFromServiceAccount(jsonStr: string): Promise<string> {
  const sa = JSON.parse(jsonStr) as { client_email: string; private_key: string };
  if (!sa.client_email || !sa.private_key) {
    throw new Error("Service account JSON thiếu client_email hoặc private_key.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPES,
      aud: TOKEN_URL,
      exp: now + 3600,
      iat: now,
    })
  );

  const { createSign } = await import("crypto");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signatureRaw = signer.sign(sa.private_key);
  const signature = base64UrlEncode(signatureRaw);
  const assertion = `${header}.${payload}.${signature}`;

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  const data = (await resp.json().catch(() => null)) as { access_token?: string; error?: string; error_description?: string } | null;
  if (!resp.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || `Không lấy được access token (${resp.status}).`);
  }
  return data.access_token;
}

async function resolveAccessToken(auth: GscAuth): Promise<string> {
  if (auth.mode === "oauth") return auth.accessToken;
  return getAccessTokenFromServiceAccount(auth.serviceAccountJson);
}

export async function searchAnalyticsQuery(auth: GscAuth, req: GscRequest): Promise<GscResponse> {
  if (!req.siteUrl) return { ok: false, error: "Thiếu siteUrl (Property URI)." };
  let token: string;
  try {
    token = await resolveAccessToken(auth);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Auth GSC thất bại." };
  }

  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(req.siteUrl)}/searchAnalytics/query`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: req.startDate,
        endDate: req.endDate,
        dimensions: req.dimensions,
        rowLimit: req.rowLimit ?? 1000,
        startRow: req.startRow ?? 0,
        searchType: req.searchType,
        type: req.type,
        dimensionFilterGroups: req.dimensionFilterGroups,
      }),
      cache: "no-store",
    });
    const data = (await resp.json().catch(() => null)) as { rows?: GscRow[]; error?: { message?: string } } | null;
    if (!resp.ok) {
      return { ok: false, error: data?.error?.message || `GSC HTTP ${resp.status}` };
    }
    return { ok: true, rows: data?.rows || [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "GSC request error" };
  }
}
