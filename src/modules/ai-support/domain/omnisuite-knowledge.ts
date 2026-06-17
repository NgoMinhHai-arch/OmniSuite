/**
 * Knowledge base vá» dá»± Ã¡n OmniSuite â€” nguá»“n sá»± tháº­t Ä‘á»ƒ AI Há»— trá»£ "biáº¿t" sáº£n pháº©m.
 *
 * Thiáº¿t káº¿:
 * - Dáº¡ng dá»¯ liá»‡u thuáº§n TS (typed) â†’ vá»«a render Ä‘Æ°á»£c trong chat tráº£ lá»i tÄ©nh,
 *   vá»«a serialize gá»n vÃ o system prompt cho LLM.
 * - TrÃ¡nh bÃª toÃ n bá»™ tÃ i liá»‡u vÃ o prompt (Ä‘á»‘t token); chá»‰ kÃ¨m khá»‘i tÃ³m táº¯t cÃ´ Ä‘á»ng.
 */

import { DEFAULT_PYTHON_ENGINE_URL } from '@/shared/lib/python-engine-url';

export interface OmniSuitePage {
  /** ÄÆ°á»ng dáº«n sidebar */
  href: string;
  /** TÃªn hiá»ƒn thá»‹ trong UI */
  name: string;
  /** Má»™t dÃ²ng mÃ´ táº£ má»¥c Ä‘Ã­ch â€” trÃ¡nh dÃ i dÃ²ng Ä‘á»ƒ gá»n prompt */
  what: string;
  /** CÃ¡c bÆ°á»›c nhanh ngÆ°á»i dÃ¹ng cáº§n lÃ m (tá»‘i Ä‘a 4 bÆ°á»›c) */
  steps?: string[];
  /** Khi nÃ o nÃªn dÃ¹ng */
  whenToUse?: string;
  /** Tá»« khÃ³a thÃªm Ä‘á»ƒ match /howto vÃ  chat tá»± nhiÃªn (khÃ´ng dáº¥u khÃ´ng báº¯t buá»™c â€” sáº½ normalize). */
  aliases?: string[];
}

