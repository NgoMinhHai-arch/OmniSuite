import { NextResponse } from 'next/server';
import { getSystemConfig, type SystemConfig } from '@/shared/lib/config';

export type SystemStatusPayload = {
  /** Đã có hiệu lực: dashboard (localStorage) HOẶC biến môi trường máy chủ */
  merged: Record<string, boolean>;
  /** Chỉ từ .env / biến môi trường (không tính key nhập trên dashboard) */
  envOnly: Record<string, boolean>;
};

function envConfiguredFlags(config: SystemConfig): Record<string, boolean> {
  const status: Record<string, boolean> = {};
  Object.entries(config).forEach(([key, value]) => {
    status[key] = typeof value === 'string' ? value.trim().length > 0 : !!value;
  });
  return status;
}

function normalizeClientKeys(raw: unknown): Record<string, string | boolean> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

function effectiveFlags(
  envOnly: Record<string, boolean>,
  client: Record<string, string | boolean>,
): Record<string, boolean> {
  const merged = { ...envOnly };
  for (const [k, v] of Object.entries(client)) {
    if (typeof v === 'string' && v.trim()) merged[k] = true;
    else if (v === true) merged[k] = true;
  }
  return merged;
}

/** Không có body: chỉ báo .env — dùng khi không muốn gửi snapshot dashboard */
export async function GET() {
  const sys = getSystemConfig();
  const envOnly = envConfiguredFlags(sys);
  const payload: SystemStatusPayload = { merged: envOnly, envOnly };
  return NextResponse.json(payload);
}

/** Body: `{ keys: omnisuite_settings }` — trộn key dashboard + .env để UI hiển thị đúng */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const client = normalizeClientKeys(body.keys);
    const sys = getSystemConfig();
    const envOnly = envConfiguredFlags(sys);
    const merged = effectiveFlags(envOnly, client);
    const payload: SystemStatusPayload = { merged, envOnly };
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ merged: {}, envOnly: {} } satisfies SystemStatusPayload, { status: 400 });
  }
}
