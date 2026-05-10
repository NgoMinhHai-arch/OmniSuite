/**
 * Knowledge base về dự án OmniSuite — nguồn sự thật để AI Hỗ trợ "biết" sản phẩm.
 *
 * Thiết kế:
 * - Dạng dữ liệu thuần TS (typed) → vừa render được trong chat trả lời tĩnh,
 *   vừa serialize gọn vào system prompt cho LLM.
 * - Tránh bê toàn bộ tài liệu vào prompt (đốt token); chỉ kèm khối tóm tắt cô đọng.
 */

export interface OmniSuitePage {
  /** Đường dẫn sidebar */
  href: string;
  /** Tên hiển thị trong UI */
  name: string;
  /** Một dòng mô tả mục đích — tránh dài dòng để gọn prompt */
  what: string;
  /** Các bước nhanh người dùng cần làm (tối đa 4 bước) */
  steps?: string[];
  /** Khi nào nên dùng */
  whenToUse?: string;
  /** Từ khóa thêm để match /howto và chat tự nhiên (không dấu không bắt buộc — sẽ normalize). */
  aliases?: string[];
}

/** Các trang chính theo Sidebar.tsx — KHÔNG liệt kê hơn 100 sub-tool SEO để tránh phình prompt. */
export const OMNISUITE_PAGES: OmniSuitePage[] = [
  {
    href: '/dashboard',
    name: 'Tổng quan',
    what: 'Trang chủ, hiển thị metrics + truy cập nhanh các công cụ.',
    whenToUse: 'Bắt đầu phiên làm việc / xem tổng số lần dùng tool.',
    aliases: ['trang chu', 'home dashboard'],
  },
  {
    href: '/dashboard/keywords',
    name: 'Phân tích Từ khóa',
    what: 'Sinh & phân tích bộ keyword, gom cụm, gợi ý ý tưởng nội dung.',
    steps: [
      'Nhập seed keyword + chọn provider LLM',
      'Bấm "Tạo" để generate (Universal Intent + DataForSEO/SERP nếu có key)',
      'Xuất Excel/CSV để dùng cho bài viết',
    ],
    whenToUse: 'Trước khi viết bài / lên silo / tìm long-tail.',
    aliases: ['tu khoa', 'keyword', 'keywords', 'phan tich tu khoa'],
  },
  {
    href: '/dashboard/content',
    name: 'Viết bài AI',
    what: 'Research → outline → bài viết hoàn chỉnh, có queue bulk & similarity guard.',
    steps: [
      'Nhập chủ đề / từ khóa chính',
      'Chọn LLM provider (Gemini/OpenAI/Claude/Groq/DeepSeek/OpenRouter/Ollama)',
      'Cấu hình variants (số bài) → bấm bắt đầu',
      'Theo dõi queue, tải DOCX khi xong',
    ],
    whenToUse: 'Sản xuất nội dung số lượng lớn theo silo / từ khóa.',
    aliases: ['viet bai', 'tao bai', 'content', 'article'],
  },
  {
    href: '/dashboard/maps',
    name: 'Quét bản đồ',
    what: 'Scrape Google Maps / địa điểm doanh nghiệp.',
    steps: [
      'Sidebar → Quét bản đồ hoặc mở /dashboard/maps.',
      'Chọn khu vực / loại hình (theo form trên trang).',
      'Nhập từ khóa hoặc điều kiện lọc → chạy quét.',
      'Xem danh sách địa điểm; xuất hoặc sao chép dữ liệu khi tool hỗ trợ.',
    ],
    whenToUse: 'Cần data lead / địa điểm theo từ khóa & vị trí.',
    aliases: ['ban do', 'google maps', 'maps', 'dia diem', 'doanh nghiep maps', 'lead dia diem'],
  },
  {
    href: '/dashboard/seo-tools',
    name: 'Bộ công cụ SEO',
    what: 'Hub gồm hơn 80 sub-tool: silo, content gap, GSC, schema, redirect, sitemap, classification…',
    whenToUse: 'Cần một thao tác SEO chuyên biệt — vào hub rồi tìm theo tên.',
    aliases: ['seo tools', 'hub seo', 'cong cu seo'],
  },
  {
    href: '/dashboard/seo-tools/scraper',
    name: 'Kiểm tra website',
    what: 'Crawl & audit URL: meta, schema, sitemap, link nội bộ.',
    whenToUse: 'Audit nhanh một URL trước khi tối ưu.',
    aliases: ['kiem tra web', 'audit site', 'crawl url', 'scraper', 'seo tools scraper'],
  },
  {
    href: '/dashboard/seo-tools/advanced',
    name: 'SEO nâng cao',
    what: 'Bundle các API SEO nâng cao (DataForSEO backlinks/intersect, Wikipedia citation, dead-link reclaimer…).',
    whenToUse: 'Phân tích backlink / cơ hội nâng cao có data SaaS.',
    aliases: ['advanced seo', 'seo nang cao'],
  },
  {
    href: '/dashboard/images',
    name: 'Tìm hình ảnh',
    what: 'Tìm & tải ảnh hàng loạt phục vụ bài viết.',
    whenToUse: 'Cần ảnh minh họa cho article / WooCommerce.',
    aliases: ['tim hinh', 'anh minh hoa', 'images'],
  },
  {
    href: '/dashboard/job-support',
    name: 'Hỗ trợ tìm việc',
    what: 'Hub: tìm việc, auto-apply, tailor CV theo JD.',
    steps: [
      'Find Jobs: nhập từ khóa & site → quét',
      'Tailor CV: dán JD → AI viết lại CV bám sát JD',
      'Auto Apply: chạy quy trình ứng tuyển bán tự động',
    ],
    aliases: ['tim viec', 'job support', 'cv', 'ung tuyen'],
  },
  {
    href: '/dashboard/ai-support',
    name: 'Quản gia',
    what: 'Quản gia OmniSuite (tiếng Việt): giao việc tự nhiên hoặc slash — tìm web khi có Tavily/SerpAPI (/web hoặc tự đoán); nút mở trang / DuckDuckGo; /plan; /run (OpenManus); /run-browser (browser-use).',
    aliases: ['quan gia', 'tro ly', 'ai support', 'chat ho tro'],
  },
  {
    href: '/dashboard/settings',
    name: 'Cấu hình hệ thống',
    what: 'Nhập API key (Gemini/OpenAI/Claude/Groq/DeepSeek/OpenRouter), URL & token Ollama, chọn provider mặc định.',
    steps: [
      'Vào Cấu hình → nhập API key cần dùng',
      'Đặt "Nhà cung cấp AI mặc định"',
      'Với Ollama local: để URL trống, app tự gọi http://localhost:11434',
    ],
    whenToUse: 'Trước khi dùng bất kỳ tool LLM nào.',
    aliases: ['cau hinh', 'settings', 'api key'],
  },
];

