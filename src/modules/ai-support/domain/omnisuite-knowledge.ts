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
      'Chọn LLM provider (Gemini/OpenAI/Claude/Groq/DeepSeek/OpenRouter/Ollama/9Router)',
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
    href: '/dashboard/ai-support',
    name: 'Quản gia',
    what:
      'Trợ lý tiếng Việt trong app: chat tự nhiên + slash. Biết sản phẩm OmniSuite (trang, LLM, lỗi thường gặp). Có Tavily/SerpAPI → tìm web. Có runner → /run (OpenManus), /run-browser (Playwright). Luôn mở đúng origin Next (vd. http://127.0.0.1:3000).',
    steps: [
      'Mở /dashboard/ai-support',
      'Mới vào: gõ /tour hoặc /tools',
      'Cần hướng dẫn trang: /howto viết bài AI (hoặc keywords, ollama, 9router…)',
      'Cần kế hoạch agent: /plan — thực thi local: /run hoặc /run-browser (nếu đã bật runner)',
    ],
    whenToUse: 'Không biết bắt đầu từ đâu, cần điều hướng nhanh, hoặc gợi ý workflow SEO/content.',
    aliases: ['quan gia', 'tro ly', 'ai support', 'chat ho tro', 'butler', 'omnisuite'],
  },
  {
    href: '/dashboard/settings',
    name: 'Cấu hình hệ thống',
    what:
      'Nhập API key cloud (Gemini/OpenAI/Claude/Groq/DeepSeek/OpenRouter), Ollama (local/tunnel), 9Router (proxy miễn phí OpenAI-compat), Tavily/SerpAPI, SerpAPI… Chọn provider + model mặc định. Lưu trong trình duyệt (localStorage), không commit git.',
    steps: [
      'Mở /dashboard/settings',
      'Dán API key hoặc URL máy chủ (Ollama / 9Router)',
      'Chọn "Nhà cung cấp AI mặc định" → quét model → chọn model mặc định',
      'Bấm Lưu — reload tab tool nếu vừa đổi provider',
    ],
    whenToUse: 'Trước khi dùng LLM, tìm web (Quản gia), hoặc tool cần SerpAPI/DataForSEO.',
    aliases: ['cau hinh', 'settings', 'api key', 'cau hinh he thong'],
  },
];

/** Bối cảnh sản phẩm — dùng trong prompt và /howto omnisuite. */
export const OMNISUITE_PRODUCT_FACTS = {
  tagline:
    'OmniSuite = hub SEO/marketing trên Next.js 16 + Python FastAPI: từ khóa, viết bài AI, quét Maps, 80+ tool SEO, Quản gia (chat tiếng Việt).',
  stack: [
    'Frontend: Next.js 16 (App Router), React 19, Tailwind — dashboard tại /dashboard/*',
    'Python engine: FastAPI cổng 8082 (PYTHON_ENGINE_URL) — keywords, content queue, job',
    'Khởi chạy: npm run app hoặc node launcher.js (Next + Python cùng lúc)',
    'API keys UI: localStorage key omnisuite_settings; .env cho server/runner (không commit)',
  ],
  dataFlow: [
    'Viết bài / SEO tool (Next) → gọi LLM qua API route hoặc proxy sang Python engine',
    'Phân tích từ khóa: UI Next → POST Python /keywords với provider + api_keys',
    'Quản gia: chat tại /dashboard/ai-support — slash tĩnh (không LLM) hoặc LLM + optional Tavily/SerpAPI',
  ],
  securityNotes: [
    'Runner (/run, /run-browser): TẮT mặc định — cần AI_SUPPORT_RUNNER_ENABLED=true (thực thi code local)',
    'Không có auth toàn cục trên mọi /api — giả định máy tin cậy / localhost',
    'OMNISUITE_LOCALHOST_ONLY=1 mặc định — chỉ localhost truy cập dashboard',
  ],
};

