#!/usr/bin/env node
/**
 * Regenerate TypeScript registries from integrations/manifest.json
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  loadManifest,
  runnerIntegrations,
  submoduleIntegrations,
} = require('./lib/integrations-manifest');

const HEADER = `/* eslint-disable */
/** AUTO-GENERATED from integrations/manifest.json — npm run integrations:codegen */
`;

function esc(s) {
  return JSON.stringify(s);
}

function generateIntegrationsRegistry(manifest) {
  const entries = manifest.integrations.map((it) => {
    const lines = [
      '  {',
      `    id: ${esc(it.id)},`,
      `    name: ${esc(it.name)},`,
      `    path: ${esc(it.path)},`,
      `    kind: ${esc(it.kind)},`,
      `    integrationStrategy: ${esc(it.integrationStrategy)},`,
      `    features: ${JSON.stringify(it.features, null, 2).replace(/\n/g, '\n    ')},`,
      `    setupHint: ${esc(it.setupHint)},`,
    ];
    if (it.slashCommand) lines.push(`    slashCommand: ${esc(it.slashCommand)},`);
    if (it.probe) {
      lines.push(
        `    probe: { bin: ${esc(it.probe.bin)}, args: ${JSON.stringify(it.probe.args)} },`,
      );
    }
    lines.push('  },');
    return lines.join('\n');
  });

  return `${HEADER}
import type { IntegrationEntry } from './integrations-registry.types';

export const INTEGRATIONS: IntegrationEntry[] = [
${entries.join('\n')}
];
`;
}

function generateRunnerRegistry(manifest) {
  const runners = runnerIntegrations(manifest);
  const ids = runners.map((r) => r.id);
  const mapEntries = runners.map(
    (r) => `  ${r.id}: ${esc(r.runner.script)},`,
  );
  const maxLens = runners
    .filter((r) => r.runner.maxTaskLen)
    .map((r) => `  ${r.id}: ${r.runner.maxTaskLen},`);

  return `${HEADER}
export const RUNNER_IDS = ${JSON.stringify(ids)} as const;

export type RunnerId = (typeof RUNNER_IDS)[number];

export const RUNNERS: Record<RunnerId, string> = {
${mapEntries.join('\n')}
};

export const RUNNER_MAX_TASK_LEN: Partial<Record<RunnerId, number>> = {
${maxLens.join('\n')}
};
`;
}

function generateGitmodules(manifest) {
  const subs = submoduleIntegrations(manifest);
  if (!subs.length) return null;
  const lines = subs.map((it) => {
    const name = it.path.replace(/\\/g, '/');
    return `[submodule "${name}"]\n\tpath = ${name}\n\turl = ${it.submodule.url}\n`;
  });
  return lines.join('\n');
}

function main() {
  const manifest = loadManifest();
  const domainDir = path.join(ROOT, 'src', 'modules', 'ai-support', 'domain');

  fs.writeFileSync(
    path.join(domainDir, 'integrations-registry.generated.ts'),
    generateIntegrationsRegistry(manifest),
    'utf8',
  );
  fs.writeFileSync(
    path.join(domainDir, 'runner-registry.generated.ts'),
    generateRunnerRegistry(manifest),
    'utf8',
  );

  const gitmodules = generateGitmodules(manifest);
  if (gitmodules) {
    fs.writeFileSync(path.join(ROOT, '.gitmodules'), gitmodules, 'utf8');
  }

  console.log('[integrations:codegen] Wrote integrations-registry.generated.ts');
  console.log('[integrations:codegen] Wrote runner-registry.generated.ts');
  if (gitmodules) console.log('[integrations:codegen] Wrote .gitmodules');
}

main();
