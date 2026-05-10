/** Kiến trúc ba tầng AI Hỗ trợ — định danh cố định để UI và prompt LLM thống nhất */

export interface StackItem {
  id: string;
  name: string;
  description: string;
  docUrl?: string;
}

export const AGENT_ALIASES: Record<string, string> = {
  'browser-use': 'browser_agent',
  stagehand: 'browser_agent',
  selenium: 'browser_agent',
};

/** Tầng 2 — khung agent / điều khiển máy (OpenManus là mặc định chủ đạo cho /run) */
export const AGENT_FRAMEWORKS: StackItem[] = [
  {
    id: 'open-manus',
    name: 'OpenManus',
    description: 'Điều khiển máy cục bộ / OS và shell — luồng `/run` mặc định của Quản gia.',
    docUrl: 'https://github.com/FoundationAgents/OpenManus',
  },
  {
    id: 'browser_agent',
    name: 'Browser Agent (Browser Use)',
    description: 'Chuẩn điều khiển trình duyệt (slash `/run-browser`; đã gộp Browser Use/Stagehand/Selenium).',
    docUrl: 'https://github.com/browser-use/browser-use',
  },
  {
    id: 'autogen',
    name: 'AutoGen',
    description: 'Nhiều agent phối hợp (Microsoft).',
    docUrl: 'https://github.com/microsoft/autogen',
  },
  {
    id: 'crewai',
    name: 'CrewAI',
    description: 'Đội AI vai trò — phối hợp tác vụ.',
    docUrl: 'https://github.com/crewAIInc/crewAI',
  },
  {
    id: 'aider',
    name: 'Aider',
    description: 'AI pair programming trong terminal — chỉnh sửa codebase, map repo, tích hợp Git.',
    docUrl: 'https://github.com/Aider-AI/aider',
  },
  {
    id: 'hermes-agent',
    name: 'Hermes Agent',
    description: 'Agent runtime / pipeline (Nous Research).',
    docUrl: 'https://github.com/NousResearch/hermes-agent',
  },
];

/** Tầng 3 — connector & hành động thực */
export const TOOL_CONNECTORS: StackItem[] = [
  { id: 'gmail', name: 'Gmail API', description: 'Email qua Google API.' },
  { id: 'google-sheets', name: 'Google Sheets API', description: 'Bảng tính & báo cáo.' },
  { id: 'notion', name: 'Notion', description: 'Wiki / database Notion.' },
  { id: 'slack', name: 'Slack', description: 'Kênh & DM Slack.' },
  { id: 'discord', name: 'Discord', description: 'Bot / webhook Discord.' },
  { id: 'zapier', name: 'Zapier', description: 'Automation SaaS no-code.' },
  { id: 'make', name: 'Make', description: 'Scenario automation (Integromat).' },
  { id: 'playwright', name: 'Playwright', description: 'Browser automation hiện đại — chuẩn tương thích tốt nhất với luồng hiện tại.' },
];

/** Phạm vi tầng 2/3 mặc định của Quản gia — không cần user chọn trên UI. */
export const DEFAULT_AI_SUPPORT_AGENT_IDS: readonly string[] = AGENT_FRAMEWORKS.map((a) => a.id);

export const DEFAULT_AI_SUPPORT_TOOL_IDS: readonly string[] = TOOL_CONNECTORS.map((t) => t.id);

/** Chuẩn hoá ID agent; mảng rỗng hoặc không hợp lệ → full registry. */
export function resolveAiSupportAgentIds(raw: unknown): string[] {
  const arr = Array.isArray(raw)
    ? raw
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => normalizeAgentId(x.trim()))
    : [];
  return arr.length ? arr : [...DEFAULT_AI_SUPPORT_AGENT_IDS];
}

/** Chuẩn hoá ID tool; mảng rỗng hoặc không hợp lệ → full registry. */
export function resolveAiSupportToolIds(raw: unknown): string[] {
  const arr = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
    : [];
  return arr.length ? arr : [...DEFAULT_AI_SUPPORT_TOOL_IDS];
}

export interface AiSupportPlanJson {
  tier1_brain: string;
  tier2_agents: Array<{ id: string; role: string }>;
  tier3_tools: Array<{ id: string; usage: string }>;
  execution_order: string[];
  risks_notes: string[];
}

export function stackRegistryPromptBlock(): string {
  const agents = AGENT_FRAMEWORKS.map((a) => `- ${a.id}: ${a.name}`).join('\n');
  const tools = TOOL_CONNECTORS.map((t) => `- ${t.id}: ${t.name}`).join('\n');
  const aliases = Object.entries(AGENT_ALIASES).map(([from, to]) => `- ${from} -> ${to}`).join('\n');
  return [
    'Danh sách ID tầng 2 (agent / orchestration) được phép:',
    agents,
    '',
    'Alias cần chuẩn hóa về canonical ID:',
    aliases,
    '',
    'Danh sách ID tầng 3 (tool / action) được phép:',
    tools,
  ].join('\n');
}

export function normalizeAgentId(id: string): string {
  return AGENT_ALIASES[id] || id;
}