/** Vai trò và giới hạn của Quản gia — tránh bịa tính năng. */
export const BUTLER_CAPABILITIES = {
  can: [
    'Trả lời tiếng Việt về cách dùng OmniSuite (trang, workflow, provider LLM)',
    'Đề xuất nút mở trang (/dashboard/...) hoặc lệnh slash (/plan, /howto, /run…)',
    'Tìm web khi có Tavily/SerpAPI (/web hoặc tự đoán khi cần thông tin ngoài app)',
    'Lập kế hoạch 3 tầng (/plan), kiểm tra key (/check), tour (/tour)',
  ],
  cannot: [
    'Không trực tiếp chạy tool SEO thay chủ nhân (chỉ hướng dẫn + mở đúng trang)',
    'Không đọc file trên máy chủ ngoài phạm vi API đã expose',
    'Không bật runner nếu .env chưa cho phép — phải nhắc cấu hình',
  ],
};

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
  {
    id: '9router',
    label: '9Router',
    notes:
      'Proxy OpenAI-compat local http://127.0.0.1:20128/v1 — route tới 40+ provider (Kiro, OpenCode Free…). Cài: npm i -g 9router && 9router. Key copy từ dashboard 9Router.',
  },
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

/** 9Router — proxy AI miễn phí (https://github.com/decolua/9router). */
export const NINEROUTER_SETUP = {
  install: 'npm i -g 9router → chạy lệnh 9router (dashboard http://127.0.0.1:20128)',
  settings:
    'Cấu hình → provider 9Router → API key từ dashboard 9Router → URL để trống = http://127.0.0.1:20128',
  models: 'Quét model trong Cấu hình; dùng id combo 9Router (vd. cc/claude-sonnet-4-5, kr/claude-sonnet-4.5)',
  pythonOnly: 'Route mọi LLM Python qua 9Router: LITELLM_BASE_URL=http://127.0.0.1:20128 trong .env (không thêm /v1)',
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
    problem: '/run báo "setup_required" hoặc không tải được OpenManus',
    fix: 'Gõ lại /run <nhiệm vụ> — lần đầu app tự tải. Hoặc: npm run integrations:fetch -- open_manus. Xem /tai. Sau khi có repo: scripts/setup-runners-venv.ps1 nếu thiếu pip.',
  },
  {
    problem: '/run-browser báo "setup_required" (browser_use / playwright)',
    fix: 'Gõ lại /run-browser … để tự tải browser-use, hoặc npm run integrations:fetch -- browser_use. Playwright: scripts/setup-runners-venv.ps1 hoặc python -m playwright install chromium trong venv.',
  },
  {
    problem: 'Muốn tải gói Quản gia mà không chạy runner',
    fix: 'Gõ /tai hoặc /tai open_manus | /tai browser. Chỉ clone OmniSuite là đủ — không cần npm run integrations:sync lúc mới cài.',
  },
  {
    problem: '9Router: không kết nối / không lấy được model',
    fix: 'Chạy 9router trong terminal. Mở http://127.0.0.1:20128 → kết nối provider trong dashboard → copy API key vào Cấu hình OmniSuite. Dùng 127.0.0.1 thay localhost nếu lỗi IPv6.',
  },
  {
    problem: 'Python engine không chạy / keywords lỗi 502',
    fix: 'Kiểm tra PYTHON_ENGINE_URL=http://127.0.0.1:8082. Chạy npm run app (launcher khởi động FastAPI). Xem log python_engine — PostgreSQL phải chạy nếu route cần DB.',
  },
  {
    problem: 'Quản gia slash /run lỗi hoặc không phản hồi',
    fix: 'Mở Quản gia trên cùng origin với Next (vd. http://127.0.0.1:3000), không embed host khác. Bật AI_SUPPORT_RUNNER_ENABLED và cài .venv-runners.',
  },
  {
    problem: 'Đăng nhập dashboard lặp vô hạn',
    fix: 'Đặt NEXTAUTH_SECRET trong .env. Xóa cookie session cũ. Chạy lại npm run dev.',
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
  {
    title: 'Dùng AI gần như miễn phí (9Router + Ollama)',
    steps: [
      '1. Cài 9router (npm i -g 9router) hoặc Ollama (ollama.com)',
      '2. /dashboard/settings → 9Router hoặc Ollama làm provider mặc định',
      '3. Quét model → chọn combo/model phù hợp',
      '4. Dùng Viết bài AI / Keywords / Quản gia với cùng provider',
    ],
  },
];

