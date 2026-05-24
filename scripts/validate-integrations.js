#!/usr/bin/env node
/**
 * Validate integrations/manifest.json vs repo (runners, paths, .gitmodules).
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  loadManifest,
  runnerIntegrations,
  submoduleIntegrations,
  resolveFromRoot,
} = require('./lib/integrations-manifest');

let errors = 0;
let warnings = 0;

function err(msg) {
  console.error(`[validate] ERROR: ${msg}`);
  errors += 1;
}
function warn(msg) {
  console.warn(`[validate] WARN: ${msg}`);
  warnings += 1;
}

function main() {
  const manifest = loadManifest();

  for (const it of manifest.integrations) {
    const abs = resolveFromRoot(it.path);
    if (!fs.existsSync(abs)) {
      warn(`path missing (clone/sync?): ${it.path}`);
    }

    if (it.integrationStrategy === 'ai-support-runner') {
      if (!it.runner?.script) err(`${it.id}: ai-support-runner requires runner.script`);
      else {
        const runnerPath = resolveFromRoot(it.runner.script);
        if (!fs.existsSync(runnerPath)) err(`${it.id}: runner not found: ${it.runner.script}`);
      }
    }

    if (it.submodule) {
      const gitMarker = path.join(abs, '.git');
      if (fs.existsSync(abs) && !fs.existsSync(gitMarker)) {
        warn(`${it.id}: ${it.path} exists but is not a git checkout (mirror/vendor?)`);
      }
    }
  }

  const gitmodulesPath = path.join(ROOT, '.gitmodules');
  if (fs.existsSync(gitmodulesPath)) {
    const content = fs.readFileSync(gitmodulesPath, 'utf8');
    for (const it of submoduleIntegrations(manifest)) {
      if (!content.includes(it.path.replace(/\\/g, '/'))) {
        err(`.gitmodules missing entry for ${it.path} — run integrations:codegen`);
      }
    }
  } else if (submoduleIntegrations(manifest).length) {
    warn('No .gitmodules — run npm run integrations:codegen');
  }

  const genRegistry = path.join(
    ROOT,
    'src/modules/ai-support/domain/integrations-registry.generated.ts',
  );
  const genRunners = path.join(ROOT, 'src/modules/ai-support/domain/runner-registry.generated.ts');
  if (!fs.existsSync(genRegistry) || !fs.existsSync(genRunners)) {
    err('Generated registry missing — run: npm run integrations:codegen');
  }

  const slashPath = path.join(ROOT, 'src/modules/ai-support/domain/slash-commands.ts');
  if (fs.existsSync(slashPath)) {
    const slashSrc = fs.readFileSync(slashPath, 'utf8');
    for (const it of runnerIntegrations(manifest)) {
      if (it.slashCommand && !slashSrc.includes(it.slashCommand)) {
        warn(`${it.id}: slash ${it.slashCommand} not found in slash-commands.ts`);
      }
    }
  }

  if (errors) {
    console.error(`[validate] Failed: ${errors} error(s), ${warnings} warning(s)`);
    process.exit(1);
  }
  console.log(`[validate] OK (${manifest.integrations.length} integrations, ${warnings} warning(s))`);
}

main();