/** Chuẩn hóa nhẹ để match tiếng Việt (bỏ dấu, đ→d). */
export function normalizeViFold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
}

/** Tìm trang sidebar khớp chủ đề (tên, alias, slug href). */
export function findOmniSuitePageByTopic(raw: string): OmniSuitePage | null {
  const q = normalizeViFold(raw);
  if (q.length < 2) return null;

  for (const p of OMNISUITE_PAGES) {
    const nameN = normalizeViFold(p.name);
    if (nameN.length >= 3 && (q.includes(nameN) || nameN.includes(q))) return p;

    for (const al of p.aliases || []) {
      const an = normalizeViFold(al);
      if (an.length >= 2 && q.includes(an)) return p;
    }

    const slug = p.href.replace(/^\/dashboard\/?/, '').split('/').filter(Boolean)[0];
    if (slug && slug.length >= 3 && q.includes(slug.toLowerCase())) return p;
  }
  return null;
}

const USAGE_HELP_INTENT_RE =
  /cách\s+(dùng|sử\s*dụng|mở|vào)|sử\s*dụng\s+(tool\s*)?|làm\s+(sao|thế\s*nào|cách\s*nào)(\s+để)?|hướng\s*dẫn(\s+tôi|\s+mình)?|mở\s+tool|dùng\s+(tool\s*)?|how\s+to\s+use|cách\s+vận\s*hành|chạy\s+(tool\s*)?|sử\s*dụng\s+chức\s+năng/i;

export function formatOmniSuiteHowToPage(match: OmniSuitePage): string {
  const lines = [`HƯỚNG DẪN: ${match.name} (${match.href})`, '', match.what];
  if (match.whenToUse) lines.push(`Khi nào dùng: ${match.whenToUse}`);
  if (match.steps && match.steps.length) {
    lines.push('\nCác bước:');
    match.steps.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
  }
  return lines.join('\n');
}

