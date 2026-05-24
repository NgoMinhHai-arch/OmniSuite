/**
 * Integrations catalog — data from integrations/manifest.json (SSOT).
 *
 * Chỉnh sửa manifest → `npm run integrations:codegen`.
 * Prompt helpers giữ tại file này (không generate).
 */

export type { IntegrationEntry, IntegrationKind, IntegrationStrategy } from './integrations-registry.types';
export { INTEGRATIONS } from './integrations-registry.generated';

import { INTEGRATIONS } from './integrations-registry.generated';

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
  const runnerSlashes = INTEGRATIONS.filter((i) => i.slashCommand && i.integrationStrategy === 'ai-support-runner')
    .map((i) => i.slashCommand)
    .join(' · ');
  out.push(`Slash runner Quản gia: ${runnerSlashes || '(xem /help)'}.`);
  out.push('Các app full-stack chạy độc lập theo setupHint trong manifest.');
  return out.join('\n');
}
