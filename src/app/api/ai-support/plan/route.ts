import { NextResponse } from 'next/server';
import {
  resolveAiSupportAgentIds,
  resolveAiSupportToolIds,
} from '@/modules/ai-support/domain/stack-registry';
import { generateAiSupportPlan } from '@/modules/ai-support/server/plan-service';
import type { ClientKeys } from '@/modules/ai-support/server/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      goal,
      selectedAgents = [],
      selectedTools = [],
      provider,
      model,
      keys,
    } = body || {};

    if (!goal || typeof goal !== 'string') {
      return NextResponse.json({ error: 'Thiếu mục tiêu (goal)' }, { status: 400 });
    }

    const result = await generateAiSupportPlan({
      goal: goal.trim(),
      selectedAgents: resolveAiSupportAgentIds(selectedAgents),
      selectedTools: resolveAiSupportToolIds(selectedTools),
      llm: { provider, model, keys: keys as ClientKeys | undefined },
    });

    if (!result.plan) {
      return NextResponse.json({
        error: 'LLM không trả JSON hợp lệ',
        raw: result.raw?.slice(0, 8000),
        meta: result.meta,
      });
    }

    return NextResponse.json({
      plan: result.plan,
      meta: result.meta,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Lỗi máy chủ' },
      { status: 500 },
    );
  }
}
