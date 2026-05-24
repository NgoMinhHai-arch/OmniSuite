/**
 * Integrations catalog — data from integrations/manifest.json (SSOT).
 *
 * Chỉnh sửa manifest → `npm run integrations:codegen`.
 * Prompt helpers giữ tại file này (không generate).
 */

export type {
  IntegrationEntry,
  IntegrationKind,
  IntegrationStrategy,
  IntegrationCategory,
} from './integrations-registry.types';
export { INTEGRATIONS } from './integrations-registry.generated';

import { INTEGRATIONS } from './integrations-registry.generated';
import type { IntegrationCategory, IntegrationEntry } from './integrations-registry.types';
import { buildIntegrationsDownloadPreamble } from './integration-download-guide';

/** GitHub + clone cho mục gốc (manifest không đổi) — chỉ phục vụ hiển thị /integrations. */
const INTEGRATION_REPO_META: Record<string, { repository: string; cloneHint: string }> = {
  open_manus: {
    repository: 'https://github.com/FoundationAgents/OpenManus',
    cloneHint:
      'npm run integrations:fetch -- open_manus  (hoặc git clone https://github.com/FoundationAgents/OpenManus.git integrations/ai-support/submodules/open-manus)',
  },
  browser_use: {
    repository: 'https://github.com/browser-use/browser-use',
    cloneHint:
      'npm run integrations:fetch -- browser_use  (hoặc git clone https://github.com/browser-use/browser-use.git integrations/ai-support/submodules/browser-use)',
  },
  applypilot: {
    repository: 'https://github.com/Pickle-Pixel/ApplyPilot',
    cloneHint:
      'pip install applypilot  ·  hoặc git clone https://github.com/Pickle-Pixel/ApplyPilot.git integrations/applypilot',
  },
  job_scraper: {
    repository: 'https://github.com/NgoMinhHai-arch/OmniSuite (integrations/job-scraper)',
    cloneHint: 'Đã nằm trong repo OmniSuite — dùng /score sau khi setup venv runners',
  },
  ai_resume_tailor: {
    repository: 'https://github.com/workopia/ai-resume-tailor',
    cloneHint:
      'git clone https://github.com/workopia/ai-resume-tailor.git integrations/benchmarks/ai-resume-tailor',
  },
  resume_lm: {
    repository: 'https://github.com/olyaiy/resume-lm',
    cloneHint: 'git clone https://github.com/olyaiy/resume-lm.git integrations/benchmarks/resume-lm',
  },
  job_ops: {
    repository: 'https://github.com/DaKheera47/job-ops',
    cloneHint: 'git clone https://github.com/DaKheera47/job-ops.git integrations/benchmarks/job-ops',
  },
  mr_jobs: {
    repository: 'https://github.com/humancto/mr-jobs',
    cloneHint: 'git clone https://github.com/humancto/mr-jobs.git integrations/benchmarks/mr-jobs',
  },
  career_ops: {
    repository: 'https://github.com/santifer/career-ops',
    cloneHint: 'git clone https://github.com/santifer/career-ops.git integrations/career-ops',
  },
  crawl4ai: {
    repository: 'https://github.com/unclecode/crawl4ai',
    cloneHint: 'npm run integrations:fetch -- crawl4ai',
  },
  activepieces: {
    repository: 'https://github.com/activepieces/activepieces',
    cloneHint: 'npm run integrations:fetch -- activepieces',
  },
};

const CATEGORY_ORDER: IntegrationCategory[] = [
  'runner',
  'web-stack',
  'career-app',
  'resume',
  'agent-framework',
  'reference',
];

const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  runner: 'Runner Quản gia (tích hợp sẵn qua slash)',
  'web-stack': 'Lõi cào web & automation (Crawl4AI + Activepieces)',
  'career-app': 'Ứng dụng săn việc / CV (chạy độc lập)',
  resume: 'Công cụ resume & PDF',
  'agent-framework': 'Framework agent (tham khảo / clone riêng)',
  reference: 'Tham khảo thêm từ GitHub',
};

