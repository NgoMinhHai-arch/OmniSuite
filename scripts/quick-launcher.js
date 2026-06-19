#!/usr/bin/env node
/**
 * OmniSuite Quick Launcher
 *
 * Goal: user runs one short command, app starts fast.
 * - First run / broken install: run full setup.
 * - Normal run: skip npm install + pip install + Playwright download.
 * - Start services only when ports are not already alive.
 */

const { spawn, exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const util = require('util');

const execAsync = util.promisify(exec);
const { resolvePythonExecutable, pythonEnvPatch, writeRuntimeJson } = require('./resolve-python');

const PROJECT_DIR = path.join(__dirname, '..');
const ENV_PATH = path.join(PROJECT_DIR, '.env');
const ENV_EXAMPLE_PATH = path.join(PROJECT_DIR, '.env.example');
const GUARD_DIR = path.join(PROJECT_DIR, '.omnisuite');
const SETUP_STATE = path.join(GUARD_DIR, 'quick-start-state.json');

process.env.OMNISUITE_ROOT = PROJECT_DIR;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(type, msg) {
  const color = type === 'ok' ? colors.green : type === 'err' ? colors.red : type === 'warn' ? colors.yellow : type === 'step' ? colors.cyan : colors.blue;
  const prefix = type === 'ok' ? '[OK]' : type === 'err' ? '[LOI]' : type === 'warn' ? '[CANH BAO]' : type === 'step' ? '[*]' : '[INFO]';
  console.log(`${color}${prefix}${colors.reset} ${msg}`);
}

function parseDotEnv(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnvIntoProcess() {
  if (!fs.existsSync(ENV_PATH)) return;
  const env = parseDotEnv(fs.readFileSync(ENV_PATH, 'utf8'));
  for (const [key, value] of Object.entries(env)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

function ensureLine(content, key, valueFactory) {
  const re = new RegExp(`^${key}=(.*)$`, 'm');
  const match = content.match(re);
  const current = match ? (match[1] || '').trim() : '';
  if (current) return { content, value: current, changed: false };
  const nextValue = typeof valueFactory === 'function' ? valueFactory() : valueFactory;
  if (match) {
    return { content: content.replace(re, `${key}=${nextValue}`), value: nextValue, changed: true };
  }
  let next = content;
  if (next.length && !next.endsWith('\n')) next += '\n';
  next += `${key}=${nextValue}\n`;
  return { content: next, value: nextValue, changed: true };
}

function ensureEnv() {
  let content = '';
  let changed = false;

  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, 'utf8');
  } else if (fs.existsSync(ENV_EXAMPLE_PATH)) {
    content = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');
    log('warn', 'Chua co .env — tao tu .env.example.');
    changed = true;
  } else {
    log('warn', 'Chua co .env/.env.example — tao .env toi thieu.');
    changed = true;
  }

  const apply = (key, val) => {
    const r = ensureLine(content, key, val);
    content = r.content;
    changed = changed || r.changed;
    process.env[key] = process.env[key] || r.value;
  };

  apply('INTERNAL_TOKEN', () => `omni_${crypto.randomBytes(32).toString('hex')}`);
  apply('NEXTAUTH_SECRET', () => `omnisuite_${crypto.randomBytes(32).toString('hex')}`);
  apply('NEXTAUTH_URL', 'http://localhost:3000');
  apply('PYTHON_ENGINE_URL', 'http://127.0.0.1:8082');
  apply('OMNISUITE_STRICT_SECURITY', '1');
  apply('OMNISUITE_LOCALHOST_ONLY', '1');
  apply('DATABASE_URL', 'skip');

  const py = resolvePythonExecutable();
  if (py.includes(path.sep)) apply('PYTHON_BIN', py);

  if (changed || !fs.existsSync(ENV_PATH)) {
    fs.writeFileSync(ENV_PATH, content, 'utf8');
    log('ok', '.env san sang.');
  }

  loadEnvIntoProcess();
  try { writeRuntimeJson(); } catch { /* ignore */ }
}

function runCommand(cmd, args, options = {}) {
  const shell = process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx');
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: PROJECT_DIR,
      shell,
      stdio: options.silent ? 'pipe' : 'inherit',
      env: { ...pythonEnvPatch(), ...process.env, ...(options.env || {}) },
    });
    child.on('close', (code) => {
      if (code === 0 || options.ignoreError) resolve(code);
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
    child.on('error', reject);
  });
}

