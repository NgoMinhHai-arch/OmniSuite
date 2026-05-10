import { callLlm, tryParseJson } from '@/lib/seo/llm-call';
import { sanitizeButlerActions, type ButlerAction } from '@/modules/ai-support/domain/butler-actions';
import { stackRegistryPromptBlock } from '@/modules/ai-support/domain/stack-registry';
import {
  AI_SUPPORT_SLASH_COMMANDS,
  findSlashCommand,
  parseSlashInput,
} from '@/modules/ai-support/domain/slash-commands';
import {
  buildHowToAnswer,
  buildLlmAdviceAnswer,
  buildSettingsAnswer,
  buildToolsAnswer,
  buildTourAnswer,
  buildTroubleshootAnswer,
  omniSuiteKnowledgePromptBlock,
} from '@/modules/ai-support/domain/omnisuite-knowledge';
import {
  buildIntegrationsAnswer,
  integrationsRegistryPromptBlock,
} from '@/modules/ai-support/domain/integrations-registry';
import { buildKeys, type AiSupportLlmParams } from './types';
import {
  classifyButlerWebSearchQuery,
  fetchButlerWebContext,
  hasButlerWebSearch,
  mergeButlerSearchKeys,
  shouldAttemptAutoWebSearch,
} from './web-search-for-butler';

export type ChatIntent = 'chat' | 'plan' | 'static' | 'system_check' | 'runner' | 'web_search';

export function resolveChatIntent(message: string): {
  intent: ChatIntent;
  command: string | null;
  args: string;
} {
  const parsed = parseSlashInput(message);
  const cmd = findSlashCommand(parsed.command);
  if (cmd?.handlerKind === 'plan') return { intent: 'plan', command: cmd.command, args: parsed.args };
  if (cmd?.handlerKind === 'web_search') return { intent: 'web_search', command: cmd.command, args: parsed.args };
  if (cmd?.handlerKind === 'static') return { intent: 'static', command: cmd.command, args: parsed.args };
  if (cmd?.handlerKind === 'system_check') return { intent: 'system_check', command: cmd.command, args: parsed.args };
  if (cmd?.handlerKind === 'runner') return { intent: 'runner', command: cmd.command, args: parsed.args };
  if (cmd?.handlerKind === 'chat') return { intent: 'chat', command: cmd.command, args: parsed.args };

  const text = parsed.args.toLowerCase();
  if (/(kế hoạch|plan|tầng 1|tầng 2|tầng 3|architecture|kiến trúc)/.test(text)) {
    return { intent: 'plan', command: null, args: parsed.args };
  }
  return { intent: 'chat', command: parsed.command, args: parsed.args };
}

export function buildHelpMessage(): string {
  const lines = AI_SUPPORT_SLASH_COMMANDS.map((cmd) => {
    const ex =
      cmd.example && cmd.example !== cmd.command ? `\n    Ví dụ: ${cmd.example}` : '';
    return `- ${cmd.command} — ${cmd.label}\n    ${cmd.description}${ex}`;
  });
  return [
    'QUẢN GIA — danh sách lệnh slash (copy ví dụ để thử):',
    '',
    ...lines,
    '',
    'Chat thường: cứ nhắn tiếng Việt; có Tavily/SerpAPI trong Cấu hình thì em có thể tự lên web khi cần.',
    'Bắt buộc tìm web: `/web <truy vấn>`.',
    'Runner (/run, /run-browser, /apply, /score): cần bật AI_SUPPORT_RUNNER_ENABLED và PYTHON_BIN (.venv-runners) — xem /integrations.',
    'Luôn mở Quản gia trên đúng URL máy chủ Next (npm run dev / next start), cùng origin với /api — preview/embed khác host thì slash và runner sẽ lỗi.',
    'Mới vào OmniSuite? `/tour`.',
  ].join('\n');
}

/**
 * Trả lời tĩnh cho các slash command dạng knowledge base — KHÔNG gọi LLM.
 * Trả về `null` nghĩa là không xử lý → để route gọi LLM bình thường.
 */