/** CÃ¡c trang chÃ­nh theo Sidebar.tsx â€” KHÃ”NG liá»‡t kÃª hÆ¡n 100 sub-tool SEO Ä‘á»ƒ trÃ¡nh phÃ¬nh prompt. */
export const OMNISUITE_PAGES: OmniSuitePage[] = [
  {
    href: '/dashboard',
    name: 'Tá»•ng quan',
    what: 'Trang chá»§, hiá»ƒn thá»‹ metrics + truy cáº­p nhanh cÃ¡c cÃ´ng cá»¥.',
    whenToUse: 'Báº¯t Ä‘áº§u phiÃªn lÃ m viá»‡c / xem tá»•ng sá»‘ láº§n dÃ¹ng tool.',
    aliases: ['trang chu', 'home dashboard'],
  },
  {
    href: '/dashboard/keywords',
    name: 'PhÃ¢n tÃ­ch Tá»« khÃ³a',
    what: 'Sinh & phÃ¢n tÃ­ch bá»™ keyword, gom cá»¥m, gá»£i Ã½ Ã½ tÆ°á»Ÿng ná»™i dung.',
    steps: [
      'Nháº­p seed keyword + chá»n provider LLM',
      'Báº¥m "Táº¡o" Ä‘á»ƒ generate (Universal Intent + DataForSEO/SERP náº¿u cÃ³ key)',
      'Xuáº¥t Excel/CSV Ä‘á»ƒ dÃ¹ng cho bÃ i viáº¿t',
    ],
    whenToUse: 'TrÆ°á»›c khi viáº¿t bÃ i / lÃªn silo / tÃ¬m long-tail.',
    aliases: ['tu khoa', 'keyword', 'keywords', 'phan tich tu khoa'],
  },
  {
    href: '/dashboard/content',
    name: 'Viáº¿t bÃ i AI',
    what: 'Research â†’ outline â†’ bÃ i viáº¿t hoÃ n chá»‰nh, cÃ³ queue bulk & similarity guard.',
    steps: [
      'Nháº­p chá»§ Ä‘á» / tá»« khÃ³a chÃ­nh',
      'Chá»n LLM provider (Gemini/OpenAI/Claude/Groq/DeepSeek/OpenRouter/Ollama/9Router)',
      'Cáº¥u hÃ¬nh variants (sá»‘ bÃ i) â†’ báº¥m báº¯t Ä‘áº§u',
      'Theo dÃµi queue, táº£i DOCX khi xong',
    ],
    whenToUse: 'Sáº£n xuáº¥t ná»™i dung sá»‘ lÆ°á»£ng lá»›n theo silo / tá»« khÃ³a.',
    aliases: ['viet bai', 'tao bai', 'content', 'article'],
  },
  {
    href: '/dashboard/maps',
    name: 'QuÃ©t báº£n Ä‘á»“',
    what: 'Scrape Google Maps / Ä‘á»‹a Ä‘iá»ƒm doanh nghiá»‡p.',
    steps: [
      'Sidebar â†’ QuÃ©t báº£n Ä‘á»“ hoáº·c má»Ÿ /dashboard/maps.',
      'Chá»n khu vá»±c / loáº¡i hÃ¬nh (theo form trÃªn trang).',
      'Nháº­p tá»« khÃ³a hoáº·c Ä‘iá»u kiá»‡n lá»c â†’ cháº¡y quÃ©t.',
      'Xem danh sÃ¡ch Ä‘á»‹a Ä‘iá»ƒm; xuáº¥t hoáº·c sao chÃ©p dá»¯ liá»‡u khi tool há»— trá»£.',
    ],
    whenToUse: 'Cáº§n data lead / Ä‘á»‹a Ä‘iá»ƒm theo tá»« khÃ³a & vá»‹ trÃ­.',
    aliases: ['ban do', 'google maps', 'maps', 'dia diem', 'doanh nghiep maps', 'lead dia diem'],
  },
  {
    href: '/dashboard/seo-tools',
    name: 'Bá»™ cÃ´ng cá»¥ SEO',
    what: 'Hub gá»“m hÆ¡n 80 sub-tool: silo, content gap, GSC, schema, redirect, sitemap, classificationâ€¦',
    whenToUse: 'Cáº§n má»™t thao tÃ¡c SEO chuyÃªn biá»‡t â€” vÃ o hub rá»“i tÃ¬m theo tÃªn.',
    aliases: ['seo tools', 'hub seo', 'cong cu seo'],
  },
  {
    href: '/dashboard/seo-tools/scraper',
    name: 'Kiá»ƒm tra website',
    what: 'Crawl & audit URL: meta, schema, sitemap, link ná»™i bá»™.',
    whenToUse: 'Audit nhanh má»™t URL trÆ°á»›c khi tá»‘i Æ°u.',
    aliases: ['kiem tra web', 'audit site', 'crawl url', 'scraper', 'seo tools scraper'],
  },
  {
    href: '/dashboard/seo-tools/advanced',
    name: 'SEO nÃ¢ng cao',
    what: 'Bundle cÃ¡c API SEO nÃ¢ng cao (DataForSEO backlinks/intersect, Wikipedia citation, dead-link reclaimerâ€¦).',
    whenToUse: 'PhÃ¢n tÃ­ch backlink / cÆ¡ há»™i nÃ¢ng cao cÃ³ data SaaS.',
    aliases: ['advanced seo', 'seo nang cao'],
  },
  {
    href: '/dashboard/images',
    name: 'TÃ¬m hÃ¬nh áº£nh',
    what: 'TÃ¬m & táº£i áº£nh hÃ ng loáº¡t phá»¥c vá»¥ bÃ i viáº¿t.',
    whenToUse: 'Cáº§n áº£nh minh há»a cho article / WooCommerce.',
    aliases: ['tim hinh', 'anh minh hoa', 'images'],
  },
  {
    href: '/dashboard/ai-support',
    name: 'Quáº£n gia',
    what:
      'Trá»£ lÃ½ tiáº¿ng Viá»‡t trong app: chat tá»± nhiÃªn + slash. Biáº¿t sáº£n pháº©m OmniSuite (trang, LLM, lá»—i thÆ°á»ng gáº·p). CÃ³ Tavily/SerpAPI â†’ tÃ¬m web. CÃ³ runner â†’ /run (OpenManus), /run-browser (Playwright). LuÃ´n má»Ÿ Ä‘Ãºng origin Next (vd. http://127.0.0.1:3000).',
    steps: [
      'Má»Ÿ /dashboard/ai-support',
      'Má»›i vÃ o: gÃµ /tour hoáº·c /tools',
      'Cáº§n hÆ°á»›ng dáº«n trang: /howto viáº¿t bÃ i AI (hoáº·c keywords, ollama, 9routerâ€¦)',
      'Cáº§n káº¿ hoáº¡ch agent: /plan â€” thá»±c thi local: /run hoáº·c /run-browser (náº¿u Ä‘Ã£ báº­t runner)',
    ],
    whenToUse: 'KhÃ´ng biáº¿t báº¯t Ä‘áº§u tá»« Ä‘Ã¢u, cáº§n Ä‘iá»u hÆ°á»›ng nhanh, hoáº·c gá»£i Ã½ workflow SEO/content.',
    aliases: ['quan gia', 'tro ly', 'ai support', 'chat ho tro', 'butler', 'omnisuite'],
  },
  {
    href: '/dashboard/settings',
    name: 'Cáº¥u hÃ¬nh há»‡ thá»‘ng',
    what:
      'Nháº­p API key cloud (Gemini/OpenAI/Claude/Groq/DeepSeek/OpenRouter), Ollama (local/tunnel), 9Router (proxy miá»…n phÃ­ OpenAI-compat), Tavily/SerpAPI, SerpAPIâ€¦ Chá»n provider + model máº·c Ä‘á»‹nh. LÆ°u trong trÃ¬nh duyá»‡t (localStorage), khÃ´ng commit git.',
    steps: [
      'Má»Ÿ /dashboard/settings',
      'DÃ¡n API key hoáº·c URL mÃ¡y chá»§ (Ollama / 9Router)',
      'Chá»n "NhÃ  cung cáº¥p AI máº·c Ä‘á»‹nh" â†’ quÃ©t model â†’ chá»n model máº·c Ä‘á»‹nh',
      'Báº¥m LÆ°u â€” reload tab tool náº¿u vá»«a Ä‘á»•i provider',
    ],
    whenToUse: 'TrÆ°á»›c khi dÃ¹ng LLM, tÃ¬m web (Quáº£n gia), hoáº·c tool cáº§n SerpAPI/DataForSEO.',
    aliases: ['cau hinh', 'settings', 'api key', 'cau hinh he thong'],
  },
];