function inferCategory(it: IntegrationEntry): IntegrationCategory {
  if (it.category) return it.category;
  if (it.integrationStrategy === 'ai-support-runner') return 'runner';
  if (/resume|cv/i.test(it.name)) return 'resume';
  return 'career-app';
}

function repoMeta(it: IntegrationEntry): { repository?: string; cloneHint?: string } {
  const legacy = INTEGRATION_REPO_META[it.id];
  if (legacy) return legacy;
  if (it.repository || it.cloneHint) {
    return { repository: it.repository, cloneHint: it.cloneHint };
  }
  return {};
}

function formatIntegrationBlock(it: IntegrationEntry): string[] {
  const meta = repoMeta(it);
  const lines: string[] = [];
  lines.push(`• ${it.name}`);
  lines.push(`  → ${it.path}`);
  lines.push(
    `  Loại: ${it.kind} · Tích hợp: ${it.integrationStrategy}${it.slashCommand ? ` · Slash: ${it.slashCommand}` : ''}`,
  );
  if (meta.repository) lines.push(`  GitHub: ${meta.repository}`);
  if (meta.cloneHint) lines.push(`  Clone: ${meta.cloneHint}`);
  lines.push(`  Tính năng:`);
  for (const f of it.features) {
    lines.push(`    - ${f}`);
  }
  lines.push(`  Cài: ${it.setupHint}`);
  return lines;
}

/** Tóm tắt prompt cho LLM: AI biết các integration nào, dùng vào việc gì. */
export function integrationsRegistryPromptBlock(): string {
  const lines: string[] = ['# INTEGRATIONS (integrations/ + GitHub clone)'];
  for (const it of INTEGRATIONS) {
    const slash = it.slashCommand ? ` (slash ${it.slashCommand})` : '';
    const repo = repoMeta(it).repository;
    lines.push(
      `- ${it.id}${slash} — ${it.name} [${it.integrationStrategy}]${repo ? ` · ${repo}` : ''}: ${it.features.slice(0, 2).join('; ')}`,
    );
  }
  lines.push('');
  lines.push('Khi user hỏi "chạy", "apply job", "tailor CV", "score JD"... ưu tiên gợi ý slash tương ứng');
  lines.push('App external: gợi ý git clone theo cloneHint hoặc /integrations.');
  return lines.join('\n');
}

/** Câu trả lời tĩnh cho /integrations (table render trong chat). */
export function buildIntegrationsAnswer(): string {
  const out: string[] = [
    buildIntegrationsDownloadPreamble(),
    'CÁC TÍNH NĂNG TRONG integrations/ (tải theo nhu cầu)',
    '',
    'Clone OmniSuite là đủ. Runner /run và /run-browser tự tải gói lần đầu.',
    'App bên dưới: clone vào đúng thư mục path (hoặc pip install) rồi chạy theo setupHint.',
    '',
  ];

  const byCategory = new Map<IntegrationCategory, IntegrationEntry[]>();
  for (const it of INTEGRATIONS) {
    const cat = inferCategory(it);
    const list = byCategory.get(cat) ?? [];
    list.push(it);
    byCategory.set(cat, list);
  }

  for (const cat of CATEGORY_ORDER) {
    const items = byCategory.get(cat);
    if (!items?.length) continue;
    out.push(`── ${CATEGORY_LABEL[cat]} ──`);
    out.push('');
    for (const it of items) {
      out.push(...formatIntegrationBlock(it));
      out.push('');
    }
  }

  const runnerSlashes = INTEGRATIONS.filter(
    (i) => i.slashCommand && i.integrationStrategy === 'ai-support-runner',
  )
    .map((i) => i.slashCommand)
    .join(' · ');
  out.push(`Slash runner Quản gia: ${runnerSlashes || '(xem /help)'}.`);
  out.push('Framework/agent tham khảo: clone repo GitHub → chạy độc lập (không bắt buộc cho OmniSuite core).');
  out.push('Chi tiết tải runner: /tai · Dev tải hết submodule: npm run integrations:sync:all');
  return out.join('\n');
}
