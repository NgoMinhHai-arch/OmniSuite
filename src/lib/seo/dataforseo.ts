/* DataForSEO REST helper. Usage: const client = dataForSeoClient({ user, pass }); */

export interface DataForSeoCredentials {
  user?: string;
  pass?: string;
}

export interface DataForSeoCall<T = unknown> {
  ok: boolean;
  data?: T;
  cost?: number;
  error?: string;
}

const BASE = "https://api.dataforseo.com";

function authHeader(user: string, pass: string) {
  return `Basic ${Buffer.from(`${user}:${pass}`, "utf8").toString("base64")}`;
}

export function hasDataForSeo(creds: DataForSeoCredentials): boolean {
  return !!(creds.user && creds.pass);
}

export function dataForSeoClient(creds: DataForSeoCredentials) {
  const user = (creds.user || "").trim();
  const pass = (creds.pass || "").trim();
  const ready = !!(user && pass);
  const header = ready ? authHeader(user, pass) : "";

  async function post<T>(path: string, body: unknown[]): Promise<DataForSeoCall<T>> {
    if (!ready) {
      return { ok: false, error: "Thiếu DataForSEO login/password trong Cấu hình hệ thống." };
    }

    try {
      const resp = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: {
          Authorization: header,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      const payload = (await resp.json().catch(() => null)) as {
        tasks?: Array<{ status_code?: number; status_message?: string; cost?: number }>;
        status_code?: number;
        status_message?: string;
        cost?: number;
      } | null;

      const task = payload?.tasks?.[0];
      const statusCode = task?.status_code ?? payload?.status_code;

      if (!resp.ok || (statusCode && statusCode !== 20000)) {
        return {
          ok: false,
          error:
            task?.status_message ||
            payload?.status_message ||
            `DataForSEO HTTP ${resp.status}`,
          cost: task?.cost ?? payload?.cost ?? 0,
        };
      }

      return {
        ok: true,
        data: payload as unknown as T,
        cost: task?.cost ?? payload?.cost ?? 0,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "DataForSEO request failed";
      return { ok: false, error: msg };
    }
  }

  return { ready, post };
}

export function dfsItems(payload: unknown): unknown[] {
  const tasks = (payload as { tasks?: Array<{ result?: Array<{ items?: unknown[] }> }> })?.tasks;
  return tasks?.[0]?.result?.[0]?.items ?? [];
}

export function dfsResult<T = unknown>(payload: unknown): T | null {
  const tasks = (payload as { tasks?: Array<{ result?: T[] }> })?.tasks;
  return tasks?.[0]?.result?.[0] ?? null;
}