/** Trả lời tĩnh nhanh cho chat khi user hỏi “cách dùng …” trong app — không gọi LLM. */
export function tryOmniSuiteUsageFastAnswer(message: string): {
  message: string;
  href: string;
  label: string;
} | null {
  const m = message.trim();
  if (m.length < 12 || !USAGE_HELP_INTENT_RE.test(m)) return null;
  const page = findOmniSuitePageByTopic(m);
  if (!page) return null;
  return {
    message: formatOmniSuiteHowToPage(page),
    href: page.href,
    label: `Mở ${page.name}`,
  };
}

/** Provider LLM được hỗ trợ — UI chọn ở Cấu hình & ở từng tool. */
export const SUPPORTED_LLM_PROVIDERS = [
  { id: 'google', label: 'Gemini', notes: 'Cần GEMINI_API_KEY hoặc nhập ở Cấu hình.' },
  { id: 'openai', label: 'OpenAI', notes: 'Cần OPENAI_API_KEY.' },
  { id: 'claude', label: 'Claude', notes: 'Cần CLAUDE_API_KEY / ANTHROPIC_API_KEY.' },
  { id: 'groq', label: 'Groq', notes: 'Free tier hợp cho task nhanh.' },
  { id: 'deepseek', label: 'DeepSeek', notes: 'Giá rẻ cho task lý luận.' },
  { id: 'openrouter', label: 'OpenRouter', notes: 'Gateway nhiều model — có rate limit chia sẻ.' },
  { id: 'ollama', label: 'Ollama', notes: 'Local 100% offline. Mặc định http://localhost:11434.' },
];

/** Đặc tả ngắn cách OmniSuite vận hành Ollama mượt — đồng bộ với src/shared/lib/ollama.ts. */
export const OLLAMA_RUNTIME_DEFAULTS = {
  sequentialQueue: 'Mặc định 1 inference / tiến trình (Next.js & Python). Task xếp hàng, không spike VRAM.',
  keepAlive: 'Mỗi request đính kèm keep_alive=30s → daemon Ollama tự unload sau 30s idle.',
  numCtx: 'Mỗi request gửi num_ctx=4096 → KV-cache nhỏ, model 3B chỉ cần ~3 GiB RAM thay vì 13 GiB (Modelfile mặc định 128k).',
  idleWatcher: 'Sau 2 phút không có inference, OmniSuite chủ động gọi /api/ps + unload mọi model.',
  shutdownUnload: 'Khi tắt app (Ctrl+C / OmniSuite.exe), launcher gọi unload toàn bộ model trước khi thoát.',
  override: 'Override qua biến môi trường: OLLAMA_MAX_CONCURRENT, OLLAMA_KEEP_ALIVE, OLLAMA_NUM_CTX, OLLAMA_IDLE_UNLOAD_MS, OLLAMA_TIMEOUT_MS.',
};

