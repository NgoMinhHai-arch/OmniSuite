/**
 * GET /api/ai-support/integrations
 * Báo cáo trạng thái thực tế của các integration đã clone trong `integrations/`.
 *
 * Trả về (cho mỗi entry trong INTEGRATIONS):
 *   - cloned    : path tồn tại trên đĩa không
 *   - probeOk   : nếu có `probe`, lệnh probe trả về exit 0?
 *   - probeOut  : đoạn cuối stdout/stderr (cắt ngắn)
 * Cộng với metadata gốc (name, features, setupHint, slashCommand, ...).
 */

import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { INTEGRATIONS } from '@/modules/ai-support/domain/integrations-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function probeOnce(bin: string, args: string[], timeoutMs = 4000): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: { ok: boolean; out: string }) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(bin, args, { windowsHide: true, shell: process.platform === 'win32' });
    } catch (err) {
      finish({ ok: false, out: err instanceof Error ? err.message : String(err) });
      return;
    }
    let buf = '';
    child.stdout?.on('data', (c: Buffer) => { buf += c.toString('utf-8'); });
    child.stderr?.on('data', (c: Buffer) => { buf += c.toString('utf-8'); });
    const killer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* noop */ }
      finish({ ok: false, out: buf.trim().slice(-400) || 'timeout' });
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(killer);
      finish({ ok: false, out: err.message });
    });
    child.on('close', (code) => {
      clearTimeout(killer);
      finish({ ok: code === 0, out: buf.trim().slice(-400) });
    });
  });
}

export async function GET() {
  const root = process.cwd();
  const items = await Promise.all(
    INTEGRATIONS.map(async (it) => {
      const abs = path.resolve(root, it.path);
      let cloned = false;
      try {
        cloned = fs.existsSync(abs) && fs.statSync(abs).isDirectory();
      } catch {
        cloned = false;
      }
      let probeOk: boolean | null = null;
      let probeOut = '';
      if (cloned && it.probe) {
        const r = await probeOnce(it.probe.bin, it.probe.args);
        probeOk = r.ok;
        probeOut = r.out;
      }
      return {
        id: it.id,
        name: it.name,
        path: it.path,
        kind: it.kind,
        integrationStrategy: it.integrationStrategy,
        slashCommand: it.slashCommand ?? null,
        features: it.features,
        setupHint: it.setupHint,
        cloned,
        probeOk,
        probeOut,
      };
    }),
  );
  return NextResponse.json({
    root,
    count: items.length,
    items,
  });
}