export function tryHandleStaticSlash(message: string): string | null {
  const { command, args } = parseSlashInput(message);
  if (!command) return null;
  switch (command) {
    case '/help':
      return buildHelpMessage();
    case '/tour':
      return buildTourAnswer();
    case '/tools':
      return buildToolsAnswer();
    case '/howto': {
      const ans = buildHowToAnswer(args);
      if (ans) return ans;
      return [
        `Không tìm thấy hướng dẫn cho "${args || '(trống)'}".`,
        'Gõ /tools để xem danh sách trang.',
        'Hoặc nhắn tự nhiên — mình sẽ trả lời dựa trên ngữ cảnh OmniSuite.',
      ].join('\n');
    }
    case '/settings':
      return buildSettingsAnswer();
    case '/llm':
      return buildLlmAdviceAnswer(args);
    case '/troubleshoot':
      return buildTroubleshootAnswer(args);
    case '/integrations':
      return buildIntegrationsAnswer();
    default:
      return null;
  }
}

/**
 * Build chuỗi câu trả lời cho /check dựa trên payload SystemStatus đã fetch.
 * Trả về text có format dễ đọc + gợi ý hành động khi thiếu config.
 */
export function buildSystemCheckAnswer(merged: Record<string, boolean>): string {
  const required = [
    { key: 'openai_api_key', label: 'OpenAI' },
    { key: 'gemini_api_key', label: 'Gemini (Google)' },
    { key: 'claude_api_key', label: 'Claude (Anthropic)' },
    { key: 'groq_api_key', label: 'Groq' },
    { key: 'deepseek_api_key', label: 'DeepSeek' },
    { key: 'openrouter_api_key', label: 'OpenRouter' },
    { key: 'ollama_base_url', label: 'Ollama URL (local: tự http://localhost:11434)' },
    { key: 'serpapi_key', label: 'SerpAPI' },
    { key: 'tavily_api_key', label: 'Tavily' },
  ];
  const lines = ['KIỂM TRA HỆ THỐNG OMNISUITE:'];
  let okCount = 0;
  required.forEach((item) => {
    const ok = !!merged[item.key];
    if (ok) okCount++;
    lines.push(`${ok ? '[v]' : '[ ]'} ${item.label}`);
  });
  lines.push('');
  if (okCount === 0) {
    lines.push('Chưa có provider nào được cấu hình.');
    lines.push('→ Vào /dashboard/settings để nhập API key, hoặc cài Ollama (local, miễn phí).');
  } else {
    lines.push(`Đã có ${okCount}/${required.length} mục được cấu hình.`);
    lines.push('Đổi provider mặc định / nhập thêm key tại /dashboard/settings.');
  }
  return lines.join('\n');
}

interface ButlerReplyJson {
  message?: string;
  actions?: unknown[];
}

function stubMeta(llm: AiSupportLlmParams): { provider: string; model: string } {
  return { provider: String(llm.provider || '—'), model: String(llm.model || '—') };
}

