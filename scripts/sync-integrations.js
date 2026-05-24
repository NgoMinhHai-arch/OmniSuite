#!/usr/bin/env node
/**
 * Đồng bộ integrations (git submodule) + optional shallow clone OpenManus nếu chưa có submodule (mirror).
 *
 * Usage:
 *   node scripts/sync-integrations.js           # submodule sync/update + shallow clone open-manus nếu thiếu
 *   node scripts/sync-integrations.js --verify  # chỉ kiểm tra (CI / sau clone): thoát !=0 nếu submodule chưa init
 *   node scripts/sync-integrations.js --no-open-manus
 *   node scripts/sync-integrations.js --remote # CẬN THẬN: kéo nhánh remote (lệch commit pin của OmniSuite)
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OPEN_MANUS_URL = 'https://github.com/FoundationAgents/OpenManus.git';
const OPEN_MANUS_REL = path.join('integrations', 'ai-support', 'submodules', 'open-manus');

const args = process.argv.slice(2);
const VERIFY_ONLY = args.includes('--verify');
const NO_OPEN_MANUS = args.includes('--no-open-manus');
const USE_REMOTE = args.includes('--remote');

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

function ensureOpenManusMirror() {
  const target = path.join(ROOT, OPEN_MANUS_REL);
  const gitMarker = path.join(target, '.git');
  if (fs.existsSync(gitMarker)) {
    log('integrations/ai-support/submodules/open-manus/ đã có — bỏ qua.');
    return;
  }
  if (fs.existsSync(target)) {
    log('Thư mục open-manus tồn tại nhưng không phải git repo — không ghi đè.');
    return;
  }
  log(`Shallow clone OpenManus → ${OPEN_MANUS_REL} (slash /run dùng PYTHONPATH + submodule).`);
  const shell = process.platform === 'win32';
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const r = spawnSync('git', ['clone', '--depth', '1', OPEN_MANUS_URL, target], {
    cwd: ROOT,
    stdio: 'inherit',
    shell,
  });
  if ((r.status ?? 1) !== 0) {
    process.exit(r.status ?? 1);
  }
}

function main() {
  if (!fs.existsSync(path.join(ROOT, '.gitmodules'))) {
    console.warn('[integrations] Không có .gitmodules — bỏ qua submodule.');
    if (!VERIFY_ONLY && !NO_OPEN_MANUS) ensureOpenManusMirror();
    return;
  }

  if (VERIFY_ONLY) {
    verifySubmodules();
    return;
  }

  log('Đang git submodule sync --recursive …');
  runGit(['submodule', 'sync', '--recursive']);

  log('Đang git submodule update --init --recursive …');
  if (USE_REMOTE) {
    console.warn(
      '[integrations] --remote: cập nhật submodule theo HEAD trên remote (có thể khác commit pin của OmniSuite).',
    );
    runGit(['submodule', 'update', '--init', '--remote', '--recursive']);
  } else {
    runGit(['submodule', 'update', '--init', '--recursive']);
  }

  if (!NO_OPEN_MANUS) ensureOpenManusMirror();

  log('Xong. Bước tiếp: setup venv runners (scripts/setup-runners-venv.ps1 hoặc .sh).');
}

main();
