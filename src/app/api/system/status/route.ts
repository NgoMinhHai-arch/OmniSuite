import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getSystemConfig, type SystemConfig } from '@/shared/lib/config';

export type SystemStatusPayload = {
  /** Đã có hiệu lực: dashboard (localStorage) HOẶC biến môi trường máy chủ */
  merged: Record<string, boolean>;
  /** Chỉ từ .env / biến môi trường (không tính key nhập trên dashboard) */
  envOnly: Record<string, boolean>;
  /** Nhịp tim dịch vụ lấy từ config/omnisuite.system.json */
  runtime?: RuntimeStatus;
};

type ServiceDef = {
  id: string;
  label?: string;
  port?: number;
  required?: boolean;
  managedBy?: string;
  healthUrl?: string;
  group?: string;
};

type SystemContract = {
  version?: number;
  app?: {
    name?: string;
    mode?: string;
    dashboardUrl?: string;
  };
  services?: ServiceDef[];
  commands?: Record<string, string>;
  setup?: {
    stateFile?: string;
    signatureFiles?: string[];
  };
};

type RuntimeStatus = {
  ok: boolean;
  app: SystemContract['app'];
  contractVersion: number;
  commands: Record<string, string>;
  setup: {
    state: unknown;
    signatureFiles: string[];
  };
  services: Array<ServiceDef & { status: string; httpStatus?: number; message?: string }>;
  requiredDown: Array<ServiceDef & { status: string; httpStatus?: number; message?: string }>;
  generatedAt: string;
};

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'config', 'omnisuite.system.json');

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

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function readSetupState(contract: SystemContract) {
  const rel = contract.setup?.stateFile || '.omnisuite/quick-start-state.json';
  return readJson(path.join(ROOT, rel), null);
}

async function probeService(service: ServiceDef) {
  if (service.managedBy) {
    return {
      ...service,
      status: 'managed',
      message: `Managed by ${service.managedBy}`,
    };
  }

  if (!service.healthUrl) {
    return {
      ...service,
      status: 'unknown',
      message: 'No healthUrl configured',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(service.healthUrl, {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return {
      ...service,
      status: response.ok ? 'online' : 'degraded',
      httpStatus: response.status,
    };
  } catch {
    clearTimeout(timeout);
    return {
      ...service,
      status: service.required ? 'offline' : 'optional-offline',
    };
  }
}

async function runtimeStatus(): Promise<RuntimeStatus> {
  const contract = readJson<SystemContract>(CONFIG_PATH, { services: [] });
  const services = await Promise.all((contract.services || []).map(probeService));
  const requiredDown = services.filter((service) => service.required && service.status !== 'online');

  return {
    ok: requiredDown.length === 0,
    app: contract.app || { name: 'OmniSuite AI' },
    contractVersion: contract.version || 1,
    commands: contract.commands || {},
    setup: {
      state: readSetupState(contract),
      signatureFiles: contract.setup?.signatureFiles || [],
    },
    services,
    requiredDown,
    generatedAt: new Date().toISOString(),
  };
}

/** Không có body: báo .env + nhịp tim service */
export async function GET() {
  const sys = getSystemConfig();
  const envOnly = envConfiguredFlags(sys);
  const payload: SystemStatusPayload = { merged: envOnly, envOnly, runtime: await runtimeStatus() };
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
    const payload: SystemStatusPayload = { merged, envOnly, runtime: await runtimeStatus() };
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ merged: {}, envOnly: {} } satisfies SystemStatusPayload, { status: 400 });
  }
}
