/**
 * Gọi từ API Quản gia — chỉ tải integration khi user thực sự dùng runner.
 */
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { loadManifest, resolveFromRoot } = require('./integrations-manifest');

const ROOT = path.resolve(__dirname, '..', '..');

const RUNNER_TO_INTEGRATION = {
  open_manus: 'open_manus',
  browser_use: 'browser_use',
  applypilot: 'applypilot',
  job_scraper: 'job_scraper',
};

function integrationReady(integration) {
  if (!integration) return false;
  const base = resolveFromRoot(integration.path);
  if (!fs.existsSync(base)) return false;
  const probeStr = integration.probe?.args?.join(' ') || '';
  const m = /pathlib\.Path\("([^"]+)"\)/.exec(probeStr);
  if (m) return fs.existsSync(resolveFromRoot(m[1]));
  if (integration.id === 'open_manus') {
    return fs.existsSync(path.join(base, 'app', 'agent', 'manus.py'));
  }
  if (integration.id === 'browser_use') {
    return (
      fs.existsSync(path.join(base, 'browser_use')) || fs.existsSync(path.join(base, 'pyproject.toml'))
    );
  }
  if (integration.id === 'crawl4ai') {
    return (
      fs.existsSync(path.join(base, 'crawl4ai')) || fs.existsSync(path.join(base, 'pyproject.toml'))
    );
  }
  if (integration.id === 'activepieces') {
    return (
      fs.existsSync(path.join(base, 'package.json')) ||
      fs.existsSync(path.join(base, 'docker-compose.yml'))
    );
  }
  try {
    return fs.readdirSync(base).filter((n) => n !== '.git').length > 0;
  } catch {
    return false;
  }
}

function runFetchScript(integrationId, { onLog } = {}) {
  const script = path.join(ROOT, 'scripts', 'fetch-integration.js');
  if (onLog) onLog(`Đang chạy: node scripts/fetch-integration.js ${integrationId}`);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, integrationId], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    let out = '';
    child.stdout?.on('data', (c) => {
      const t = c.toString('utf-8');
      out += t;
      t.split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((line) => {
          if (onLog) onLog(line.replace(/^\[fetch-integration\]\s*/, ''));
        });
    });
    child.stderr?.on('data', (c) => {
      out += c.toString('utf-8');
    });
    child.on('close', (code) => resolve({ code: code ?? 1, out }));
    child.on('error', (err) => resolve({ code: 1, out: err.message }));
  });
}

/**
 * @param {string} runnerId
 * @returns {{ ok: boolean, message?: string, fetched?: boolean }}
 */
function ensureIntegrationForRunner(runnerId) {
  return ensureIntegrationForRunnerAsync(runnerId).catch((e) => ({
    ok: false,
    message: e instanceof Error ? e.message : String(e),
  }));
}

/**
 * @param {string} runnerId
 * @param {{ onLog?: (line: string) => void }} [opts]
 * @returns {Promise<{ ok: boolean, message?: string, fetched?: boolean }>}
 */
async function ensureIntegrationForRunnerAsync(runnerId, opts = {}) {
  const { onLog } = opts;
  const integrationId = RUNNER_TO_INTEGRATION[runnerId];
  if (!integrationId) return { ok: true };

  let manifest;
  try {
    manifest = loadManifest();
  } catch (e) {
    return { ok: false, message: `manifest: ${e.message}` };
  }

  const integration = manifest.integrations.find((it) => it.id === integrationId);
  if (!integration) return { ok: true };

  if (integrationReady(integration)) return { ok: true };

  if (!integration.submodule?.url) {
    return {
      ok: false,
      message: `${integration.name}: chưa có trên máy. ${integration.setupHint}`,
    };
  }

  const { code, out } = await runFetchScript(integrationId, { onLog });
  if (code !== 0) {
    return {
      ok: false,
      message: `Không tải được ${integration.name}. ${out.slice(-500)}`,
    };
  }

  if (!integrationReady(integration)) {
    return { ok: false, message: `${integration.name} đã tải nhưng chưa sẵn sàng — thử lại.` };
  }

  return { ok: true, fetched: true, message: `Đã tải ${integration.name}.` };
}

/** Đồng bộ — dùng khi cần chặn event loop (ít dùng). */
function ensureIntegrationForRunnerSync(runnerId) {
  const integrationId = RUNNER_TO_INTEGRATION[runnerId];
  if (!integrationId) return { ok: true };
  const script = path.join(ROOT, 'scripts', 'fetch-integration.js');
  const r = spawnSync(process.execPath, [script, integrationId], {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
    timeout: 600_000,
  });
  const manifest = loadManifest();
  const integration = manifest.integrations.find((it) => it.id === integrationId);
  if ((r.status ?? 1) !== 0) {
    return { ok: false, message: (r.stderr || r.stdout || '').slice(-400) };
  }
  return { ok: integrationReady(integration), fetched: true };
}

module.exports = {
  ensureIntegrationForRunner,
  ensureIntegrationForRunnerAsync,
  ensureIntegrationForRunnerSync,
  integrationReady,
  RUNNER_TO_INTEGRATION,
};
