'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bot, Globe, Send, Sparkles, Terminal, User } from 'lucide-react';
import Card from '@/shared/ui/Card';
import Typography from '@/shared/ui/Typography';
import { Button } from '@/shared/ui/Button';
import { getLlmCredentialsFromSettings } from '@/shared/lib/client-llm-credentials';
import {
  DEFAULT_AI_SUPPORT_AGENT_IDS,
  DEFAULT_AI_SUPPORT_TOOL_IDS,
  type AiSupportPlanJson,
} from '@/modules/ai-support/domain/stack-registry';
import {
  AI_SUPPORT_SLASH_COMMANDS,
  QUAN_GIA_QUICK_CHIPS,
  parseSlashInput,
} from '@/modules/ai-support/domain/slash-commands';
import { sanitizeButlerActions, type ButlerAction } from '@/modules/ai-support/domain/butler-actions';
import {
  buildAiSupportRunner403Lines,
  buildApiRouteUnavailableLines,
  peekStartsLikeHtml,
  responseContentTypeLooksHtml,
  tryParseNdjsonErrorLine,
} from '@/shared/lib/api-response-help';

const SETTINGS_KEY = 'omnisuite_settings';
const CHAT_STORAGE_KEY = 'omnisuite_ai_support_chat_v3';

/** Header x-internal-token — khớp AI_SUPPORT_RUNNER_SECRET; hỗ trợ key cũ internal_token trong localStorage. */
function runnerSecretFromSettings(settings: Record<string, string>): string {
  return (
    settings.ai_support_runner_secret?.trim() ||
    settings.internal_token?.trim() ||
    ''
  );
}

type ProviderId = 'google' | 'openai' | 'groq' | 'claude' | 'deepseek' | 'openrouter' | 'ollama';
type MsgRole = 'user' | 'assistant' | 'system';

type ChatMessage = {
  id: string;
  role: MsgRole;
  content: string;
  kind?: 'chat' | 'plan' | 'error' | 'run';
  plan?: AiSupportPlanJson;
  /** Log NDJSON cho slash /run (OpenManus) hoặc /run-browser (browser-use). */
  runLog?: string[];
  /** Khi runner xong/hủy bỏ — UI ngừng append log. */
  runDone?: boolean;
  meta?: { provider: string; model: string };
  /** Nút việc làm do quản gia đề xuất (mở trang / điền slash). */
  actions?: ButlerAction[];
  /** Tin mới từ luồng chat — hiển thị chữ dần; không lưu sessionStorage. */
  animateReveal?: boolean;
};

interface RunnerEvent {
  type: string;
  level?: string;
  message?: string;
  step?: number;
  summary?: string;
  result?: { steps: number; final_text: string };
  error?: string;
  missing?: string[];
  instructions?: string;
  setup_required?: boolean;
  code?: number | null;
  stderr_tail?: string;
}

function buildId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseChatMeta(raw: unknown): { provider: string; model: string } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const m = raw as Record<string, unknown>;
  if (typeof m.provider === 'string' && typeof m.model === 'string') {
    return { provider: m.provider, model: m.model };
  }
  return undefined;
}

