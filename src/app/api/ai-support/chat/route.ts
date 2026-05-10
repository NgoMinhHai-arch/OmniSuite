import { NextResponse } from 'next/server';
import {
  buildSystemCheckAnswer,
  generateGeneralChatReply,
  resolveChatIntent,
  tryHandleStaticSlash,
} from '@/modules/ai-support/server/chat-service';
import { generateAiSupportPlan } from '@/modules/ai-support/server/plan-service';
import type { ClientKeys } from '@/modules/ai-support/server/types';
import {
  resolveAiSupportAgentIds,
  resolveAiSupportToolIds,
} from '@/modules/ai-support/domain/stack-registry';
import { getSystemConfig } from '@/shared/lib/config';
import { tryOmniSuiteUsageFastAnswer } from '@/modules/ai-support/domain/omnisuite-knowledge';

function effectiveStatusFlags(client?: ClientKeys): Record<string, boolean> {
  const sys = getSystemConfig() as unknown as Record<string, unknown>;
  const merged: Record<string, boolean> = {};
  Object.entries(sys).forEach(([k, v]) => {
    merged[k] = typeof v === 'string' ? v.trim().length > 0 : !!v;
  });
  if (client) {
    Object.entries(client).forEach(([k, v]) => {
      if (typeof v === 'string' && v.trim()) merged[k] = true;
    });
  }
  return merged;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      message,
      history = [],
      selectedAgents = [],
      selectedTools = [],
      provider,
      model,
      keys,
    } = body || {};

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Thiếu message' }, { status: 400 });
    }

    const intent = resolveChatIntent(message);
    const llm = { provider, model, keys: keys as ClientKeys | undefined };

    if (intent.intent === 'static') {
      const answer = tryHandleStaticSlash(message);
      if (answer) {
        return NextResponse.json({ kind: 'chat', message: answer });
      }
    }

    if (intent.intent === 'system_check' || intent.command === '/check') {
      const merged = effectiveStatusFlags(keys as ClientKeys | undefined);
      return NextResponse.json({
        kind: 'chat',
        message: buildSystemCheckAnswer(merged),
      });
    }

    if (intent.intent === 'runner') {
      // /run và /run-browser không đi qua route này — UI gọi /api/ai-support/run (NDJSON stream).
      return NextResponse.json({
        kind: 'chat',
        message:
          'Lệnh runner được xử lý bởi /api/ai-support/run (NDJSON stream). ' +
          'Trên Quản gia: `/run <task>` = OpenManus; `/run-browser <task>` = browser-use + Playwright.',
      });
    }

    if (intent.intent === 'plan') {
      const planGoal = intent.args || message;
      const rawAgents = Array.isArray(selectedAgents) ? selectedAgents : [];
      const agentsForResolve =
        intent.command === '/browser'
          ? ['browser_agent', ...rawAgents.filter((id: string) => id !== 'browser_agent')]
          : rawAgents;

      const result = await generateAiSupportPlan({
        goal: planGoal,
        selectedAgents: resolveAiSupportAgentIds(agentsForResolve),
        selectedTools: resolveAiSupportToolIds(selectedTools),
        llm,
      });

      if (!result.plan) {
        return NextResponse.json({
          kind: 'error',
          error: 'Không parse được JSON kế hoạch',
          raw: result.raw?.slice(0, 8000),
          meta: result.meta,
        });
      }

      return NextResponse.json({
        kind: 'plan',
        plan: result.plan,
        meta: result.meta,
      });
    }

    if (intent.intent === 'web_search') {
      const result = await generateGeneralChatReply({
        message: intent.args.trim(),
        history: Array.isArray(history) ? history : [],
        llm,
        webMode: 'force',
      });
      return NextResponse.json({
        kind: 'chat',
        message: result.text,
        actions: result.actions,
        meta: result.meta,
      });
    }

    if (intent.intent === 'chat') {
      const fastUsage = tryOmniSuiteUsageFastAnswer(typeof message === 'string' ? message : '');
      if (fastUsage) {
        return NextResponse.json({
          kind: 'chat',
          message: fastUsage.message,
          actions: [{ type: 'open', href: fastUsage.href, label: fastUsage.label }],
          meta: {
            provider: typeof provider === 'string' ? provider : '',
            model: typeof model === 'string' ? model : '',
          },
        });
      }
    }

    const result = await generateGeneralChatReply({
      message: intent.args || message,
      history: Array.isArray(history) ? history : [],
      llm,
    });

    return NextResponse.json({
      kind: 'chat',
      message: result.text,
      actions: result.actions,
      meta: result.meta,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Lỗi máy chủ' },
      { status: 500 },
    );
  }
}