/**
 * Khối knowledge cô đọng inject vào system prompt LLM.
 * GIỮ NGẮN GỌN — đây là context cho mỗi turn chat.
 */
export function buildOmniSuiteOverviewAnswer(): string {
  const lines: string[] = [
    'OMNISUITE — TỔNG QUAN (cho Quản gia / chủ nhân)',
    '',
    OMNISUITE_PRODUCT_FACTS.tagline,
    '',
    'Kiến trúc:',
    ...OMNISUITE_PRODUCT_FACTS.stack.map((s) => `• ${s}`),
    '',
    'Luồng dữ liệu chính:',
    ...OMNISUITE_PRODUCT_FACTS.dataFlow.map((s) => `• ${s}`),
    '',
    'Quản gia (em) có thể:',
    ...BUTLER_CAPABILITIES.can.map((s) => `• ${s}`),
    '',
    'Quản gia KHÔNG:',
    ...BUTLER_CAPABILITIES.cannot.map((s) => `• ${s}`),
    '',
    'Bắt đầu nhanh: /tour → /tools → /dashboard/settings (API key) → /howto <tên trang>.',
  ];
  return lines.join('\n');
}

export function omniSuiteKnowledgePromptBlock(): string {
  const pageLines = OMNISUITE_PAGES.map((p) => `- ${p.href} (${p.name}): ${p.what}`).join('\n');
  const providerLines = SUPPORTED_LLM_PROVIDERS.map((p) => `- ${p.id} → ${p.label}: ${p.notes}`).join('\n');
  return [
    '# OMNISUITE — bối cảnh sản phẩm bạn đang hỗ trợ',
    OMNISUITE_PRODUCT_FACTS.tagline,
    'Bạn là QUẢN GIA: trợ lý vận hành OmniSuite — chỉ tiếng Việt, gọn, đưa việc cụ thể (href /dashboard hoặc slash).',
    'Không bịa URL/tính năng ngoài danh sách dưới đây.',
    '',
    '## Kiến trúc (nhớ khi debug)',
    ...OMNISUITE_PRODUCT_FACTS.stack.map((s) => `- ${s}`),
    '',
    '## Trang chính (sidebar)',
    pageLines,
    '',
    '## Provider LLM hỗ trợ',
    providerLines,
    '',
    '## Ollama (local)',
    `- ${OLLAMA_RUNTIME_DEFAULTS.sequentialQueue}`,
    `- ${OLLAMA_RUNTIME_DEFAULTS.numCtx}`,
    `- ${OLLAMA_RUNTIME_DEFAULTS.idleWatcher}`,
    '',
    '## 9Router (proxy OpenAI-compat)',
    `- ${NINEROUTER_SETUP.install}`,
    `- ${NINEROUTER_SETUP.settings}`,
    `- ${NINEROUTER_SETUP.models}`,
    '',
    '## Cấu hình API',
    '- UI: /dashboard/settings → lưu localStorage (omnisuite_settings)',
    '- Server: .env (GEMINI_API_KEY, PYTHON_ENGINE_URL, runner flags…) — không commit',
    '',
    '## Slash command trong Quản gia',
    '- /help: liệt kê lệnh',
    '- /tour: tour tổng quan OmniSuite',
    '- /tools: danh sách trang chính',
    '- /howto <từ khóa>: hướng dẫn dùng tính năng cụ thể (vd. viết bài AI, ollama, 9router, omnisuite)',
    '- /check: kiểm tra API key / provider đã cấu hình',
    '- /llm: gợi ý chọn provider/model phù hợp',
    '- /settings: nhắc đường dẫn Cấu hình',
    '- /troubleshoot <vấn đề>: gợi ý sửa lỗi',
    '- /web <truy vấn>: bắt buộc tìm web (Tavily hoặc SerpAPI). Nhắn bình thường: quản gia có thể tự tìm web nếu có key.',
    '- /plan: lập kế hoạch 3 tầng (não/agent/tool)',
    '- /browser: ưu tiên Browser Agent khi /plan',
    '- /run <task>: OpenManus — lần đầu tự tải repo con (không cần integrations:sync trước). Cần AI_SUPPORT_RUNNER_ENABLED=true.',
    '- /run-browser <task>: browser-use — lần đầu tự tải gói. Cùng cờ runner; pip/playwright tùy chọn (setup-runners-venv.ps1).',
    '- /tai [open_manus|browser|crawl4ai]: hướng dẫn tải gói (integrations:fetch).',
    '- /tai-bang: bảng integration đã tải / chưa tải trên máy.',
    '- /integrations: danh sách integration trong manifest (tải theo nhu cầu, không tải hết lúc cài app).',
    '- /apply <doctor|init|run|apply>: chạy ApplyPilot CLI (auto-apply jobs).',
    '- /score <jd>: score JD vs resume qua job-scraper LLM client.',
  ].join('\n');
}