/** Bá»‘i cáº£nh sáº£n pháº©m â€” dÃ¹ng trong prompt vÃ  /howto omnisuite. */
export const OMNISUITE_PRODUCT_FACTS = {
  tagline:
    'OmniSuite = hub SEO/marketing trÃªn Next.js 16 + Python FastAPI: tá»« khÃ³a, viáº¿t bÃ i AI, quÃ©t Maps, 80+ tool SEO, Quáº£n gia (chat tiáº¿ng Viá»‡t).',
  stack: [
    'Frontend: Next.js 16 (App Router), React 19, Tailwind â€” dashboard táº¡i /dashboard/*',
    'Python engine: FastAPI cá»•ng 8082 (PYTHON_ENGINE_URL) â€” keywords, content queue, job',
    'Khá»Ÿi cháº¡y: npm run app hoáº·c node launcher.js (Next + Python cÃ¹ng lÃºc)',
    'API keys UI: localStorage key omnisuite_settings; .env cho server/runner (khÃ´ng commit)',
  ],
  dataFlow: [
    'Viáº¿t bÃ i / SEO tool (Next) â†’ gá»i LLM qua API route hoáº·c proxy sang Python engine',
    'PhÃ¢n tÃ­ch tá»« khÃ³a: UI Next â†’ POST Python /keywords vá»›i provider + api_keys',
    'Quáº£n gia: chat táº¡i /dashboard/ai-support â€” slash tÄ©nh (khÃ´ng LLM) hoáº·c LLM + optional Tavily/SerpAPI',
  ],
  securityNotes: [
    'Runner (/run, /run-browser): Táº®T máº·c Ä‘á»‹nh â€” cáº§n AI_SUPPORT_RUNNER_ENABLED=true (thá»±c thi code local)',
    'KhÃ´ng cÃ³ auth toÃ n cá»¥c trÃªn má»i /api â€” giáº£ Ä‘á»‹nh mÃ¡y tin cáº­y / localhost',
    'OMNISUITE_LOCALHOST_ONLY=1 máº·c Ä‘á»‹nh â€” chá»‰ localhost truy cáº­p dashboard',
  ],
};

/** Vai trÃ² vÃ  giá»›i háº¡n cá»§a Quáº£n gia â€” trÃ¡nh bá»‹a tÃ­nh nÄƒng. */
export const BUTLER_CAPABILITIES = {
  can: [
    'Tráº£ lá»i tiáº¿ng Viá»‡t vá» cÃ¡ch dÃ¹ng OmniSuite (trang, workflow, provider LLM)',
    'Äá» xuáº¥t nÃºt má»Ÿ trang (/dashboard/...) hoáº·c lá»‡nh slash (/plan, /howto, /runâ€¦)',
    'TÃ¬m web khi cÃ³ Tavily/SerpAPI (/web hoáº·c tá»± Ä‘oÃ¡n khi cáº§n thÃ´ng tin ngoÃ i app)',
    'Láº­p káº¿ hoáº¡ch 3 táº§ng (/plan), kiá»ƒm tra key (/check), tour (/tour)',
  ],
  cannot: [
    'KhÃ´ng trá»±c tiáº¿p cháº¡y tool SEO thay chá»§ nhÃ¢n (chá»‰ hÆ°á»›ng dáº«n + má»Ÿ Ä‘Ãºng trang)',
    'KhÃ´ng Ä‘á»c file trÃªn mÃ¡y chá»§ ngoÃ i pháº¡m vi API Ä‘Ã£ expose',
    'KhÃ´ng báº­t runner náº¿u .env chÆ°a cho phÃ©p â€” pháº£i nháº¯c cáº¥u hÆ°á»›ng',
  ],
};

/** Chuáº©n hÃ³a nháº¹ Ä‘á»ƒ match tiáº¿ng Viá»‡t (bá» dáº¥u, Ä‘â†’d). */
export function normalizeViFold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ä‘/gi, 'd')
    .toLowerCase()
    .trim();
}

/** TÃ¬m trang sidebar khá»›p chá»§ Ä‘á» (tÃªn, alias, slug href). */
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
  /cÃ¡ch\s+(dÃ¹ng|sá»­\s*dá»¥ng|má»Ÿ|vÃ o)|sá»­\s*dá»¥ng\s+(tool\s*)?|lÃ m\s+(sao|tháº¿\s*nÃ o|cÃ¡ch\s*nÃ o)(\s+Ä‘á»ƒ)?|hÆ°á»›ng\s*dáº«n(\s+tÃ´i|\s+mÃ¬nh)?|má»Ÿ\s+tool|dÃ¹ng\s+(tool\s*)?|how\s+to\s+use|cÃ¡ch\s+váº­n\s*hÃ nh|cháº¡y\s+(tool\s*)?|sá»­\s*dá»¥ng\s+chá»©c\s+nÄƒng/i;

export function formatOmniSuiteHowToPage(match: OmniSuitePage): string {
  const lines = [`HÆ¯á»šNG DáºªN: ${match.name} (${match.href})`, '', match.what];
  if (match.whenToUse) lines.push(`Khi nÃ o dÃ¹ng: ${match.whenToUse}`);
  if (match.steps && match.steps.length) {
    lines.push('\nCÃ¡c bÆ°á»›c:');
    match.steps.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
  }
  return lines.join('\n');
}

/** Tráº£ lá»i tÄ©nh nhanh cho chat khi user há»i â€œcÃ¡ch dÃ¹ng â€¦â€ trong app â€” khÃ´ng gá»i LLM. */
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
    label: `Má»Ÿ ${page.name}`,
  };
}

