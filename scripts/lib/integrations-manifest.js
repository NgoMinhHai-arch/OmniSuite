/**
 * Load & helpers for integrations/manifest.json (SSOT).
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'integrations', 'manifest.json');

function loadManifest() {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!data.integrations || !Array.isArray(data.integrations)) {
    throw new Error('manifest.json: missing integrations[]');
  }
  const ids = new Set();
  for (const it of data.integrations) {
    if (ids.has(it.id)) throw new Error(`Duplicate integration id: ${it.id}`);
    ids.add(it.id);
  }
  return data;
}

function runnerIntegrations(manifest) {
  return manifest.integrations.filter((it) => it.integrationStrategy === 'ai-support-runner');
}

function submoduleIntegrations(manifest) {
  return manifest.integrations.filter((it) => it.submodule);
}

function resolveFromRoot(relPath) {
  return path.join(ROOT, relPath.replace(/\//g, path.sep));
}

module.exports = {
  ROOT,
  MANIFEST_PATH,
  loadManifest,
  runnerIntegrations,
  submoduleIntegrations,
  resolveFromRoot,
};