/** Các vấn đề thường gặp + cách xử lý nhanh. */
export const TROUBLESHOOT_KNOWLEDGE: Array<{ problem: string; fix: string }> = [
  {
    problem: 'Chọn provider Ollama nhưng "Chưa có model"',
    fix: 'Mở terminal chạy: ollama serve → ollama pull llama3.2 (hoặc qwen2.5 / mistral). Reload trang.',
  },
  {
    problem: 'Ollama: "model requires more system memory (X GiB) than is available"',
    fix: [
      'Lỗi này thường do Modelfile khai báo num_ctx=131072 (128k). KV-cache vì thế đòi >10 GiB cho model 3B.',
      '1) OmniSuite từ phiên bản này đã cap num_ctx=4096 mặc định (qua OLLAMA_NUM_CTX). Restart app + thử lại.',
      '2) Nếu vẫn thiếu RAM: tải model nhỏ hơn → ollama pull llama3.2:1b  (hoặc qwen2.5:1.5b, phi3.5:3.8b-mini-instruct-q4_K_M).',
      '3) Đóng app khác (Chrome, IDE…) hoặc đặt OLLAMA_KEEP_ALIVE=0 để unload ngay sau mỗi gọi.',
      '4) Hạ context cực thấp: OLLAMA_NUM_CTX=2048 trong .env.',
      '5) Đặt OLLAMA_MAX_LOADED_MODELS=1 cho daemon Ollama (env hệ thống của Ollama, không phải OmniSuite).',
    ].join(' '),
  },
  {
    problem: 'Ollama trả lỗi thiếu RAM/VRAM (chung)',
    fix: 'Kéo model nhỏ hơn (1B/3B Q4), đặt OLLAMA_KEEP_ALIVE=0, hoặc giảm OLLAMA_NUM_CTX (mặc định 4096, có thể hạ xuống 2048).',
  },
  {
    problem: 'Lỗi "Missing API key"',
    fix: 'Vào /dashboard/settings, nhập API key cho provider đang chọn. Hoặc đổi sang Ollama (không cần key).',
  },
  {
    problem: '429 quota exceeded (OpenRouter / Gemini free)',
    fix: 'Chuyển provider khác trong Cấu hình, hoặc giảm số variants/concurrency, hoặc nạp credit.',
  },
  {
    problem: 'Job Viết bài AI chạy chậm / treo',
    fix: 'Mở /dashboard/content → kiểm tra queue → cancel job hỏng. Với Ollama: tăng OLLAMA_TIMEOUT_MS.',
  },
  {
    problem: 'Sidebar không thấy tool cần dùng',
    fix: 'Vào /dashboard/seo-tools (Bộ công cụ SEO) — hub gom 80+ sub-tool. Tìm theo tên ở trên cùng.',
  },
  {
    problem: '/run hoặc /run-browser trả "AI_SUPPORT_RUNNER_ENABLED chưa bật"',
    fix: 'Đặt AI_SUPPORT_RUNNER_ENABLED=true trong .env (cảnh báo: cho phép thực thi code/local trên máy). Restart app.',
  },
  {
    problem: '/run báo "setup_required" (OpenManus / submodule / deps)',
    fix: 'Cài OpenManus + deps: npm run integrations:sync và scripts/setup-runners-venv.ps1 (.venv-runners, PYTHON_BIN).',
  },
  {
    problem: '/run-browser báo "setup_required: browser_use/playwright"',
    fix: 'cd integrations/ai-support/submodules/browser-use → pip install -e . → python -m playwright install chromium.',
  },
];

/** Workflow mẫu để gợi ý người dùng — dùng cho /tour và /howto generic. */
export const COMMON_WORKFLOWS: Array<{ title: string; steps: string[] }> = [
  {
    title: 'Sản xuất nội dung từ 0',
    steps: [
      '1. /dashboard/settings → nhập API key (hoặc bật Ollama)',
      '2. /dashboard/keywords → nhập seed keyword, generate cụm từ',
      '3. /dashboard/seo-tools → silo / topical map (tuỳ chọn)',
      '4. /dashboard/content → chọn keyword + variants → run',
      '5. Tải DOCX khi queue xong',
    ],
  },
  {
    title: 'Audit website nhanh',
    steps: [
      '1. /dashboard/seo-tools/scraper → nhập URL',
      '2. /dashboard/seo-tools/advanced → backlink / dead-link nếu có DataForSEO',
      '3. /dashboard/seo-tools/[công cụ] → tối ưu theo issue tìm được',
    ],
  },
  {
    title: 'Lập kế hoạch agent với Quản gia',
    steps: [
      '1. /dashboard/ai-support → mô tả mục tiêu',
      '2. Gõ /plan (hoặc /browser) để có kế hoạch 3 tầng (não / agent / tool)',
      '3. Thực thi local: /run <task> (OpenManus) hoặc /run-browser <task> (browser-use + Playwright)',
    ],
  },
];

/**
 * Khối knowledge cô đọng inject vào system prompt LLM.
 * GIỮ NGẮN GỌN — đây là context cho mỗi turn chat.
 */