/** Provider LLM Ä‘Æ°á»£c há»— trá»£ â€” UI chá»n á»Ÿ Cáº¥u hÃ¬nh & á»Ÿ tá»«ng tool. */
export const SUPPORTED_LLM_PROVIDERS = [
  { id: 'google', label: 'Gemini', notes: 'Cáº§n GEMINI_API_KEY hoáº·c nháº­p á»Ÿ Cáº¥u hÃ¬nh.' },
  { id: 'openai', label: 'OpenAI', notes: 'Cáº§n OPENAI_API_KEY.' },
  { id: 'claude', label: 'Claude', notes: 'Cáº§n CLAUDE_API_KEY / ANTHROPIC_API_KEY.' },
  { id: 'groq', label: 'Groq', notes: 'Free tier há»£p cho task nhanh.' },
  { id: 'deepseek', label: 'DeepSeek', notes: 'GiÃ¡ ráº» cho task lÃ½ luáº­n.' },
  { id: 'openrouter', label: 'OpenRouter', notes: 'Gateway nhiá»u model â€” cÃ³ rate limit chia sáº».' },
  { id: 'ollama', label: 'Ollama', notes: 'Local 100% offline. Máº·c Ä‘á»‹nh http://localhost:11434.' },
  {
    id: '9router',
    label: '9Router',
    notes:
      'Proxy OpenAI-compat local http://127.0.0.1:20128/v1 â€” route tá»›i 40+ provider (Kiro, OpenCode Freeâ€¦). CÃ i: npm i -g 9router && 9router. Key copy tá»« dashboard 9Router.',
  },
];

/** Äáº·c táº£ ngáº¯n cÃ¡ch OmniSuite váº­n hÃ nh Ollama mÆ°á»£t â€” Ä‘á»“ng bá»™ vá»›i src/shared/lib/ollama.ts. */
export const OLLAMA_RUNTIME_DEFAULTS = {
  sequentialQueue: 'Máº·c Ä‘á»‹nh 1 inference / tiáº¿n trÃ¬nh (Next.js & Python). Task xáº¿p hÃ ng, khÃ´ng spike VRAM.',
  keepAlive: 'Má»—i request Ä‘Ã­nh kÃ¨m keep_alive=30s â†’ daemon Ollama tá»± unload sau 30s idle.',
  numCtx: 'Má»—i request gá»­i num_ctx=4096 â†’ KV-cache nhá», model 3B chá»‰ cáº§n ~3 GiB RAM thay vÃ¬ 13 GiB (Modelfile máº·c Ä‘á»‹nh 128k).',
  idleWatcher: 'Sau 2 phÃºt khÃ´ng cÃ³ inference, OmniSuite chá»§ Ä‘á»™ng gá»i /api/ps + unload má»i model.',
  shutdownUnload: 'Khi táº¯t app (Ctrl+C / OmniSuite.exe), launcher gá»i unload toÃ n bá»™ model trÆ°á»›c khi thoÃ¡t.',
  override: 'Override qua biáº¿n mÃ´i trÆ°á»ng: OLLAMA_MAX_CONCURRENT, OLLAMA_KEEP_ALIVE, OLLAMA_NUM_CTX, OLLAMA_IDLE_UNLOAD_MS, OLLAMA_TIMEOUT_MS.',
};

/** 9Router â€” proxy AI miá»…n phÃ­ (https://github.com/decolua/9router). */
export const NINEROUTER_SETUP = {
  install: 'npm i -g 9router â†’ cháº¡y lá»‡nh 9router (dashboard http://127.0.0.1:20128)',
  settings:
    'Cáº¥u hÃ¬nh â†’ provider 9Router â†’ API key tá»« dashboard 9Router â†’ URL Ä‘á»ƒ trá»‘ng = http://127.0.0.1:20128',
  models: 'QuÃ©t model trong Cáº¥u hÃ¬nh; dÃ¹ng id combo 9Router (vd. cc/claude-sonnet-4-5, kr/claude-sonnet-4.5)',
  pythonOnly: 'Route má»i LLM Python qua 9Router: LITELLM_BASE_URL=http://127.0.0.1:20128 trong .env (khÃ´ng thÃªm /v1)',
};

