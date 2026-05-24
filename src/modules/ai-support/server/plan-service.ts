import { callLlm, tryParseJson } from '@/lib/seo/llm-call';
import {
  normalizeAgentId,
  stackRegistryPromptBlock,
  type AiSupportPlanJson,
} from '@/modules/ai-support/domain/stack-registry';
import { omniSuiteKnowledgePromptBlock } from '@/modules/ai-support/domain/omnisuite-knowledge';
import { buildKeys, type AiSupportLlmParams } from './types';

const SYSTEM = `Bạn là kiến trúc sư hệ thống AI tự động hóa cho OmniSuite (Quản gia).
Nhiệm vụ: đọc mục tiêu người dùng và phạm vi khả năng agent/tool do OmniSuite cung cấp (tầng 2 / tầng 3 đã tích hợp sẵn — không phải lựa chọn tay trên UI), sau đó lập kế hoạch ba tầng:
- Tầng 1 (não LLM): phân tích, quyết định bước tiếp, không trực tiếp gọi API.
- Tầng 2 (agent): điều phối, vòng lặp quan sát-hành động, browser/OS automation.
- Tầng 3 (tool): Gmail, Sheets, Slack, Playwright, v.v.

Khi mục tiêu trùng với một tính năng đã có sẵn của OmniSuite (ví dụ research từ khóa, viết bài, audit website, scrape maps, tailor CV…)
thì PHẢI ghi rõ trong execution_order là "Mở /dashboard/<đường dẫn> để dùng tool có sẵn" thay vì xây lại từ đầu.

${omniSuiteKnowledgePromptBlock()}

${stackRegistryPromptBlock()}

BẮT BUỘC: Trả về đúng MỘT JSON object (không markdown), các khóa:
{
  "tier1_brain": string,
  "tier2_agents": [{"id": string, "role": string}],
  "tier3_tools": [{"id": string, "usage": string}],
  "execution_order": string[],
  "risks_notes": string[]
}
- tier2_agents[].id và tier3_tools[].id ưu tiên nằm trong danh sách ID ở trên.
- execution_order: các bước ngắn gọn theo thứ tự thực thi.
- risks_notes: rủi ro bảo mật / quota / cần sandbox nếu có.`;

function normalizePlan(raw: unknown): AiSupportPlanJson | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.tier1_brain !== 'string') return null;

  const tier2 = Array.isArray(o.tier2_agents) ? o.tier2_agents : [];
  const tier3 = Array.isArray(o.tier3_tools) ? o.tier3_tools : [];
  const order = Array.isArray(o.execution_order) ? o.execution_order : [];
  const risks = Array.isArray(o.risks_notes) ? o.risks_notes : [];

  return {
    tier1_brain: o.tier1_brain,
    tier2_agents: tier2
      .filter((x): x is { id: string; role: string } => {
        return (
          !!x &&
          typeof x === 'object' &&
          typeof (x as { id?: unknown }).id === 'string' &&
          typeof (x as { role?: unknown }).role === 'string'
        );
      })
      .map((x) => ({ id: normalizeAgentId(x.id), role: x.role })),
    tier3_tools: tier3
      .filter((x): x is { id: string; usage: string } => {
        return (
          !!x &&
          typeof x === 'object' &&
          typeof (x as { id?: unknown }).id === 'string' &&
          typeof (x as { usage?: unknown }).usage === 'string'
        );
      })
      .map((x) => ({ id: x.id, usage: x.usage })),
    execution_order: order.filter((s): s is string => typeof s === 'string'),
    risks_notes: risks.filter((s): s is string => typeof s === 'string'),
  };
}

export async function generateAiSupportPlan(input: {
  goal: string;
  selectedAgents?: string[];
  selectedTools?: string[];
  llm: AiSupportLlmParams;
}) {
  const selectedAgents = Array.isArray(input.selectedAgents) ? input.selectedAgents : [];
  const selectedTools = Array.isArray(input.selectedTools) ? input.selectedTools : [];

  const agentsCanonical = selectedAgents.map((x) => normalizeAgentId(x)).join(', ');
  const toolsList = selectedTools.join(', ');
  const agentsHint = `Phạm vi khả năng tầng 2 (agent / orchestration) Quản gia có thể dựa vào — ưu tiên các ID sau khi phù hợp mục tiêu: ${agentsCanonical}`;
  const toolsHint = `Phạm vi khả năng tầng 3 (connector / hành động) Quản gia có thể dựa vào — ưu tiên các ID sau khi phù hợp mục tiêu: ${toolsList}`;

  const userPrompt = `## MỤC TIÊU\n${input.goal.trim()}\n\n## NGỮ CẢNH PHẠM VI (tích hợp sẵn)\n${agentsHint}\n${toolsHint}\n\nHãy trả về JSON theo schema đã nêu.`;

  const result = await callLlm(
    {
      system: SYSTEM,
      prompt: userPrompt,
      provider: input.llm.provider,
      model: input.llm.model,
      jsonMode: true,
      temperature: 0.35,
      maxTokens: 2500,
    },
    buildKeys(input.llm.keys),
  );

  let plan = tryParseJson<AiSupportPlanJson>(result.text);
  plan = plan ? normalizePlan(plan) : null;

  return {
    plan,
    raw: result.text,
    meta: { provider: result.provider, model: result.model },
  };
}