/** Bản render dài hơn cho /tour (trả tĩnh, không gọi LLM). */
export function buildTourAnswer(): string {
  const lines: string[] = [
    'TOUR OMNISUITE — 60 giây',
    '',
    OMNISUITE_PRODUCT_FACTS.tagline,
    '',
    'OmniSuite có 3 nhóm:',
    '1) TỔNG QUAN — /dashboard',
    '2) CÔNG CỤ — keywords / content / maps / seo-tools / images / ai-support (Quản gia)',
    '3) HỆ THỐNG — settings (API key, Ollama, 9Router, Tavily…)',
    '',
    'Em (Quản gia) ở /dashboard/ai-support — gõ /help để xem lệnh slash.',
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
    return 'Cú pháp: /howto <tên trang>. Ví dụ: /howto viết bài AI, /howto keywords, /howto ollama, /howto 9router, /howto omnisuite.';
  }
  if (/(omnisuite|san pham|la gi|tong quan|kien truc|architecture)/.test(q)) {
    return buildOmniSuiteOverviewAnswer();
  }
  if (/(9router|9 router|chin router)/.test(q)) {
    return [
      'CÁCH DÙNG 9ROUTER VỚI OMNISUITE:',
      `1. ${NINEROUTER_SETUP.install}`,
      '2. Trong dashboard 9Router: kết nối provider (Kiro, OpenCode Free…) + tạo API key',
      `3. ${NINEROUTER_SETUP.settings}`,
      `4. ${NINEROUTER_SETUP.models}`,
      '5. Dùng Viết bài AI / Keywords / Quản gia với cùng provider 9Router',
      `6. (Tuỳ chọn Python) ${NINEROUTER_SETUP.pythonOnly}`,
    ].join('\n');
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
    'LLM (chọn một hoặc nhiều):',
    '• Cloud: Gemini, OpenAI, Claude, Groq, DeepSeek, OpenRouter — dán API key tương ứng.',
    '• Ollama local: ollama serve + ollama pull <model>; URL để trống = http://localhost:11434.',
    `• 9Router: ${NINEROUTER_SETUP.install} — key từ dashboard 9Router; URL trống = http://127.0.0.1:20128.`,
    '',
    'Sau khi nhập key: chọn "Nhà cung cấp AI mặc định" → quét model → chọn model mặc định → Lưu.',
    'Tìm web (Quản gia): thêm Tavily hoặc SerpAPI key ở cùng trang Cấu hình.',
    'Runner (/run): AI_SUPPORT_RUNNER_SECRET khớp .env nếu bật runner.',
    '',
    'Lưu trong trình duyệt (localStorage). Server đọc thêm .env — xem .env.example.',
    'Sau khi lưu: reload tab tool đang mở.',
  ].join('\n');
}

/** Gợi ý chọn provider/model — heuristic ngắn. */
export function buildLlmAdviceAnswer(query: string): string {
  const q = query.trim().toLowerCase();
  const lines: string[] = ['GỢI Ý CHỌN PROVIDER / MODEL:'];
  if (/local|offline|riêng tư|private|free|mien phi|9router/.test(q) || !q) {
    lines.push('• Gần miễn phí: 9Router (proxy combo Kiro/OpenCode…) hoặc Ollama + llama3.2 / qwen2.5.');
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
