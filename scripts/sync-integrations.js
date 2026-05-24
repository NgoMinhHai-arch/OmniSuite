#!/usr/bin/env node
/**
 * Đồng bộ integrations (git submodule) — TÙY CHỌN, không chạy lúc 01_START.
 *
 * Người dùng thường chỉ cần: git clone repo OmniSuite.
 * Lần đầu dùng /run, /run-browser… Quản gia tự gọi fetch-integration (tải đúng gói đó).
 *
 * Usage:
 *   node scripts/fetch-integration.js open_manus   # khuyến nghị: tải từng gói khi cần
 *   node scripts/sync-integrations.js --all        # tải hết submodule (dev/CI)
 *   node scripts/sync-integrations.js --verify
 *   node scripts/sync-integrations.js --only=browser_use
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { loadManifest, submoduleIntegrations } = require('./lib/integrations-manifest');

const args = process.argv.slice(2);
const VERIFY_ONLY = args.includes('--verify');
const SYNC_ALL = args.includes('--all') || args.includes('--full');
const USE_REMOTE = args.includes('--remote');
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY_ID = onlyArg ? onlyArg.split('=')[1] : args.find((a) => !a.startsWith('-') && a !== 'verify');

function log(msg) {
  console.log(`[integrations] ${msg}`);
}

function runGit(gitArgs, { allowFail = false } = {}) {
  const shell = process.platform === 'win32';
  const r = spawnSync('git', gitArgs, {
    cwd: ROOT,
    stdio: 'inherit',
    shell,
  });
  const code = r.status ?? (r.signal ? 1 : 0);
  if (code !== 0 && !allowFail) {
    process.exit(code || 1);
  }
  return code;
}

function verifySubmodules() {
  const shell = process.platform === 'win32';
  const r = spawnSync('git', ['submodule', 'status', '--recursive'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (r.status !== 0) {
    console.error('[integrations] git submodule status failed:', out || r.error?.message || 'unknown');
    process.exit(1);
  }
  const bad = [];
  const drift = [];
  for (const line of out.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('-') || t.startsWith('U')) bad.push(line);
    if (t.startsWith('+')) drift.push(line);
  }
  if (drift.length) {
    console.warn('[integrations] Một số submodule lệch khỏi commit ghi trong OmniSuite (+):');
    drift.forEach((l) => console.warn(' ', l));
    console.warn('[integrations] OK nếu cố ý; để về đúng pin: git submodule update --init --recursive');
  }
  if (bad.length) {
    console.error('[integrations] Submodule chưa khởi tạo hoặc đang conflict:');
    bad.forEach((l) => console.error(' ', l));
    console.error('[integrations] Chạy: npm run integrations:sync');
    process.exit(1);
  }
  /** open-manus: mirror tùy chọn — không ép trong verify */
  log('Kiểm tra submodule: OK.');
  process.exit(0);
}

function fetchViaScript(id) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'fetch-integration.js'), id], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
}

function main() {
  if (VERIFY_ONLY) {
    if (!fs.existsSync(path.join(ROOT, '.gitmodules'))) {
      log('Không có .gitmodules — Quản gia dùng fetch on-demand khi chạy /run.');
      process.exit(0);
    }
    verifySubmodules();
    return;
  }

  if (ONLY_ID) {
    fetchViaScript(ONLY_ID);
    return;
  }

  if (!SYNC_ALL) {
    log('Mặc định không tải hết integration lúc setup.');
    log('  • Clone: git clone https://github.com/NgoMinhHai-arch/OmniSuite.git');
    log('  • Lần đầu /run hoặc /run-browser: tự tải gói tương ứng');
    log('  • Tải tay một gói: node scripts/fetch-integration.js open_manus');
    log('  • Tải hết (dev): npm run integrations:sync -- --all');
    return;
  }

  if (!fs.existsSync(path.join(ROOT, '.gitmodules'))) {
    console.warn('[integrations] Không có .gitmodules — tải từng gói qua fetch-integration.js');
    const subs = submoduleIntegrations(loadManifest());
    for (const it of subs) fetchViaScript(it.id);
    return;
  }

  log('Đang git submodule sync --recursive …');
  runGit(['submodule', 'sync', '--recursive']);

  log('Đang git submodule update --init --recursive …');
  if (USE_REMOTE) {
    console.warn('[integrations] --remote: có thể lệch commit pin của OmniSuite.');
    runGit(['submodule', 'update', '--init', '--remote', '--recursive']);
  } else {
    runGit(['submodule', 'update', '--init', '--recursive', '--depth', '1']);
  }

  const subs = submoduleIntegrations(loadManifest());
  for (const it of subs) fetchViaScript(it.id);

  log('Xong (--all). Pip runner: scripts/setup-runners-venv.ps1 (chỉ khi cần Quản gia).');
}

main();
