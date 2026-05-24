/**
 * Registry các tính năng đã được clone về trong `integrations/`.
 *
 * Mỗi entry mô tả:
 *   - id            : khóa định danh, dùng làm "runner" trong /api/ai-support/run hoặc trong UI.
 *   - name          : tên hiển thị.
 *   - path          : path tương đối (sẽ được resolve so với cwd ở server-side).
 *   - kind          : "python-cli" | "python-script" | "node-app" | "docker-app".
 *   - integrationStrategy:
 *       * "ai-support-runner"  → có Python runner ở `integrations/ai-support/runners/<id>_runner.py`,
 *                                 AI Hỗ trợ có thể spawn trực tiếp qua /api/ai-support/run.
 *       * "external-app"       → là full-stack app riêng; OmniSuite KHÔNG spawn,
 *                                 chỉ cung cấp hướng dẫn run/setup.
 *   - setupHint     : 1 dòng hướng dẫn cài đặt.
 *   - features      : các tính năng chính.
 *   - slashCommand  : slash dùng trong AI Hỗ trợ (nếu có).
 *
 * GHI CHÚ: Đây là DATA thuần — không gọi fs / spawn ở module-load time.
 * `/api/ai-support/integrations` mới làm việc đó.
 */

export type IntegrationKind = 'python-cli' | 'python-script' | 'node-app' | 'docker-app';
export type IntegrationStrategy = 'ai-support-runner' | 'external-app';

export interface IntegrationEntry {
  id: string;
  name: string;
  path: string;
  kind: IntegrationKind;
  integrationStrategy: IntegrationStrategy;
  features: string[];
  setupHint: string;
  slashCommand?: string;
  /** Lệnh để check version / sự sẵn sàng (server-side). Có thể là array argv. */
  probe?: { bin: string; args: string[] };
}

export const INTEGRATIONS: IntegrationEntry[] = [
  {
    id: 'open_manus',
    name: 'OpenManus',
    path: 'integrations/ai-support/submodules/open-manus',
    kind: 'python-cli',
    integrationStrategy: 'ai-support-runner',
    features: [
      'Điều khiển máy cục bộ: Python execute / browser-use tool / editor (OpenManus)',
      'Luồng Quản gia `/run` mặc định — agent Manus + OpenAI-compatible LLM',
    ],
    setupHint: 'npm run integrations:sync + scripts/setup-runners-venv.ps1 (.venv-runners, PYTHON_BIN).',
    slashCommand: '/run',
    probe: {
      bin: 'python',
      args: [
        '-c',
        'import pathlib; p=pathlib.Path("integrations/ai-support/submodules/open-manus/app/agent/manus.py"); print("ok" if p.is_file() else "missing")',
      ],
    },
  },
  {
    id: 'browser_use',
    name: 'Browser Use (Browser Agent)',
    path: 'integrations/ai-support/submodules/browser-use',
    kind: 'python-cli',
    integrationStrategy: 'ai-support-runner',
    features: [
      'Browser automation thật bằng Playwright + LLM',
      'Hỗ trợ Ollama / OpenAI / Gemini làm "não"',
      'Streaming step-by-step events',
    ],
    setupHint:
      'Goi scripts/setup-runners-venv.ps1 (Windows) hoac setup-runners-venv.sh — cai browser-use + Playwright trong .venv-runners.',
    slashCommand: '/run-browser',
    probe: { bin: 'python', args: ['-c', 'import browser_use; import playwright; print("ok")'] },
  },
  {
    id: 'applypilot',
    name: 'ApplyPilot — autonomous job apply',
    path: 'integrations/applypilot',
    kind: 'python-cli',
    integrationStrategy: 'ai-support-runner',
    features: [
      '6-stage pipeline: discover → enrich → score → tailor → cover → apply',
      'Browser-driven submission (Playwright + Claude Code CLI)',
      'Multi-thread parallel apply',
    ],
    setupHint:
      'scripts/setup-runners-venv.ps1 (bo ApplyPilot: -SkipApplyPilot) hoac pip install applypilot + pip install --no-deps python-jobspy; lan dau: applypilot init',
    slashCommand: '/apply',
    probe: { bin: 'applypilot', args: ['--version'] },
  },
  {
    id: 'job_scraper',
    name: 'Job Scraper (LinkedIn + AI scoring)',
    path: 'integrations/job-scraper',
    kind: 'python-script',
    integrationStrategy: 'ai-support-runner',
    features: [
      'Scrape LinkedIn job postings',
      'AI score JD vs resume (Gemini/OpenAI/Ollama qua litellm)',
      'PDF resume generator',
      'Supabase storage (tuỳ chọn)',
    ],
    setupHint:
      'Duoc gop trong scripts/setup-runners-venv.ps1 (requirements-runners.txt); hoac cd integrations/job-scraper && pip install -r requirements.txt',
    slashCommand: '/score',
    probe: { bin: 'python', args: ['-c', 'import sys; sys.path.insert(0, "integrations/job-scraper"); import llm_client; print("ok")'] },
  },
  {
    id: 'ai_resume_tailor',
    name: 'AI Resume Tailor (Workopia)',
    path: 'integrations/benchmarks/ai-resume-tailor',
    kind: 'node-app',
    integrationStrategy: 'external-app',
    features: [
      'Next.js app: tailor resume theo JD',
      'MCP server endpoint',
      'Cần OPENAI_API_KEY',
    ],
    setupHint:
      'cd integrations/benchmarks/ai-resume-tailor && npm install && npm run dev',
  },
  {
    id: 'resume_lm',
    name: 'ResumeLM — full resume builder',
    path: 'integrations/benchmarks/resume-lm',
    kind: 'node-app',
    integrationStrategy: 'external-app',
    features: [
      'Resume builder Next.js 15 + Supabase + Stripe',
      'AI chat assistant cho resume',
      'ATS scoring',
    ],
    setupHint:
      'cd integrations/benchmarks/resume-lm && pnpm install && pnpm dev (cần Supabase + Stripe env)',
  },
  {
    id: 'job_ops',
    name: 'JobOps — multi-board job aggregator',
    path: 'integrations/benchmarks/job-ops',
    kind: 'docker-app',
    integrationStrategy: 'external-app',
    features: [
      'Tìm job đa nguồn (LinkedIn / Indeed / Glassdoor / 10+)',
      'Tailor CV theo role',
      '7+ extractor riêng (Adzuna, hiringcafe, golangjobs, ...)',
      'Visa sponsorship checker',
    ],
    setupHint:
      'cd integrations/benchmarks/job-ops && docker compose up -d  # localhost:3005',
  },
  {
    id: 'mr_jobs',
    name: 'MR.Jobs — local job hunting AI',
    path: 'integrations/benchmarks/mr-jobs',
    kind: 'docker-app',
    integrationStrategy: 'external-app',
    features: [
      'Discover → score → tailor → apply (Playwright)',
      'Real-time local dashboard',
      'Follow-up & ghost detection',
    ],
    setupHint:
      'cd integrations/benchmarks/mr-jobs && docker compose up -d',
  },
  {
    id: 'career_ops',
    name: 'Career-Ops — multi-agent CV pipeline',
    path: 'integrations/career-ops',
    kind: 'node-app',
    integrationStrategy: 'external-app',
    features: [
      'Đánh giá offer A-F (10 dimensions)',
      'Tailor CV PDF qua Playwright',
      'Scan portal Greenhouse/Ashby/Lever',
      'Cần Claude Code / Gemini CLI / OpenCode',
    ],
    setupHint:
      'cd integrations/career-ops && npm install && xem README để chọn AI CLI (claude / gemini / opencode)',
  },
];