export async function generateGeneralChatReply(input: {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  llm: AiSupportLlmParams;
  /** force: lệnh /web — bắt buộc gọi API tìm kiếm khi có key. */
  webMode?: 'auto' | 'force';
}): Promise<{
  text: string;
  actions: ButlerAction[];
  meta: { provider: string; model: string };
}> {
  const webMode = input.webMode ?? 'auto';
  const searchKeys = mergeButlerSearchKeys(input.llm.keys);
  const canWeb = hasButlerWebSearch(searchKeys);

  if (webMode === 'force' && !canWeb) {
    return {
      text:
        'Chưa cấu hình Tavily hoặc SerpAPI nên em chưa “ra ngoài web” được. Xin chủ nhân thêm key tại Cấu hình (hoặc TAVILY_API_KEY / SERPAPI_KEY trong .env), rồi thử `/web` lại.',
      actions: [{ type: 'open', href: '/dashboard/settings', label: 'Mở Cấu hình' }],
      meta: stubMeta(input.llm),
    };
  }

  const userCore = input.message.trim();
  if (webMode === 'force' && !userCore) {
    return {
      text:
        'Cú pháp: `/web` kèm truy vấn — ví dụ: `/web tỷ giá USD VND hôm nay`. Hoặc nhắn bình thường: khi có key, em sẽ tự đoán lúc nào cần lên mạng.',
      actions: [{ type: 'open', href: '/dashboard/settings', label: 'Tavily / SerpAPI' }],
      meta: stubMeta(input.llm),
    };
  }

  let effectiveQuery: string | null = null;
  if (canWeb) {
    if (webMode === 'force') {
      effectiveQuery = userCore.slice(0, 220);
    } else if (shouldAttemptAutoWebSearch(userCore)) {
      effectiveQuery = await classifyButlerWebSearchQuery({ message: userCore, llm: input.llm });
    }
  }

  let webAugment = '';
  if (effectiveQuery && canWeb) {
    const { text, source } = await fetchButlerWebContext(effectiveQuery, searchKeys);
    if (text.trim()) {
      webAugment = `\n\n---\n## Kết quả tìm web (nguồn: ${source}; có thể thiếu sót)\n**Truy vấn:** ${effectiveQuery}\n\n${text}\n---\n`;
    } else if (webMode === 'force') {
      webAugment =
        '\n\n*(Không lấy được nội dung web — kiểm tra key/quota hoặc thử lại sau.)*\n';
    }
  }

  const historyText = (input.history || [])
    .slice(-8)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const providerLc = (input.llm.provider || '').toLowerCase();
  const jsonMode = providerLc !== 'claude';

  const modelRaw = (input.llm.model || '').toLowerCase();
  const ollamaSmall =
    providerLc === 'ollama' &&
    /:1b\b|:1\.5b\b|:3b\b|tinyllama|smollm|phi-?3(\.|-)mini|qwen.*:0\.5b|:0\.5b/i.test(modelRaw);
  const temperature = ollamaSmall ? 0.25 : 0.35;
  const maxTokens = ollamaSmall ? 1000 : 1800;

  const webHint = webAugment
    ? '\n- Phần “Kết quả tìm web” được đính kèm dưới tin nhắn chủ nhân: hãy dùng nếu khớp; phân biệt với kiến thức OmniSuite. Có thể thêm action `{"type":"web","query":"...","label":"..."}` (query ~ cùng truy vấn) để mở tìm kiếm DuckDuckGo.'
    : '';

  const system = `Bạn là QUẢN GIA vận hành OmniSuite cho một chủ nhân duy nhất.
Ngôn ngữ: CHỈ tiếng Việt. Giọng điệu: lịch sự, gọn, đi thẳng vào việc — không khách sáo dài dòng.
Nhiệm vụ: hiểu ý chủ nhân và ĐƯA RA VIỆC LÀM CỤ THỂ (mở đúng trang trong app hoặc gợi lệnh slash phù hợp), không chỉ nói chung chung.

Luật:
- Chỉ dùng đường dẫn đúng với knowledge (bắt đầu /dashboard). Không bịa URL ngoài danh sách; nếu chưa rõ công cụ con trong SEO hub → dùng /dashboard/seo-tools.
- Ưu tiên "actions" để chủ nhân bấm một cái là tới nơi hoặc có sẵn lệnh (/plan, /run, /run-browser, /check, /howto …).
- Nếu yêu cầu kiến trúc / nhiều bước agent → thêm action slash /plan hoặc /browser kèm args gợi ý ngắn.
- Không bịa tính năng không có trong knowledge — nếu không chắc: nói rõ và đề xuất /tools hoặc /tour.
${webHint}

Định dạng trả lời BẮT BUỘC: một JSON object duy nhất, không markdown, không giải thích ngoài JSON.
Schema:
{"message":"string — lời nói với chủ nhân (tiếng Việt)","actions":[{"type":"open","href":"/dashboard/...","label":"ngắn"},{"type":"slash","command":"/plan ...","label":"ngắn"},{"type":"web","query":"truy vấn duckduckgo","label":"Mở tìm"},...]}
- "actions" có thể là [] nhưng nếu có thể mở trang hoặc slash phù hợp thì nên có 1–5 phần tử.
- type "open": href bắt đầu /dashboard. type "slash": command bắt đầu / và là lệnh hợp lệ. type "web": query ngắn, không chứa ký tự lạ.

${omniSuiteKnowledgePromptBlock()}

${integrationsRegistryPromptBlock()}

${stackRegistryPromptBlock()}`;

  const prompt = `Lịch sử ngắn:\n${historyText || '(trống)'}\n\nTin nhắn mới:\n${userCore}${webAugment}`;
  const result = await callLlm(
    {
      system,
      prompt,
      provider: input.llm.provider,
      model: input.llm.model,
      temperature,
      maxTokens,
      jsonMode,
    },
    buildKeys(input.llm.keys),
  );

  const parsed = tryParseJson<ButlerReplyJson>(result.text);
  let message = '';
  let actions: ButlerAction[] = [];

  if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
    message = parsed.message.trim();
    actions = sanitizeButlerActions(parsed.actions);
  } else {
    message = result.text.trim() || 'Không có phản hồi.';
  }

  return {
    text: message,
    actions,
    meta: { provider: result.provider, model: result.model },
  };
}