function checkCommand(cmd) {
  return new Promise((resolve) => {
    exec(`${cmd} --version`, { cwd: PROJECT_DIR, windowsHide: true }, (err) => resolve(!err));
  });
}

function checkPort(port) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.once('connect', () => { client.destroy(); resolve(true); });
    client.once('error', () => { client.destroy(); resolve(false); });
    client.setTimeout(900, () => { client.destroy(); resolve(false); });
    client.connect(port, '127.0.0.1');
  });
}

async function waitPort(port, seconds = 15) {
  const attempts = Math.max(1, seconds * 2);
  for (let i = 0; i < attempts; i++) {
    if (await checkPort(port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function fileHash(rel) {
  const p = path.join(PROJECT_DIR, rel);
  if (!fs.existsSync(p)) return '';
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);
}

function depsSignature() {
  return [
    fileHash('package-lock.json'),
    fileHash('package.json'),
    fileHash('requirements.txt'),
    fileHash('python_engine/requirements.txt'),
    fileHash('services/clip_service/requirements.txt'),
  ].join(':');
}

function canImport(mod) {
  const py = resolvePythonExecutable();
  try {
    execSync(`"${py}" -c "import ${mod}"`, {
      cwd: PROJECT_DIR,
      stdio: 'pipe',
      windowsHide: true,
      env: pythonEnvPatch(),
    });
    return true;
  } catch {
    return false;
  }
}

function nodeReady() {
  return fs.existsSync(path.join(PROJECT_DIR, 'node_modules', 'next')) && fs.existsSync(path.join(PROJECT_DIR, 'node_modules', 'playwright'));
}

function pythonReady() {
  const required = ['fastapi', 'uvicorn', 'flask', 'httpx', 'bs4', 'playwright'];
  return required.every(canImport);
}

function playwrightReady() {
  try {
    const { chromiumBrowserReady } = require('./setup-all-tools');
    return chromiumBrowserReady();
  } catch {
    return false;
  }
}

function readState() {
  try {
    if (!fs.existsSync(SETUP_STATE)) return null;
    return JSON.parse(fs.readFileSync(SETUP_STATE, 'utf8'));
  } catch {
    return null;
  }
}

function saveState(extra = {}) {
  fs.mkdirSync(GUARD_DIR, { recursive: true });
  fs.writeFileSync(
    SETUP_STATE,
    JSON.stringify({ signature: depsSignature(), updatedAt: new Date().toISOString(), ...extra }, null, 2),
    'utf8',
  );
}

function setupLooksFresh() {
  const state = readState();
  return !!state && state.signature === depsSignature() && nodeReady() && pythonReady();
}

async function smartSetup() {
  const force = process.argv.includes('--repair') || process.argv.includes('--setup') || process.env.OMNISUITE_FORCE_SETUP === '1';
  if (!force && setupLooksFresh()) {
    log('ok', 'Smart setup: dependency da san sang — bo qua npm install/pip install.');
    if (!playwrightReady()) {
      log('warn', 'Playwright Chromium chua san sang — chi sua rieng Playwright.');
      const { installPlaywrightBrowsers } = require('./setup-all-tools');
      await installPlaywrightBrowsers((type, msg) => log(type, msg));
    }
    return true;
  }

  log('step', force ? 'Repair mode: chay full setup.' : 'Lan dau hoac dependency doi — chay full setup mot lan.');
  const { runFullSetup } = require('./setup-all-tools');
  const ok = await runFullSetup((type, msg) => log(type, msg));
  if (ok) saveState({ nodeReady: nodeReady(), pythonReady: pythonReady(), playwrightReady: playwrightReady() });
  return ok;
}

async function maybeSyncGit() {
  if (process.argv.includes('--no-pull') || !fs.existsSync(path.join(PROJECT_DIR, '.git'))) return;
  if (!(await checkCommand('git'))) return;
  try {
    await execAsync('git fetch origin', { cwd: PROJECT_DIR, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
    const { stdout: branchOut } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: PROJECT_DIR, windowsHide: true });
    const branch = (branchOut || '').trim();
    if (!branch || branch === 'HEAD') return;
    const { stdout: dirty } = await execAsync('git status --porcelain', { cwd: PROJECT_DIR, windowsHide: true });
    if ((dirty || '').trim()) {
      log('info', 'Co file thay doi local — bo qua git pull de tranh mat sua doi.');
      return;
    }
    const { stdout: cnt } = await execAsync(`git rev-list --count HEAD..origin/${branch}`, { cwd: PROJECT_DIR, windowsHide: true });
    const behind = parseInt((cnt || '').trim(), 10) || 0;
    if (behind > 0) {
      log('step', `Co ${behind} commit moi — tu dong git pull.`);
      await runCommand('git', ['pull', '--no-edit', 'origin', branch]);
    }
  } catch {
    log('info', 'Bo qua dong bo GitHub (offline/loi mang).');
  }
}

async function startService(name, cmd, args, port = null) {
  if (port && await checkPort(port)) {
    log('ok', `${name} da chay san (port ${port}) — bo qua khoi dong lai.`);
    return null;
  }

  log('step', `Khoi dong ${name}...`);
  const child = spawn(cmd, args, {
    cwd: PROJECT_DIR,
    shell: process.platform === 'win32',
    stdio: 'inherit',
    env: { ...pythonEnvPatch(), ...process.env, FORCE_COLOR: '1' },
  });

  child.on('error', (err) => log('err', `${name}: ${err.message}`));

  if (port) {
    const ok = await waitPort(port, 18);
    if (ok) log('ok', `${name} san sang (port ${port})`);
    else log('warn', `${name} chua mo port ${port} — xem log phia tren.`);
  } else {
    await new Promise((r) => setTimeout(r, 1200));
    log('ok', `${name} da duoc goi khoi dong.`);
  }

  return child;
}

function openBrowser() {
  const url = 'http://localhost:3000';
  if (process.argv.includes('--no-open')) return;
  const cmd = process.platform === 'win32' ? `start "" ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
  exec(cmd, { windowsHide: true }, () => {});
}

async function main() {
  console.clear();
  console.log(`${colors.bold}${colors.cyan}========================================`);
  console.log('   OMNISUITE — GO MODE');
  console.log(`========================================${colors.reset}`);

  ensureEnv();

  if (!(await checkCommand('node'))) {
    log('err', 'Chua co Node.js. Cai Node.js truoc, roi chay lai GO.cmd.');
    process.exit(1);
  }

  const py = resolvePythonExecutable();
  try {
    execSync(`"${py}" --version`, { stdio: 'pipe', windowsHide: true, env: pythonEnvPatch() });
    log('ok', `Python OK (${py})`);
  } catch {
    log('err', 'Khong tim thay Python hoat dong. Chay script cai dat/runtime truoc.');
    process.exit(1);
  }

  await maybeSyncGit();

  const ok = await smartSetup();
  if (!ok) {
    log('err', 'Setup chua xong. Thu chay: GO.cmd --repair');
    process.exit(1);
  }

  const services = [];
  services.push(await startService('Python Backend + Image Pipeline (8081/8000)', 'node', ['scripts/start-backend.js'], null));
  services.push(await startService('Python Engine (8082)', resolvePythonExecutable(), ['-m', 'uvicorn', 'python_engine.main:app', '--host', '127.0.0.1', '--port', '8082', '--reload'], 8082));
  services.push(await startService('Next.js Frontend (3000)', 'node', ['scripts/run-next-dev.js'], 3000));

  setTimeout(openBrowser, 800);

  console.log(`\n${colors.green}${colors.bold}SAN SANG: http://localhost:3000${colors.reset}`);
  console.log('Nhan Ctrl+C de dung. Lan sau chi can chay GO.cmd hoac npm run go.\n');

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('warn', 'Dang dung services...');
    for (const child of services) {
      if (!child) continue;
      try { child.kill(); } catch { /* ignore */ }
    }
    setTimeout(() => process.exit(0), 1000);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await new Promise(() => {});
}

main().catch((err) => {
  log('err', err && err.message ? err.message : String(err));
  process.exit(1);
});