export function omniSuiteKnowledgePromptBlock(): string {
  const pageLines = OMNISUITE_PAGES.map((p) => `- ${p.href} (${p.name}): ${p.what}`).join('\n');
  const providerLines = SUPPORTED_LLM_PROVIDERS.map((p) => `- ${p.id} → ${p.label}: ${p.notes}`).join('\n');
  return [
    '# OMNISUITE — bối cảnh sản phẩm bạn đang hỗ trợ',
    'OmniSuite là bộ công cụ Next.js + Python engine cho SEO / content / job-support, có Quản gia (chat tiếng Việt, có nút việc làm).',
    'Ngôn ngữ trả lời mặc định: tiếng Việt, ngắn gọn, có hành động cụ thể (đường dẫn /dashboard/... khi cần).',
    '',
    '## Trang chính (sidebar)',
    pageLines,
    '',
    '## Provider LLM hỗ trợ',
    providerLines,
    '',
    '## Ollama runtime (mặc định, không cần chỉnh .env)',
    `- ${OLLAMA_RUNTIME_DEFAULTS.sequentialQueue}`,
    `- ${OLLAMA_RUNTIME_DEFAULTS.keepAlive}`,
    `- ${OLLAMA_RUNTIME_DEFAULTS.idleWatcher}`,
    `- ${OLLAMA_RUNTIME_DEFAULTS.shutdownUnload}`,
    '',
    '## Slash command trong Quản gia',
    '- /help: liệt kê lệnh',
    '- /tour: tour tổng quan OmniSuite',
    '- /tools: danh sách trang chính',
    '- /howto <từ khóa>: hướng dẫn dùng tính năng cụ thể',
    '- /check: kiểm tra API key / provider đã cấu hình',
    '- /llm: gợi ý chọn provider/model phù hợp',
    '- /settings: nhắc đường dẫn Cấu hình',
    '- /troubleshoot <vấn đề>: gợi ý sửa lỗi',
    '- /web <truy vấn>: bắt buộc tìm web (Tavily hoặc SerpAPI). Nhắn bình thường: quản gia có thể tự tìm web nếu có key.',
    '- /plan: lập kế hoạch 3 tầng (não/agent/tool)',
    '- /browser: ưu tiên Browser Agent khi /plan',
    '- /run <task>: OpenManus trên máy (agent + Python/tool calls). Yêu cầu AI_SUPPORT_RUNNER_ENABLED=true và venv runners (scripts/setup-runners-venv.ps1).',
    '- /run-browser <task>: Browser Agent (browser-use + Playwright). Cùng cờ runner; cần pip install browser-use + playwright chromium.',
    '- /integrations: liệt kê các tính năng đã clone trong integrations/ + trạng thái cài đặt.',
    '- /apply <doctor|init|run|apply>: chạy ApplyPilot CLI (auto-apply jobs).',
    '- /score <jd>: score JD vs resume qua job-scraper LLM client.',
  ].join('\n');
}

/** Bản render dài hơn cho /tour (trả tĩnh, không gọi LLM). */
export function buildTourAnswer(): string {
  const lines: string[] = [
    'TOUR OMNISUITE — 60 giây',
    '',
    'OmniSuite có 3 nhóm:',
    '1) TỔNG QUAN — /dashboard',
    '2) CÔNG CỤ — keywords / content / maps / seo-tools / images / job-support / ai-support',
    '3) HỆ THỐNG — settings (API key, Ollama)',
    '',
    'Dòng chảy điển hình:',
  ];
  COMMON_WORKFLOWS.forEach((wf, idx) => {
    lines.push(`\n[${idx + 1}] ${wf.title}`);
    wf.steps.forEach((s) => lines.push(`  ${s}`));
  });
  lines.push('');
  lines.push('Gõ /tools để xem chi tiết từng trang, /howto <tên> để hướng dẫn cụ thể.');
  return lines.join('\n');
}

/** Bản render cho /tools (tĩnh). */
export function buildToolsAnswer(): string {
  const lines: string[] = ['CÁC TRANG CHÍNH — bấm vào sidebar tương ứng:'];
  OMNISUITE_PAGES.forEach((p) => {
    lines.push(`\n• ${p.name}  →  ${p.href}`);
    lines.push(`  ${p.what}`);
    if (p.whenToUse) lines.push(`  Khi nào dùng: ${p.whenToUse}`);
  });
  lines.push('\nMuốn cách dùng cụ thể: /howto <tên trang> (vd: /howto viết bài AI).');
  return lines.join('\n');
}