/** CÃ¡c váº¥n Ä‘á» thÆ°á»ng gáº·p + cÃ¡ch xá»­ lÃ½ nhanh. */
export const TROUBLESHOOT_KNOWLEDGE: Array<{ problem: string; fix: string }> = [
  {
    problem: 'Chá»n provider Ollama nhÆ°ng "ChÆ°a cÃ³ model"',
    fix: 'Má»Ÿ terminal cháº¡y: ollama serve â†’ ollama pull llama3.2 (hoáº·c qwen2.5 / mistral). Reload trang.',
  },
  {
    problem: 'Ollama: "model requires more system memory (X GiB) than is available"',
    fix: [
      'Lá»—i nÃ y thÆ°á»ng do Modelfile khai bÃ¡o num_ctx=131072 (128k). KV-cache vÃ¬ tháº¿ Ä‘Ã²i >10 GiB cho model 3B.',
      '1) OmniSuite tá»« phiÃªn báº£n nÃ y Ä‘Ã£ cap num_ctx=4096 máº·c Ä‘á»‹nh (qua OLLAMA_NUM_CTX). Restart app + thá»­ láº¡i.',
      '2) Náº¿u váº«n thiáº¿u RAM: táº£i model nhá» hÆ¡n â†’ ollama pull llama3.2:1b  (hoáº·c qwen2.5:1.5b, phi3.5:3.8b-mini-instruct-q4_K_M).',
      '3) ÄÃ³ng app khÃ¡c (Chrome, IDEâ€¦) hoáº·c Ä‘áº·t OLLAMA_KEEP_ALIVE=0 Ä‘á»ƒ unload ngay sau má»—i gá»i.',
      '4) Háº¡ context cá»±c tháº¥p: OLLAMA_NUM_CTX=2048 trong .env.',
      '5) Äáº·t OLLAMA_MAX_LOADED_MODELS=1 cho daemon Ollama (env há»‡ thá»‘ng cá»§a Ollama, khÃ´ng pháº£i OmniSuite).',
    ].join(' '),
  },
  {
    problem: 'Ollama tráº£ lá»—i thiáº¿u RAM/VRAM (chung)',
    fix: 'KÃ©o model nhá» hÆ¡n (1B/3B Q4), Ä‘áº·t OLLAMA_KEEP_ALIVE=0, hoáº·c giáº£m OLLAMA_NUM_CTX (máº·c Ä‘á»‹nh 4096, cÃ³ thá»ƒ háº¡ xuá»‘ng 2048).',
  },
  {
    problem: 'Lá»—i "Missing API key"',
    fix: 'VÃ o /dashboard/settings, nháº­p API key cho provider Ä‘ang chá»n. Hoáº·c Ä‘á»•i sang Ollama (khÃ´ng cáº§n key).',
  },
  {
    problem: '429 quota exceeded (OpenRouter / Gemini free)',
    fix: 'Chuyá»ƒn provider khÃ¡c trong Cáº¥u hÃ¬nh, hoáº·c giáº£m sá»‘ variants/concurrency, hoáº·c náº¡p credit.',
  },
  {
    problem: 'Job Viáº¿t bÃ i AI cháº¡y cháº­m / treo',
    fix: 'Má»Ÿ /dashboard/content â†’ kiá»ƒm tra queue â†’ cancel job há»ng. Vá»›i Ollama: tÄƒng OLLAMA_TIMEOUT_MS.',
  },
  {
    problem: 'Sidebar khÃ´ng tháº¥y tool cáº§n dÃ¹ng',
    fix: 'VÃ o /dashboard/seo-tools (Bá»™ cÃ´ng cá»¥ SEO) â€” hub gom 80+ sub-tool. TÃ¬m theo tÃªn á»Ÿ trÃªn cÃ¹ng.',
  },
  {
    problem: '/run hoáº·c /run-browser tráº£ "AI_SUPPORT_RUNNER_ENABLED chÆ°a báº­t"',
    fix: 'Äáº·t AI_SUPPORT_RUNNER_ENABLED=true trong .env (cáº£nh bÃ¡o: cho phÃ©p thá»±c thi code/local trÃªn mÃ¡y). Restart app.',
  },
  {
    problem: '/run bÃ¡o "setup_required" hoáº·c khÃ´ng táº£i Ä‘Æ°á»£c OpenManus',
    fix: 'GÃµ láº¡i /run <nhiá»‡m vá»¥> â€” láº§n Ä‘áº§u app tá»± táº£i. Hoáº·c: npm run integrations:fetch -- open_manus. Xem /tai. Sau khi cÃ³ repo: scripts/setup-runners-venv.ps1 náº¿u thiáº¿u pip.',
  },
  {
    problem: '/run-browser bÃ¡o "setup_required" (browser_use / playwright)',
    fix: 'GÃµ láº¡i /run-browser â€¦ Ä‘á»ƒ tá»± táº£i browser-use, hoáº·c npm run integrations:fetch -- browser_use. Playwright: scripts/setup-runners-venv.ps1 hoáº·c python -m playwright install chromium trong venv.',
  },
  {
    problem: 'Muá»‘n táº£i gÃ³i Quáº£n gia mÃ  khÃ´ng cháº¡y runner',
    fix: 'GÃµ /tai hoáº·c /tai open_manus | /tai browser. Chá»‰ clone OmniSuite lÃ  Ä‘á»§ â€” khÃ´ng cáº§n npm run integrations:sync lÃºc má»›i cÃ i.',
  },
  {
    problem: '9Router: khÃ´ng káº¿t ná»‘i / khÃ´ng láº¥y Ä‘Æ°á»£c model',
    fix: 'Cháº¡y 9router trong terminal. Má»Ÿ http://127.0.0.1:20128 â†’ káº¿t ná»‘i provider trong dashboard â†’ copy API key vÃ o Cáº¥u hÃ¬nh OmniSuite. DÃ¹ng 127.0.0.1 thay localhost náº¿u lá»—i IPv6.',
  },
  {
    problem: 'Python engine khÃ´ng cháº¡y / keywords lá»—i 502',
    fix: `Kiá»ƒm tra PYTHON_ENGINE_URL=${DEFAULT_PYTHON_ENGINE_URL}. Cháº¡y npm run app (launcher khá»Ÿi Ä‘á»™ng FastAPI). Xem log python_engine â€” PostgreSQL pháº£i cháº¡y náº¿u route cáº§n DB.`,
  },
  {
    problem: 'Quáº£n gia slash /run lá»—i hoáº·c khÃ´ng pháº£n há»“i',
    fix: 'Má»Ÿ Quáº£n gia trÃªn cÃ¹ng origin vá»›i Next (vd. http://127.0.0.1:3000), khÃ´ng embed host khÃ¡c. Báº­t AI_SUPPORT_RUNNER_ENABLED vÃ  cÃ i .venv-runners.',
  },
  {
    problem: 'ÄÄƒng nháº­p dashboard láº·p vÃ´ háº¡n',
    fix: 'Äáº·t NEXTAUTH_SECRET trong .env. XÃ³a cookie session cÅ©. Cháº¡y láº¡i npm run dev.',
  },
];