/** Xuất hiện lần lượt (ước ~0.5–14s tùy độ dài) — tránh chữ trút một lần. */
function GradualRevealParagraph({
  text,
  onComplete,
  scrollParentRef,
}: {
  text: string;
  onComplete?: () => void;
  scrollParentRef?: React.RefObject<HTMLElement | null>;
}) {
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const [len, setLen] = useState(0);

  useEffect(() => {
    if (!text.length) {
      setLen(0);
      queueMicrotask(() => onCompleteRef.current?.());
      return;
    }
    setLen(0);
    const durationMs = Math.min(14000, Math.max(550, text.length * 15));
    const intervalMs = 22;
    const steps = Math.max(14, Math.ceil(durationMs / intervalMs));
    let tick = 0;
    const id = window.setInterval(() => {
      tick += 1;
      const next = Math.min(text.length, Math.ceil((tick / steps) * text.length));
      setLen(next);
      const el = scrollParentRef?.current;
      if (el) el.scrollTop = el.scrollHeight;
      if (next >= text.length) {
        window.clearInterval(id);
        onCompleteRef.current?.();
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [text]);

  const slice = text.slice(0, len);

  return (
    <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-primary)' }}>
      {slice}
      {len < text.length ? (
        <span className="ml-px inline-block animate-pulse text-indigo-400 align-baseline">▍</span>
      ) : null}
    </p>
  );
}

function AssistantMessageInner({
  msg,
  router,
  setInput,
  scrollParentRef,
}: {
  msg: ChatMessage;
  router: ReturnType<typeof useRouter>;
  setInput: (v: string) => void;
  scrollParentRef?: React.RefObject<HTMLElement | null>;
}) {
  const defer = msg.animateReveal === true;
  const [extrasVisible, setExtrasVisible] = useState(!defer);

  return (
    <>
      {defer ? (
        <GradualRevealParagraph
          text={msg.content}
          scrollParentRef={scrollParentRef}
          onComplete={() => setExtrasVisible(true)}
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-primary)' }}>
          {msg.content}
        </p>
      )}
      {extrasVisible ? (
        <>
          {msg.plan ? (
            <div className="mt-3">
              <PlanCard plan={msg.plan} />
            </div>
          ) : null}

          {msg.actions && msg.actions.length > 0 ? (
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-color)' }}>
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-amber-200/90">
                Việc làm ngay
              </p>
              <div className="flex flex-wrap gap-2">
                {msg.actions.map((a, idx) => {
                  if (a.type === 'open') {
                    return (
                      <Button
                        key={`${msg.id}_open_${idx}`}
                        size="sm"
                        variant="outline"
                        leftIcon={<ArrowRight className="h-3.5 w-3.5" />}
                        onClick={() => router.push(a.href)}
                      >
                        {a.label}
                      </Button>
                    );
                  }
                  if (a.type === 'slash') {
                    return (
                      <Button
                        key={`${msg.id}_slash_${idx}`}
                        size="sm"
                        variant="outline"
                        leftIcon={<Terminal className="h-3.5 w-3.5" />}
                        onClick={() => setInput(`${a.command.trim()} `)}
                      >
                        {a.label}
                      </Button>
                    );
                  }
                  return (
                    <Button
                      key={`${msg.id}_web_${idx}`}
                      size="sm"
                      variant="outline"
                      leftIcon={<Globe className="h-3.5 w-3.5" />}
                      onClick={() =>
                        window.open(
                          `https://duckduckgo.com/?q=${encodeURIComponent(a.query)}`,
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }
                    >
                      {a.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function PlanCard({ plan }: { plan: AiSupportPlanJson }) {
  return (
    <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--border-color)' }}>
      <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-violet-300">
        Kế hoạch 3 tầng
      </p>
      <div className="space-y-4">
        <div>
          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Tầng 1</p>
          <p style={{ color: 'var(--text-secondary)' }}>{plan.tier1_brain}</p>
        </div>
        <div>
          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Tầng 2</p>
          <ul className="list-disc pl-5" style={{ color: 'var(--text-secondary)' }}>
            {plan.tier2_agents.map((a) => (
              <li key={a.id + a.role}><b>{a.id}</b> - {a.role}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Tầng 3</p>
          <ul className="list-disc pl-5" style={{ color: 'var(--text-secondary)' }}>
            {plan.tier3_tools.map((t) => (
              <li key={t.id + t.usage}><b>{t.id}</b> - {t.usage}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function AiSupportPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [provider, setProvider] = useState<ProviderId>('ollama');
  const [model, setModel] = useState('');
  const [modelsLoading, setModelsLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const rawSettings = localStorage.getItem(SETTINGS_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings) as Record<string, string>;
        const legacy = parsed.internal_token?.trim();
        const next = parsed.ai_support_runner_secret?.trim();
        setSettings(
          legacy && !next ? { ...parsed, ai_support_runner_secret: legacy } : parsed,
        );
        setProvider('ollama');
      }

      const rawChat = sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (rawChat) {
        setMessages(JSON.parse(rawChat) as ChatMessage[]);
      } else {
        setMessages([
          {
            id: buildId(),
            role: 'assistant',
            kind: 'chat',
            animateReveal: true,
            content: [
              'Chào chủ nhân. Em là Quản gia OmniSuite — giao việc bằng tiếng Việt hoặc dùng lệnh slash bên dưới.',
              '',
              'Khám phá & cấu hình',
              '  /help              — in đầy đủ slash + ví dụ',
              '  /tour              — tour ~60 giây các nhóm công cụ',
              '  /tools             — danh sách trang sidebar',
              '  /check             — key/provider/Tavily đã có chưa',
              '  /settings          — nhắc chỗ nhập key & Ollama',
              '  /integrations      — integration đã clone + runner (/run …)',
              '',
              'Tra cứu & LLM',
              '  /howto <chủ đề>    — ví dụ: /howto viết bài SEO',
              '  /llm <nhu cầu>     — ví dụ: /llm local không tốn API',
              '  /troubleshoot …    — ví dụ: /troubleshoot ollama không kết nối',
              '',
              'Web & kế hoạch',
              '  /web <truy vấn>    — bắt buộc lên mạng (cần Tavily hoặc SerpAPI)',
              '  /plan <mục tiêu>   — kế hoạch 3 tầng (não · agent · công cụ)',
              '  /browser <mục tiêu> — như /plan nhưng ưu tiên browser agent',
              '',
              'Runner trên máy bạn (cần AI_SUPPORT_RUNNER_ENABLED + PYTHON_BIN trong .venv-runners)',
              '  /run <nhiệm vụ>    — ví dụ: /run liệt kê file .pdf trong Downloads',
              '  /run-browser …     — ví dụ: /run-browser mở duckduckgo.com tìm "USD VND"',
              '  /apply doctor      — ApplyPilot kiểm tra môi trường',
              '  /score <JD>        — ví dụ: /score Senior Backend Python remote AWS …',
              '',
              'Hoặc nhắn thẳng việc — em trả lời và gắn nút mở trang / slash khi phù hợp. Dưới ô chat có nút “bắt đầu nhanh” là các ví dụ copy-paste.',
              '',
              'Lưu ý: chat và runner gọi API Next (/api/ai-support/…) — cần Next đang chạy và trang mở cùng origin (ví dụ http://127.0.0.1:3000), không phải preview static khác máy chủ.',
            ].join('\n'),
          },
        ]);
      }
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    if (!messages.length) return;
    const sanitized = messages.map(({ animateReveal: _ar, ...rest }) => rest);
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sanitized));
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const loadModels = useCallback(async () => {
    const { apiKey, customBaseUrl } = getLlmCredentialsFromSettings(provider, settings);
    if (provider !== 'ollama' && !apiKey) {
      setAvailableModels([]);
      setModel('');
      return;
    }
    setModelsLoading(true);
    try {
      const listResp = await fetch('/api/list-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey || 'ollama',
          ...(customBaseUrl ? { customBaseUrl } : {}),
        }),
      });
      const listData = await listResp.json().catch(() => ({}));
      const models = listResp.ok && Array.isArray(listData.models) ? listData.models : [];
      if (models.length) {
        setAvailableModels(models);
        setModel((m) => (m && models.includes(m) ? m : models[0]));
      } else {
        setAvailableModels([]);
        setModel('');
      }
    } catch {
      setAvailableModels([]);
      setModel('');
    } finally {
      setModelsLoading(false);
    }
  }, [provider, settings]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const keysPayload = useMemo(
    () => ({
      openai_api_key: settings.openai_api_key,
      gemini_api_key: settings.gemini_api_key,
      claude_api_key: settings.claude_api_key,
      groq_api_key: settings.groq_api_key,
      deepseek_api_key: settings.deepseek_api_key,
      openrouter_api_key: settings.openrouter_api_key,
      ollama_base_url: settings.ollama_base_url,
      ollama_api_key: settings.ollama_api_key,
      tavily_api_key: settings.tavily_api_key,
      serpapi_key: settings.serpapi_key,
    }),
    [settings],
  );

  const parsedSlash = parseSlashInput(input);
  const slashSuggestions = useMemo(() => {
    if (!input.trim().startsWith('/')) return [];
    const commandInput = (parsedSlash.command || '/').toLowerCase();
    return AI_SUPPORT_SLASH_COMMANDS.filter((cmd) => cmd.command.startsWith(commandInput)).slice(0, 6);
  }, [input, parsedSlash.command]);

  type RunnerKind = 'open_manus' | 'browser_use' | 'applypilot' | 'job_scraper';

  /** Stream NDJSON từ /api/ai-support/run vào 1 ChatMessage có kind='run'. */
  async function runRunner(args: {
    runner: RunnerKind;
    title: string;
    body: Record<string, unknown>;
  }) {
    const runId = buildId();
    setMessages((prev) => [
      ...prev,
      {
        id: runId,
        role: 'assistant',
        kind: 'run',
        content: `${args.title}: đang khởi động...`,
        runLog: [],
        runDone: false,
      },
    ]);

    const appendLog = (line: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === runId ? { ...m, runLog: [...(m.runLog || []), line].slice(-400) } : m)),
      );
    };
    const setHeader = (header: string) => {
      setMessages((prev) => prev.map((m) => (m.id === runId ? { ...m, content: header } : m)));
    };
    const finalize = (header?: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === runId ? { ...m, runDone: true, content: header ?? m.content } : m)),
      );
    };

    try {
      const runnerSecret = runnerSecretFromSettings(settings);
      const resp = await fetch('/api/ai-support/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(runnerSecret ? { 'x-internal-token': runnerSecret } : {}),
        },
        body: JSON.stringify({
          runner: args.runner,
          provider,
          model,
          ollama_base_url: settings.ollama_base_url || undefined,
          openai_api_key: settings.openai_api_key || undefined,
          gemini_api_key: settings.gemini_api_key || undefined,
          ollama_api_key: settings.ollama_api_key || undefined,
          ...args.body,
        }),
      });

      const ctRun = resp.headers.get('content-type') || '';

      if (!resp.ok || !resp.body) {
        const bodyPeek = await resp.text().catch(() => '');
        const looksHtml = responseContentTypeLooksHtml(ctRun) || peekStartsLikeHtml(bodyPeek);
        const ndErr = tryParseNdjsonErrorLine(bodyPeek);

        if (resp.status === 403) {
          buildAiSupportRunner403Lines(ndErr ?? undefined).forEach((line) => appendLog(line));
          finalize(`${args.title}: bị từ chối (403)`);
          return;
        }

        if (looksHtml) {
          buildApiRouteUnavailableLines({
            status: resp.status,
            endpointLabel: 'POST /api/ai-support/run',
            contentType: ctRun,
            bodyPeek: bodyPeek.slice(0, 480),
          }).forEach((line) => appendLog(line));
          finalize(`${args.title}: không kết nối được API`);
          return;
        }

        if (ndErr) {
          appendLog(ndErr);
          finalize(`${args.title}: lỗi (HTTP ${resp.status})`);
          return;
        }

        buildApiRouteUnavailableLines({
          status: resp.status,
          endpointLabel: 'POST /api/ai-support/run',
          contentType: ctRun,
          bodyPeek: bodyPeek.slice(0, 480),
        }).forEach((line) => appendLog(line));
        finalize(`${args.title}: không kết nối được API`);
        return;
      }

      if (responseContentTypeLooksHtml(ctRun)) {
        const bodyPeek = await resp.text().catch(() => '');
        buildApiRouteUnavailableLines({
          status: resp.status,
          endpointLabel: 'POST /api/ai-support/run',
          contentType: ctRun,
          bodyPeek: bodyPeek.slice(0, 480),
        }).forEach((line) => appendLog(line));
        finalize(`${args.title}: không kết nối được API`);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (buffer.length < 512 && !buffer.includes('\n')) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
      }
      if (peekStartsLikeHtml(buffer)) {
        buildApiRouteUnavailableLines({
          status: resp.status,
          endpointLabel: 'POST /api/ai-support/run',
          contentType: ctRun,
          bodyPeek: buffer.slice(0, 480),
        }).forEach((line) => appendLog(line));
        finalize(`${args.title}: không kết nối được API`);
        try {
          for (;;) {
            const ch = await reader.read();
            if (ch.done) break;
          }
        } catch {
          /* noop */
        }
        return;
      }
      let stepCount = 0;
      let fatal = false;

      const processNdjsonLine = (rawLine: string) => {
        let event: RunnerEvent;
        try {
          event = JSON.parse(rawLine) as RunnerEvent;
        } catch {
          appendLog(rawLine);
          return;
        }
        switch (event.type) {
          case 'ready':
            appendLog('Runner sẵn sàng.');
            setHeader(`${args.title}: đang chạy...`);
            break;
          case 'log':
            appendLog(`[${event.level || 'info'}] ${event.message || ''}`);
            break;
          case 'step':
            stepCount = event.step || stepCount + 1;
            appendLog(`Bước ${stepCount}: ${event.summary || 'tiếp tục'}`);
            break;
          case 'done':
            if (event.result && typeof event.result === 'object') {
              if ('steps' in event.result && (event.result as { steps?: number }).steps !== undefined) {
                appendLog(`Xong sau ${(event.result as { steps: number }).steps} bước.`);
              }
              if ('final_text' in event.result && (event.result as { final_text?: string }).final_text) {
                appendLog(`Kết quả: ${String((event.result as { final_text: string }).final_text).slice(0, 1200)}`);
              }
              if (!('steps' in event.result) && !('final_text' in event.result)) {
                appendLog(`Kết quả: ${JSON.stringify(event.result).slice(0, 1200)}`);
              }
            } else {
              appendLog('Runner hoàn thành.');
            }
            setHeader(`${args.title}: hoàn thành`);
            break;
          case 'setup_required':
            appendLog('Runner chưa được cài đầy đủ:');
            if (event.missing?.length) appendLog(`Thiếu: ${event.missing.join(', ')}`);
            if (event.instructions) appendLog(event.instructions);
            setHeader(`${args.title}: cần cài thêm`);
            fatal = true;
            break;
          case 'error':
            appendLog(`Lỗi: ${event.error || 'unknown'}`);
            setHeader(`${args.title}: lỗi`);
            fatal = true;
            break;
          case 'aborted':
            appendLog('Bị huỷ bởi người dùng.');
            setHeader(`${args.title}: đã huỷ`);
            fatal = true;
            break;
          case 'exit':
            if (event.code !== 0) {
              appendLog(`Thoát code=${event.code ?? '?'}${event.stderr_tail ? ` — ${event.stderr_tail}` : ''}`);
            }
            break;
          default:
            appendLog(rawLine);
        }
      };

      while (!fatal) {
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
          const rawLine = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!rawLine) continue;
          processNdjsonLine(rawLine);
          if (fatal) break;
        }
        if (fatal) break;
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }
      if (!fatal && buffer.trim()) {
        processNdjsonLine(buffer.trim());
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`Mạng/stream lỗi: ${msg}`);
      if (/fail(?:ed)? to fetch|networkerror|load failed/i.test(msg)) {
        buildApiRouteUnavailableLines({
          status: 0,
          endpointLabel: 'POST /api/ai-support/run',
          contentType: '',
          bodyPeek: '',
        }).forEach((line) => appendLog(line));
      }
      setHeader(`${args.title}: gián đoạn`);
    } finally {
      finalize();
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending || !model) return;

    const userMsg: ChatMessage = { id: buildId(), role: 'user', content: text, kind: 'chat' };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    // Slash runner-based — bỏ qua /api/ai-support/chat, dùng NDJSON stream.
    const slash = parseSlashInput(text);
    if (slash.command === '/run') {
      const taskText = slash.args.trim();
      if (!taskText) {
        setMessages((prev) => [
          ...prev,
          {
            id: buildId(),
            role: 'assistant',
            kind: 'chat',
            animateReveal: true,
            content:
              'Cú pháp: /run <nhiệm vụ tiếng Việt hoặc English>.\n\nVí dụ:\n  /run đếm số file trong thư mục Documents và in ra 5 file mới nhất\n  /run tạo file notes.txt trên Desktop với dòng chữ "OmniSuite demo"\n\nCần AI_SUPPORT_RUNNER_ENABLED=true và PYTHON_BIN trỏ .venv-runners (xem /integrations).',
          },
        ]);
        setSending(false);
        return;
      }
      try {
        await runRunner({
          runner: 'open_manus',
          title: 'OpenManus',
          body: { task: taskText },
        });
      } finally {
        setSending(false);
      }
      return;
    }
    if (slash.command === '/run-browser') {
      const taskText = slash.args.trim();
      if (!taskText) {
        setMessages((prev) => [
          ...prev,
          {
            id: buildId(),
            role: 'assistant',
            kind: 'chat',
            animateReveal: true,
            content:
              'Cú pháp: /run-browser <nhiệm vụ mô tả từng bước trên web>.\n\nVí dụ:\n  /run-browser mở https://news.ycombinator.com và lấy tiêu đề 3 bài đầu trang\n  /run-browser vào google.com tìm "Next.js 15" và tóm tắt kết quả đầu tiên\n\nCần runner bật + browser-use + Playwright Chromium trong venv (scripts/setup-runners-venv.ps1).',
          },
        ]);
        setSending(false);
        return;
      }
      try {
        await runRunner({
          runner: 'browser_use',
          title: 'Browser Agent',
          body: { task: taskText, headless: true, max_steps: 25 },
        });
      } finally {
        setSending(false);
      }
      return;
    }
    if (slash.command === '/apply') {
      const action = (slash.args.trim().split(/\s+/)[0] || 'doctor').toLowerCase();
      const allowed = ['doctor', 'init', 'run', 'apply'];
      const finalAction = allowed.includes(action) ? action : 'doctor';
      try {
        await runRunner({
          runner: 'applypilot',
          title: `ApplyPilot ${finalAction}`,
          body: { action: finalAction, workers: 1, dry_run: finalAction === 'apply' },
        });
      } finally {
        setSending(false);
      }
      return;
    }
    if (slash.command === '/score') {
      const jd = slash.args.trim();
      if (!jd) {
        setMessages((prev) => [
          ...prev,
          {
            id: buildId(),
            role: 'assistant',
            kind: 'chat',
            animateReveal: true,
            content:
              'Cú pháp: /score sau đó dán mô tả công việc (JD).\n\nVí dụ:\n  /score Senior Full-stack Node React, hybrid HCM, budget senior level, yêu cầu Docker AWS\n\nResume lấy từ trường resume trong Cấu hình (nếu đã lưu); JD càng đầy đủ càng chính xác.',
          },
        ]);
        setSending(false);
        return;
      }
      try {
        await runRunner({
          runner: 'job_scraper',
          title: 'Score JD',
          body: { jd, resume_text: settings.resume_text || '' },
        });
      } finally {
        setSending(false);
      }
      return;
    }

    try {
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        .slice(-12);

      const res = await fetch('/api/ai-support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          selectedAgents: [...DEFAULT_AI_SUPPORT_AGENT_IDS],
          selectedTools: [...DEFAULT_AI_SUPPORT_TOOL_IDS],
          provider,
          model,
          keys: keysPayload,
        }),
      });
      const ctChat = res.headers.get('content-type') || '';
      const rawText = await res.text().catch(() => '');

      if (responseContentTypeLooksHtml(ctChat) || peekStartsLikeHtml(rawText)) {
        const lines = buildApiRouteUnavailableLines({
          status: res.status,
          endpointLabel: 'POST /api/ai-support/chat',
          contentType: ctChat,
          bodyPeek: rawText.slice(0, 480),
        });
        setMessages((prev) => [
          ...prev,
          {
            id: buildId(),
            role: 'assistant',
            kind: 'error',
            animateReveal: true,
            content: lines.join('\n'),
          },
        ]);
        return;
      }

      let data: Record<string, unknown>;
      try {
        data = rawText.trim() ? (JSON.parse(rawText) as Record<string, unknown>) : {};
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: buildId(),
            role: 'assistant',
            kind: 'error',
            animateReveal: true,
            content: [
              'Phản hồi không phải JSON hợp lệ từ /api/ai-support/chat.',
              'Đoạn đầu:',
              rawText.slice(0, 360),
            ].join('\n'),
          },
        ]);
        return;
      }

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: buildId(),
            role: 'assistant',
            kind: 'error',
            animateReveal: true,
            content:
              typeof data.error === 'string'
                ? data.error
                : `Lỗi gọi chat API (HTTP ${res.status}).`,
          },
        ]);
        return;
      }

      if (data.kind === 'plan' && data.plan) {
        setMessages((prev) => [
          ...prev,
          {
            id: buildId(),
            role: 'assistant',
            kind: 'plan',
            animateReveal: true,
            content: 'Đã tạo kế hoạch 3 tầng.',
            plan: data.plan as AiSupportPlanJson,
            meta: parseChatMeta(data.meta),
          },
        ]);
      } else {
        const actions = sanitizeButlerActions(data.actions);
        setMessages((prev) => [
          ...prev,
          {
            id: buildId(),
            role: 'assistant',
            kind: 'chat',
            animateReveal: true,
            content: typeof data.message === 'string' ? data.message : 'Không có phản hồi.',
            meta: parseChatMeta(data.meta),
            actions: actions.length ? actions : undefined,
          },
        ]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      let errContent = msg;
      if (/fail(?:ed)? to fetch|networkerror|load failed/i.test(msg)) {
        errContent = buildApiRouteUnavailableLines({
          status: 0,
          endpointLabel: 'POST /api/ai-support/chat',
          contentType: '',
          bodyPeek: '',
        }).join('\n');
      }
      setMessages((prev) => [
        ...prev,
        {
          id: buildId(),
          role: 'assistant',
          kind: 'error',
          animateReveal: true,
          content: errContent,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-6">
      <header className="flex flex-col gap-2">
        <Typography variant="h1" className="!mb-0">Quản gia</Typography>
        <Typography variant="body" style={{ color: 'var(--text-secondary)' }}>
          Tiếng Việt — giao việc trong OmniSuite; có Tavily/SerpAPI thì em tự hoặc theo `/web` lên mạng lấy tin. Nút mở trang / tìm / slash khi hợp lệ.
        </Typography>
      </header>

      <Card className="!p-4">
        <Typography variant="label" className="!mb-3 block">
          LLM
        </Typography>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Provider
            </span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderId)}
              className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              <option value="google">Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="groq">Groq</option>
              <option value="claude">Claude</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openrouter">OpenRouter</option>
              <option value="ollama">Ollama</option>
            </select>
          </label>
          <label>
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Model {modelsLoading ? '(đang tải...)' : ''}
            </span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={availableModels.length === 0 || modelsLoading}
              className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2 text-sm disabled:opacity-50"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              {availableModels.length === 0 ? (
                <option value="">Chưa có model</option>
              ) : (
                availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div ref={listRef} className="h-[58vh] overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[88%] rounded-2xl border px-4 py-3 ${msg.role === 'user' ? 'bg-indigo-600/15' : 'bg-[color:var(--hover-bg)]'}`}
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  {msg.role === 'user' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                  {msg.role === 'user' ? 'Chủ nhân' : 'Quản gia'}
                  {msg.meta ? <span>{msg.meta.provider}/{msg.meta.model}</span> : null}
                </div>
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-primary)' }}>
                    {msg.content}
                  </p>
                ) : msg.kind === 'run' ? (
                  <>
                    <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-primary)' }}>
                      {msg.content}
                    </p>
                    <div className="mt-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-color)' }}>
                      <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
                        <Sparkles className={`h-3.5 w-3.5 ${msg.runDone ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
                        Runner log {msg.runDone ? '(xong)' : '(đang chạy...)'}
                      </div>
                      <pre
                        className="max-h-72 overflow-auto rounded-lg border bg-black/40 p-3 text-[11px] leading-relaxed text-emerald-200"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        {(msg.runLog || []).join('\n') || '(chưa có log)'}
                      </pre>
                    </div>
                  </>
                ) : (
                  <AssistantMessageInner
                    key={`${msg.id}_reply`}
                    msg={msg}
                    router={router}
                    setInput={setInput}
                    scrollParentRef={listRef}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t p-4" style={{ borderColor: 'var(--border-color)' }}>
          {slashSuggestions.length > 0 && (
            <div className="mb-3 rounded-xl border p-2" style={{ borderColor: 'var(--border-color)' }}>
              <div className="mb-1 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Slash commands
              </div>
              <div className="space-y-1">
                {slashSuggestions.map((cmd) => (
                  <button
                    key={cmd.command}
                    type="button"
                    onClick={() =>
                      setInput(cmd.example && cmd.example.startsWith(cmd.command) ? `${cmd.example} ` : `${cmd.command} `)
                    }
                    className="flex w-full flex-col items-stretch gap-0.5 rounded-lg px-2 py-2 text-left hover:bg-white/5"
                  >
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      {cmd.command}
                      <span className="ml-2 font-normal opacity-80">{cmd.label}</span>
                    </span>
                    <span className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                      {cmd.description}
                    </span>
                    {cmd.example ? (
                      <span
                        className="font-mono text-[10px] leading-snug text-emerald-400/90 break-words"
                        title={cmd.example}
                      >
                        Ví dụ: {cmd.example}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-end gap-3">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Nhắn tiếng Việt hoặc /plan … /run … /run-browser … — gõ / để xem gợi ý"
              className="w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-sm outline-none ring-indigo-500/30 focus:ring-2"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <Button
              size="md"
              isLoading={sending}
              disabled={!input.trim() || !model}
              onClick={sendMessage}
              rightIcon={<Send className="h-4 w-4" />}
            >
              Gửi
            </Button>
          </div>
          <div className="mt-2 space-y-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Ví dụ copy-paste:
              </span>
              {QUAN_GIA_QUICK_CHIPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  title={s}
                  onClick={() => setInput(`${s} `)}
                  className="max-w-[min(100%,22rem)] rounded-full border px-2 py-1 text-left leading-snug hover:bg-white/5 break-words"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
