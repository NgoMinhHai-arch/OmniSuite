/**
 * Kiểm tra thư mục integration trên đĩa + format bảng cho /tai-bang.
 */
import fs from 'node:fs';
import path from 'node:path';
import { INTEGRATIONS } from '@/modules/ai-support/domain/integrations-registry';
import type { IntegrationEntry } from '@/modules/ai-support/domain/integrations-registry.types';

export interface IntegrationDiskStatus {
  id: string;
  name: string;
  path: string;
  cloned: boolean;
  ready: boolean;
  slashCommand: string | null;
}

function resolveFromRoot(root: string, relPath: string): string {
  return path.join(root, relPath.replace(/\//g, path.sep));
}

/** Giống logic scripts/lib/ensure-integration.js — chỉ kiểm tra filesystem. */
export function checkIntegrationDiskStatus(root: string, entry: IntegrationEntry): {
  cloned: boolean;
  ready: boolean;
} {
  const base = resolveFromRoot(root, entry.path);
  if (!fs.existsSync(base)) {
    return { cloned: false, ready: false };
  }

  let hasContent = false;
  try {
    hasContent = fs.readdirSync(base).filter((n) => n !== '.gitkeep' && n !== '.git').length > 0;
  } catch {
    return { cloned: false, ready: false };
  }

  if (!hasContent) {
    return { cloned: false, ready: false };
  }

  const probeStr = entry.probe?.args?.join(' ') || '';
  const pathMatch = /pathlib\.Path\("([^"]+)"\)/.exec(probeStr);
  if (pathMatch) {
    const marker = resolveFromRoot(root, pathMatch[1]);
    return { cloned: true, ready: fs.existsSync(marker) };
  }

  if (entry.id === 'open_manus') {
    return {
      cloned: true,
      ready: fs.existsSync(path.join(base, 'app', 'agent', 'manus.py')),
    };
  }
  if (entry.id === 'browser_use') {
    return {
      cloned: true,
      ready:
        fs.existsSync(path.join(base, 'browser_use')) ||
        fs.existsSync(path.join(base, 'pyproject.toml')),
    };
  }
  if (entry.id === 'crawl4ai') {
    return {
      cloned: true,
      ready:
        fs.existsSync(path.join(base, 'crawl4ai')) ||
        fs.existsSync(path.join(base, 'pyproject.toml')),
    };
  }
  if (entry.id === 'activepieces') {
    return {
      cloned: true,
      ready:
        fs.existsSync(path.join(base, 'package.json')) ||
        fs.existsSync(path.join(base, 'docker-compose.yml')),
    };
  }

  if (entry.id === 'job_scraper') {
    return {
      cloned: true,
      ready: fs.existsSync(path.join(base, 'llm_client.py')) || hasContent,
    };
  }

  return { cloned: true, ready: hasContent };
}

export function listIntegrationDiskStatuses(root: string): IntegrationDiskStatus[] {
  return INTEGRATIONS.map((it) => {
    const disk = checkIntegrationDiskStatus(root, it);
    return {
      id: it.id,
      name: it.name,
      path: it.path,
      cloned: disk.cloned,
      ready: disk.ready,
      slashCommand: it.slashCommand ?? null,
    };
  });
}

function padCell(text: string, width: number): string {
  const t = text.length > width ? `${text.slice(0, width - 1)}…` : text;
  return t.padEnd(width, ' ');
}

/** Bảng monospace cho Quản gia /tai-bang. */
export function buildIntegrationsStatusTable(root: string): string {
  const rows = listIntegrationDiskStatuses(root);
  const downloaded = rows.filter((r) => r.cloned);
  const notDownloaded = rows.filter((r) => !r.cloned);

  const colId = 16;
  const colName = 28;
  const colDisk = 10;
  const colReady = 10;
  const colSlash = 14;
  const colFetch = 36;

  const header =
    `| ${padCell('ID', colId)} | ${padCell('Tên', colName)} | ${padCell('Đã tải', colDisk)} | ${padCell('Sẵn sàng', colReady)} | ${padCell('Slash', colSlash)} | ${padCell('Lệnh tải', colFetch)} |`;
  const sep =
    `|${'-'.repeat(colId + 2)}|${'-'.repeat(colName + 2)}|${'-'.repeat(colDisk + 2)}|${'-'.repeat(colReady + 2)}|${'-'.repeat(colSlash + 2)}|${'-'.repeat(colFetch + 2)}|`;

  const formatRow = (r: IntegrationDiskStatus) => {
    const diskLabel = r.cloned ? '✓ Đã tải' : '✗ Chưa';
    const readyLabel = !r.cloned ? '—' : r.ready ? '✓ OK' : '○ Một phần';
    const slash = r.slashCommand ?? '—';
    let fetch = '—';
    if (!r.cloned) {
      if (r.id === 'open_manus' || r.id === 'browser_use') {
        fetch = `npm run integrations:fetch -- ${r.id}`;
      } else if (r.id === 'crawl4ai' || r.id === 'activepieces') {
        fetch = `npm run integrations:fetch -- ${r.id}`;
      } else if (r.id === 'job_scraper') {
        fetch = '(có trong repo OmniSuite)';
      } else {
        fetch = `git clone → ${r.path}`;
      }
    }
    return `| ${padCell(r.id, colId)} | ${padCell(r.name, colName)} | ${padCell(diskLabel, colDisk)} | ${padCell(readyLabel, colReady)} | ${padCell(slash, colSlash)} | ${padCell(fetch, colFetch)} |`;
  };

  const lines: string[] = [
    'BẢNG TRẠNG THÁI TẢI INTEGRATION',
    '',
    `Tổng: ${rows.length} · Đã tải: ${downloaded.length} · Chưa tải: ${notDownloaded.length}`,
    '',
    header,
    sep,
    ...rows.map(formatRow),
    '',
    'Ghi chú:',
    '• Đã tải = thư mục integrations/... có nội dung (hoặc có sẵn trong repo).',
    '• Sẵn sàng = file marker chính đã có (vd. manus.py, crawl4ai package).',
    '• open_manus / browser_use: lần đầu /run hoặc /run-browser cũng tự tải.',
    '• Crawl4AI + Activepieces: lõi cào web / workflow — npm run integrations:fetch -- <id>',
    '• Danh sách đầy đủ + GitHub: /integrations · Hướng dẫn: /tai',
  ];

  if (notDownloaded.length > 0 && notDownloaded.length <= 8) {
    lines.push('', 'Chưa tải (tóm tắt):', ...notDownloaded.map((r) => `  - ${r.id} → ${r.path}`));
  }

  return lines.join('\n');
}