/** Workflow máº«u Ä‘á»ƒ gá»£i Ã½ ngÆ°á»i dÃ¹ng â€” dÃ¹ng cho /tour vÃ  /howto generic. */
export const COMMON_WORKFLOWS: Array<{ title: string; steps: string[] }> = [
  {
    title: 'Sáº£n xuáº¥t ná»™i dung tá»« 0',
    steps: [
      '1. /dashboard/settings â†’ nháº­p API key (hoáº·c báº­t Ollama)',
      '2. /dashboard/keywords â†’ nháº­p seed keyword, generate cá»¥m tá»«',
      '3. /dashboard/seo-tools â†’ silo / topical map (tuá»³ chá»n)',
      '4. /dashboard/content â†’ chá»n keyword + variants â†’ run',
      '5. Táº£i DOCX khi queue xong',
    ],
  },
  {
    title: 'Audit website nhanh',
    steps: [
      '1. /dashboard/seo-tools/scraper â†’ nháº­p URL',
      '2. /dashboard/seo-tools/advanced â†’ backlink / dead-link náº¿u cÃ³ DataForSEO',
      '3. /dashboard/seo-tools/[cÃ´ng cá»¥] â†’ tá»‘i Æ°u theo issue tÃ¬m Ä‘Æ°á»£c',
    ],
  },
  {
    title: 'Láº­p káº¿ hoáº¡ch agent vá»›i Quáº£n gia',
    steps: [
      '1. /dashboard/ai-support â†’ mÃ´ táº£ má»¥c tiÃªu',
      '2. GÃµ /plan (hoáº·c /browser) Ä‘á»ƒ cÃ³ káº¿ hoáº¡ch 3 táº§ng (nÃ£o / agent / tool)',
      '3. Thá»±c thi local: /run <task> (OpenManus) hoáº·c /run-browser <task> (browser-use + Playwright)',
    ],
  },
  {
    title: 'DÃ¹ng AI gáº§n nhÆ° miá»…n phÃ­ (9Router + Ollama)',
    steps: [
      '1. CÃ i 9router (npm i -g 9router) hoáº·c Ollama (ollama.com)',
      '2. /dashboard/settings â†’ 9Router hoáº·c Ollama lÃ m provider máº·c Ä‘á»‹nh',
      '3. QuÃ©t model â†’ chá»n combo/model phÃ¹ há»£p',
      '4. DÃ¹ng Viáº¿t bÃ i AI / Keywords / Quáº£n gia vá»›i cÃ¹ng provider',
    ],
  },
];

/**
 * Khá»‘i knowledge cÃ´ Ä‘á»ng inject vÃ o system prompt LLM.
 * GIá»® NGáº®N Gá»ŒN â€” Ä‘Ã¢y lÃ  context cho má»—i turn chat.
 */
export function buildOmniSuiteOverviewAnswer(): string {
  const lines: string[] = [
    'OMNISUITE â€” Tá»”NG QUAN (cho Quáº£n gia / chá»§ nhÃ¢n)',
    '',
    OMNISUITE_PRODUCT_FACTS.tagline,
    '',
    'Kiáº¿n trÃºc:',
    ...OMNISUITE_PRODUCT_FACTS.stack.map((s) => `â€¢ ${s}`),
    '',
    'Luá»“ng dá»¯ liá»‡u chÃ­nh:',
    ...OMNISUITE_PRODUCT_FACTS.dataFlow.map((s) => `â€¢ ${s}`),
    '',
    'Quáº£n gia (em) cÃ³ thá»ƒ:',
    ...BUTLER_CAPABILITIES.can.map((s) => `â€¢ ${s}`),
    '',
    'Quáº£n gia KHÃ”NG:',
    ...BUTLER_CAPABILITIES.cannot.map((s) => `â€¢ ${s}`),
    '',
    'Báº¯t Ä‘áº§u nhanh: /tour â†’ /tools â†’ /dashboard/settings (API key) â†’ /howto <tÃªn trang>.',
  ];
  return lines.join('\n');
}

export function omniSuiteKnowledgePromptBlock(): string {
  const pageLines = OMNISUITE_PAGES.map((p) => `- ${p.href} (${p.name}): ${p.what}`).join('\n');
  const providerLines = SUPPORTED_LLM_PROVIDERS.map((p) => `- ${p.id} â†’ ${p.label}: ${p.notes}`).join('\n');
  return [
    '# OMNISUITE â€” bá»‘i cáº£nh sáº£n pháº©m báº¡n Ä‘ang há»— trá»£',
    OMNISUITE_PRODUCT_FACTS.tagline,
    'Báº¡n lÃ  QUáº¢N GIA: trá»£ lÃ½ váº­n hÃ nh OmniSuite â€” chá»‰ tiáº¿ng Viá»‡t, gá»n, Ä‘Æ°a viá»‡c cá»¥ thá»ƒ (href /dashboard hoáº·c slash).',
    'KhÃ´ng bá»‹a URL/tÃ­nh nÄƒng ngoÃ i danh sÃ¡ch dÆ°á»›i Ä‘Ã¢y.',
    '',
    '## Kiáº¿n trÃºc (nhá»› khi debug)',
    ...OMNISUITE_PRODUCT_FACTS.stack.map((s) => `- ${s}`),
    '',
    '## Trang chÃ­nh (sidebar)',
    pageLines,
    '',
    '## Provider LLM há»— trá»£',
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
    '## Cáº¥u hÃ¬nh API',
    '- UI: /dashboard/settings â†’ lÆ°u localStorage (omnisuite_settings)',
    '- Server: .env (GEMINI_API_KEY, PYTHON_ENGINE_URL, runner flagsâ€¦) â€” khÃ´ng commit',
    '',
    '## Slash command trong Quáº£n gia',
    '- /help: liá»‡t kÃª lá»‡nh',
    '- /tour: tour tá»•ng quan OmniSuite',
    '- /tools: danh sÃ¡ch trang chÃ­nh',
    '- /howto <tá»« khÃ³a>: hÆ°á»›ng dáº«n dÃ¹ng tÃ­nh nÄƒng cá»¥ thá»ƒ (vd. viáº¿t bÃ i AI, ollama, 9router, omnisuite)',
    '- /check: kiá»ƒm tra API key / provider Ä‘Ã£ cáº¥u hÃ¬nh',
    '- /llm: gá»£i Ã½ chá»n provider/model phÃ¹ há»£p',
    '- /settings: nháº¯c Ä‘Æ°á»ng dáº«n Cáº¥u hÃ¬nh',
    '- /troubleshoot <váº¥n Ä‘á»>: gá»£i Ã½ sá»­a lá»—i',
    '- /web <truy váº¥n>: báº¯t buá»™c tÃ¬m web (Tavily hoáº·c SerpAPI). Nháº¯n bÃ¬nh thÆ°á»ng: quáº£n gia cÃ³ thá»ƒ tá»± tÃ¬m web náº¿u cÃ³ key.',
    '- /plan: láº­p káº¿ hoáº¡ch 3 táº§ng (nÃ£o/agent/tool)',
    '- /browser: Æ°u tiÃªn Browser Agent khi /plan',
    '- /run <task>: OpenManus â€” láº§n Ä‘áº§u tá»± táº£i repo con (khÃ´ng cáº§n integrations:sync trÆ°á»›c). Cáº§n AI_SUPPORT_RUNNER_ENABLED=true.',
    '- /run-browser <task>: browser-use â€” láº§n Ä‘áº§u tá»± táº£i gÃ³i. CÃ¹ng cá» runner; pip/playwright tÃ¹y chá»n (setup-runners-venv.ps1).',
    '- /tai [open_manus|browser|crawl4ai]: hÆ°á»›ng dáº«n táº£i gÃ³i (integrations:fetch).',
    '- /tai-bang: báº£ng integration Ä‘Ã£ táº£i / chÆ°a táº£i trÃªn mÃ¡y.',
    '- /integrations: danh sÃ¡ch integration trong manifest (táº£i theo nhu cáº§u, khÃ´ng táº£i háº¿t lÃºc cÃ i app).',
    '- /apply <doctor|init|run|apply>: cháº¡y ApplyPilot CLI (auto-apply jobs).',
    '- /score <jd>: score JD vs resume qua job-scraper LLM client.',
  ].join('\n');
}