/** Tóm tắt prompt cho LLM: AI biết các integration nào, dùng vào việc gì. */
export function integrationsRegistryPromptBlock(): string {
  const lines: string[] = ['# INTEGRATIONS đã clone trong `integrations/`'];
  for (const it of INTEGRATIONS) {
    const slash = it.slashCommand ? ` (slash ${it.slashCommand})` : '';
    lines.push(`- ${it.id}${slash} — ${it.name} [${it.integrationStrategy}]: ${it.features.slice(0, 2).join('; ')}`);
  }
  lines.push('');
  lines.push('Khi user hỏi "chạy", "apply job", "tailor CV", "score JD"... ưu tiên gợi ý slash tương ứng');
  lines.push('hoặc đường dẫn cài đặt nếu integration là external-app.');
  return lines.join('\n');
}

/** Câu trả lời tĩnh cho /integrations (table render trong chat). */
export function buildIntegrationsAnswer(): string {
  const out: string[] = ['CÁC TÍNH NĂNG ĐÃ CLONE (integrations/):'];
  for (const it of INTEGRATIONS) {
    out.push('');
    out.push(`• ${it.name}  →  ${it.path}`);
    out.push(`  Loại: ${it.kind} · Tích hợp: ${it.integrationStrategy}${it.slashCommand ? ` · Slash: ${it.slashCommand}` : ''}`);
    out.push(`  Tính năng: ${it.features.join('; ')}`);
    out.push(`  Cài: ${it.setupHint}`);
  }
  out.push('');
  out.push(
    'Slash runner Quản gia: /run (OpenManus) · /run-browser (browser_use) · /apply (applypilot) · /score (job_scraper). Xem đầy đủ slash + ví dụ: /help.',
  );
  out.push('Các app full-stack (resume-lm, job-ops, mr-jobs, ai-resume-tailor, career-ops) chạy độc lập theo hướng dẫn.');
  return out.join('\n');
}