/** /howto <query> — match theo tên / href / từ khóa. */
export function buildHowToAnswer(query: string): string | null {
  const q = query.trim().toLowerCase();
  if (!q) {
    return 'Cú pháp: /howto <tên trang>. Ví dụ: /howto viết bài AI, /howto keywords, /howto ollama.';
  }
  if (/(ollama|local llm|gpu|vram)/.test(q)) {
    return [
      'CÁCH DÙNG OLLAMA (LOCAL, KHÔNG TỐN API KEY):',
      '1. Cài Ollama: https://ollama.com',
      '2. Terminal: ollama serve',
      '3. Tải model: ollama pull llama3.2 (hoặc qwen2.5 / mistral)',
      '4. /dashboard/settings → Nhà cung cấp AI mặc định = Ollama (URL để trống là dùng localhost)',
      '5. OmniSuite tự queue 1 task/lần, auto-unload khi idle, giải phóng VRAM khi tắt app.',
    ].join('\n');
  }
  const match =
    findOmniSuitePageByTopic(query) ||
    OMNISUITE_PAGES.find(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.href.toLowerCase().includes(q) ||
        q.includes(p.name.toLowerCase()),
    );
  if (!match) return null;
  return formatOmniSuiteHowToPage(match);
}

/** /troubleshoot <query> — match theo từ khóa lỗi. */
export function buildTroubleshootAnswer(query: string): string {
  const q = query.trim().toLowerCase();
  const matches = q
    ? TROUBLESHOOT_KNOWLEDGE.filter(
        (t) => t.problem.toLowerCase().includes(q) || t.fix.toLowerCase().includes(q),
      )
    : TROUBLESHOOT_KNOWLEDGE;
  if (matches.length === 0) {
    return `Không có gợi ý sẵn cho "${query}". Hãy mô tả thêm chi tiết (provider, model, log lỗi) để mình debug giúp.`;
  }
  const lines = ['GỢI Ý SỬA LỖI:'];
  matches.slice(0, 6).forEach((t) => {
    lines.push(`\n• ${t.problem}`);
    lines.push(`  → ${t.fix}`);
  });
  return lines.join('\n');
}

/** Trả nhanh hướng dẫn cấu hình. */
export function buildSettingsAnswer(): string {
  return [
    'CẤU HÌNH HỆ THỐNG: /dashboard/settings',
    '',
    '• Nhập API key cho provider muốn dùng (Gemini/OpenAI/Claude/Groq/DeepSeek/OpenRouter).',
    '• Đặt "Nhà cung cấp AI mặc định" — toàn bộ tool sẽ dùng provider này khi không override.',
    '• Ollama local: chỉ cần chạy "ollama serve" + "ollama pull <model>". Để URL trống, OmniSuite tự gọi http://localhost:11434.',
    '• Ollama remote (Colab/server tunnel): dán origin (không có /v1) vào "Ollama — URL máy chủ".',
    '',
    'Sau khi lưu cấu hình, reload tab tool đang mở.',
  ].join('\n');
}

/** Gợi ý chọn provider/model — heuristic ngắn. */
export function buildLlmAdviceAnswer(query: string): string {
  const q = query.trim().toLowerCase();
  const lines: string[] = ['GỢI Ý CHỌN PROVIDER / MODEL:'];
  if (/local|offline|riêng tư|private|free/.test(q) || !q) {
    lines.push('• Chạy local / không tốn tiền: Ollama + llama3.2 (3B-8B Q4) hoặc qwen2.5.');
  }
  if (/json|schema|tool call|structured/.test(q) || !q) {
    lines.push('• Cần JSON ổn định / structured output: OpenAI gpt-4o-mini hoặc Gemini 1.5 Flash.');
  }
  if (/code|lập trình|programming/.test(q)) {
    lines.push('• Code: Claude 3.5 Sonnet, DeepSeek Coder, hoặc Qwen2.5-Coder (Ollama).');
  }
  if (/dài|long|context|book|docx/.test(q)) {
    lines.push('• Context dài: Gemini 1.5 (1M token) hoặc Claude 3.5 Sonnet (200k).');
  }
  if (/rẻ|cheap|cost/.test(q) || !q) {
    lines.push('• Tiết kiệm: Groq (free tier nhanh) hoặc DeepSeek (rẻ + tốt).');
  }
  if (lines.length === 1) {
    lines.push(`• Cho yêu cầu "${query}": mặc định Gemini 1.5 Flash hoặc llama3.2 (Ollama) là đủ.`);
  }
  lines.push('\nĐổi provider tại /dashboard/settings hoặc trong từng tool (panel "Nâng cao").');
  return lines.join('\n');
}