/** Báº£n render dÃ i hÆ¡n cho /tour (tráº£ tÄ©nh, khÃ´ng gá»i LLM). */
export function buildTourAnswer(): string {
  const lines: string[] = [
    'TOUR OMNISUITE â€” 60 giÃ¢y',
    '',
    OMNISUITE_PRODUCT_FACTS.tagline,
    '',
    'OmniSuite cÃ³ 3 nhÃ³m:',
    '1) Tá»”NG QUAN â€” /dashboard',
    '2) CÃ”NG Cá»¤ â€” keywords / content / maps / seo-tools / images / ai-support (Quáº£n gia)',
    '3) Há»† THá»NG â€” settings (API key, Ollama, 9Router, Tavilyâ€¦)',
    '',
    'Em (Quáº£n gia) á»Ÿ /dashboard/ai-support â€” gÃµ /help Ä‘á»ƒ xem lá»‡nh slash.',
    '',
    'DÃ²ng cháº£y Ä‘iá»ƒn hÃ¬nh:',
  ];
  COMMON_WORKFLOWS.forEach((wf, idx) => {
    lines.push(`\n[${idx + 1}] ${wf.title}`);
    wf.steps.forEach((s) => lines.push(`  ${s}`));
  });
  lines.push('');
  lines.push('GÃµ /tools Ä‘á»ƒ xem chi tiáº¿t tá»«ng trang, /howto <tÃªn> Ä‘á»ƒ hÆ°á»›ng dáº«n cá»¥ thá»ƒ.');
  return lines.join('\n');
}

/** Báº£n render cho /tools (tÄ©nh). */
export function buildToolsAnswer(): string {
  const lines: string[] = ['CÃC TRANG CHÃNH â€” báº¥m vÃ o sidebar tÆ°Æ¡ng á»©ng:'];
  OMNISUITE_PAGES.forEach((p) => {
    lines.push(`\nâ€¢ ${p.name}  â†’  ${p.href}`);
    lines.push(`  ${p.what}`);
    if (p.whenToUse) lines.push(`  Khi nÃ o dÃ¹ng: ${p.whenToUse}`);
  });
  lines.push('\nMuá»‘n cÃ¡ch dÃ¹ng cá»¥ thá»ƒ: /howto <tÃªn trang> (vd: /howto viáº¿t bÃ i AI).');
  return lines.join('\n');
}

