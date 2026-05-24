#!/usr/bin/env node
/**
 * Tải THEO YÊU CẦU một integration (shallow clone) — không cài hết lúc setup.
 *
 * Usage:
 *   node scripts/fetch-integration.js open_manus
 *   node scripts/fetch-integration.js browser_use
 *   node scripts/fetch-integration.js --list
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  loadManifest,
  submoduleIntegrations,
  resolveFromRoot,
} = require('./lib/integrations-manifest');

function log(msg) {
  console.log(`[fetch-integration] ${msg}`);
}

function isReady(integration) {
  const base = resolveFromRoot(integration.path);
  if (!integration.probe) return fs.existsSync(base);
  const probePath = integration.probe.args?.join(' ') || '';
  const m = /pathlib\.Path\("([^"]+)"\)/.exec(probePath);
  if (m) {
    return fs.existsSync(resolveFromRoot(m[1]));
  }
  if (integration.id === 'browser_use') {
    return fs.existsSync(path.join(base, 'browser_use')) || fs.existsSync(path.join(base, 'pyproject.toml'));
  }
  return fs.existsSync(base) && fs.readdirSync(base).length > 2;
}

function shallowClone(url, targetDir) {
  if (fs.existsSync(targetDir)) {
    const gitDir = path.join(targetDir, '.git');
    if (fs.existsSync(gitDir)) {
      log(`Đã có ${targetDir} — bỏ qua.`);
      return 0;
    }
    log(`Thư mục ${targetDir} tồn tại nhưng không phải git — không ghi đè.`);
    return 1;
  }
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  log(`Đang tải (shallow) → ${targetDir}`);
  const shell = process.platform === 'win32';
  const r = spawnSync('git', ['clone', '--depth', '1', url, targetDir], {
    cwd: ROOT,
    stdio: 'inherit',
    shell,
  });
  return r.status ?? 1;
}

function tryGitSubmodule(integration) {
  if (!fs.existsSync(path.join(ROOT, '.gitmodules'))) return false;
  const rel = integration.path.replace(/\\/g, '/');
  if (!fs.readFileSync(path.join(ROOT, '.gitmodules'), 'utf8').includes(rel)) return false;
  const shell = process.platform === 'win32';
  spawnSync('git', ['submodule', 'sync', '--', rel], { cwd: ROOT, stdio: 'pipe', shell });
  const r = spawnSync('git', ['submodule', 'update', '--init', '--depth', '1', '--', rel], {
    cwd: ROOT,
    stdio: 'inherit',
    shell,
  });
  return (r.status ?? 1) === 0;
}

function fetchOne(id) {
  const manifest = loadManifest();
  const integration = manifest.integrations.find((it) => it.id === id);
  if (!integration) {
    console.error(`Không tìm thấy integration id: ${id}`);
    process.exit(1);
  }
  if (!integration.submodule?.url) {
    log(`${id} không có submodule — cài theo setupHint trong manifest (pip / clone tay).`);
    process.exit(0);
  }

  if (isReady(integration)) {
    log(`${integration.name} đã sẵn sàng tại ${integration.path}`);
    process.exit(0);
  }

  if (tryGitSubmodule(integration) && isReady(integration)) {
    log(`${integration.name} — submodule OK.`);
    process.exit(0);
  }

  const code = shallowClone(integration.submodule.url, resolveFromRoot(integration.path));
  if (code !== 0) process.exit(code);
  if (!isReady(integration)) {
    console.error(`Đã clone nhưng chưa thấy file probe — kiểm tra mạng hoặc chạy lại.`);
    process.exit(1);
  }
  log(`${integration.name} — xong.`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--list')) {
    const subs = submoduleIntegrations(loadManifest());
    subs.forEach((it) => console.log(`  ${it.id}\t${it.path}`));
    return;
  }
  const id = args.find((a) => !a.startsWith('-'));
  if (!id) {
    console.error('Cần id: open_manus | browser_use | crawl4ai | activepieces (hoặc --list)');
    process.exit(1);
  }
  fetchOne(id);
}

main();