/** /howto <query> â€” match theo tÃªn / href / tá»« khÃ³a. */
export function buildHowToAnswer(query: string): string | null {
  const q = query.trim().toLowerCase();
  if (!q) {
    return 'CÃº phÃ¡p: /howto <tÃªn trang>. VÃ­ dá»¥: /howto viáº¿t bÃ i AI, /howto keywords, /howto ollama, /howto 9router, /howto omnisuite.';
  }
  if (/(omnisuite|san pham|la gi|tong quan|kien truc|architecture)/.test(q)) {
    return buildOmniSuiteOverviewAnswer();
  }
  if (/(9router|9 router|chin router)/.test(q)) {
    return [
      'CÃCH DÃ™NG 9ROUTER Vá»šI OMNISUITE:',
      `1. ${NINEROUTER_SETUP.install}`,
      '2. Trong dashboard 9Router: káº¿t ná»‘i provider (Kiro, OpenCode Freeâ€¦) + táº¡o API key',
      `3. ${NINEROUTER_SETUP.settings}`,
      `4. ${NINEROUTER_SETUP.models}`,
      '5. DÃ¹ng Viáº¿t bÃ i AI / Keywords / Quáº£n gia vá»›i cÃ¹ng provider 9Router',
      `6. (Tuá»³ chá»n Python) ${NINEROUTER_SETUP.pythonOnly}`,
    ].join('\n');
  }
  if (/(ollama|local llm|gpu|vram)/.test(q)) {
    return [
      'CÃCH DÃ™NG OLLAMA (LOCAL, KHÃ”NG Tá»N API KEY):',
      '1. CÃ i Ollama: https://ollama.com',
      '2. Terminal: ollama serve',
      '3. Táº£i model: ollama pull llama3.2 (hoáº·c qwen2.5 / mistral)',
      '4. /dashboard/settings â†’ NhÃ  cung cáº¥p AI máº·c Ä‘á»‹nh = Ollama (URL Ä‘á»ƒ trá»‘ng lÃ  dÃ¹ng localhost)',
      '5. OmniSuite tá»± queue 1 task/láº§n, auto-unload khi idle, giáº£i phÃ³ng VRAM khi táº¯t app.',
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

/** /troubleshoot <query> â€” match theo tá»« khÃ³a lá»—i. */
export function buildTroubleshootAnswer(query: string): string {
  const q = query.trim().toLowerCase();
  const matches = q
    ? TROUBLESHOOT_KNOWLEDGE.filter(
        (t) => t.problem.toLowerCase().includes(q) || t.fix.toLowerCase().includes(q),
      )
    : TROUBLESHOOT_KNOWLEDGE;
  if (matches.length === 0) {
    return `KhÃ´ng cÃ³ gá»£i Ã½ sáºµn cho "${query}". HÃ£y mÃ´ táº£ thÃªm chi tiáº¿t (provider, model, log lá»—i) Ä‘á»ƒ mÃ¬nh debug giÃºp.`;
  }
  const lines = ['Gá»¢I Ã Sá»¬A Lá»–I:'];
  matches.slice(0, 6).forEach((t) => {
    lines.push(`\nâ€¢ ${t.problem}`);
    lines.push(`  â†’ ${t.fix}`);
  });
  return lines.join('\n');
}

/** Tráº£ nhanh hÆ°á»›ng dáº«n cáº¥u hÃ¬nh. */
export function buildSettingsAnswer(): string {
  return [
    'Cáº¤U HÃŒNH Há»† THá»NG: /dashboard/settings',
    '',
    'LLM (chá»n má»™t hoáº·c nhiá»u):',
    'â€¢ Cloud: Gemini, OpenAI, Claude, Groq, DeepSeek, OpenRouter â€” dÃ¡n API key tÆ°Æ¡ng á»©ng.',
    'â€¢ Ollama local: ollama serve + ollama pull <model>; URL Ä‘á»ƒ trá»‘ng = http://localhost:11434.',
    `â€¢ 9Router: ${NINEROUTER_SETUP.install} â€” key tá»« dashboard 9Router; URL trá»‘ng = http://127.0.0.1:20128.`,
    '',
    'Sau khi nháº­p key: chá»n "NhÃ  cung cáº¥p AI máº·c Ä‘á»‹nh" â†’ quÃ©t model â†’ chá»n model máº·c Ä‘á»‹nh â†’ LÆ°u.',
    'TÃ¬m web (Quáº£n gia): thÃªm Tavily hoáº·c SerpAPI key á»Ÿ cÃ¹ng trang Cáº¥u hÃ¬nh.',
    'Runner (/run): AI_SUPPORT_RUNNER_SECRET khá»›p .env náº¿u báº­t runner.',
    '',
    'LÆ°u trong trÃ¬nh duyá»‡t (localStorage). Server Ä‘á»c thÃªm .env â€” xem .env.example.',
    'Sau khi lÆ°u: reload tab tool Ä‘ang má»Ÿ.',
  ].join('\n');
}

/** Gá»£i Ã½ chá»n provider/model â€” heuristic ngáº¯n. */
export function buildLlmAdviceAnswer(query: string): string {
  const q = query.trim().toLowerCase();
  const lines: string[] = ['Gá»¢I Ã CHá»ŒN PROVIDER / MODEL:'];
  if (/local|offline|riÃªng tÆ°|private|free|mien phi|9router/.test(q) || !q) {
    lines.push('â€¢ Gáº§n miá»…n phÃ­: 9Router (proxy combo Kiro/OpenCodeâ€¦) hoáº·c Ollama + llama3.2 / qwen2.5.');
  }
  if (/json|schema|tool call|structured/.test(q) || !q) {
    lines.push('â€¢ Cáº§n JSON á»•n Ä‘á»‹nh / structured output: OpenAI gpt-4o-mini hoáº·c Gemini 1.5 Flash.');
  }
  if (/code|láº­p trÃ¬nh|programming/.test(q)) {
    lines.push('â€¢ Code: Claude 3.5 Sonnet, DeepSeek Coder, hoáº·c Qwen2.5-Coder (Ollama).');
  }
  if (/dÃ i|long|context|book|docx/.test(q)) {
    lines.push('â€¢ Context dÃ i: Gemini 1.5 (1M token) hoáº·c Claude 3.5 Sonnet (200k).');
  }
  if (/ráº»|cheap|cost/.test(q) || !q) {
    lines.push('â€¢ Tiáº¿t kiá»‡m: Groq (free tier nhanh) hoáº·c DeepSeek (ráº» + tá»‘t).');
  }
  if (lines.length === 1) {
    lines.push(`â€¢ Cho yÃªu cáº§u "${query}": máº·c Ä‘á»‹nh Gemini 1.5 Flash hoáº·c llama3.2 (Ollama) lÃ  Ä‘á»§.`);
  }
  lines.push('\nÄá»•i provider táº¡i /dashboard/settings hoáº·c trong tá»«ng tool (panel "NÃ¢ng cao").');
  return lines.join('\n');
}
