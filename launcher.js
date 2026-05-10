/**
 * OMNISUITE LAUNCHER
 * ÄÆ¡n giáº£n hÃ³a viá»‡c khá»Ÿi Ä‘á»™ng - chá»‰ cáº§n cháº¡y: node launcher.js
 */

const { spawn, exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const PROJECT_DIR = __dirname;
const LOGS_DIR = path.join(PROJECT_DIR, 'logs');
const ENV_PATH = path.join(PROJECT_DIR, '.env');
const ENV_EXAMPLE_PATH = path.join(PROJECT_DIR, '.env.example');

// MÃ u cho console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(type, msg) {
  const time = new Date().toLocaleTimeString('vi-VN');
  let color = colors.reset;
  let prefix = '[?]';
  
  switch(type) {
    case 'ok': color = colors.green; prefix = '[OK]'; break;
    case 'err': color = colors.red; prefix = '[LOI]'; break;
    case 'warn': color = colors.yellow; prefix = '[CANH BAO]'; break;
    case 'info': color = colors.blue; prefix = '[INFO]'; break;
    case 'step': color = colors.cyan; prefix = '[*]'; break;
  }
  
  console.log(`${color}${prefix}${colors.reset} ${msg}`);
}

function checkCommand(cmd) {
  return new Promise((resolve) => {
    exec(`${cmd} --version`, { windowsHide: true }, (err) => {
      resolve(!err);
    });
  });
}

/**
 * Doc 1 bien tu .env (khong dung dotenv vi launcher chua load .env vao process.env).
 * Tra ve chuoi (co the rong) — khong throw.
 */
function readEnvVar(name) {
  if (process.env[name]) return String(process.env[name]).trim();
  try {
    if (!fs.existsSync(ENV_PATH)) return '';
    const content = fs.readFileSync(ENV_PATH, 'utf8');
    const re = new RegExp(`^${name}=(.*)$`, 'm');
    const m = content.match(re);
    if (!m) return '';
    let v = (m[1] || '').trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v;
  } catch {
    return '';
  }
}

/**
 * Kiem tra Ollama daemon (local hoac OLLAMA_BASE_URL trong .env) — KHONG bat buoc.
 * Chi muc dich thong bao cho user biet co Ollama san sang khong.
 */
async function probeOllama() {
  if (typeof fetch !== 'function' || typeof AbortController !== 'function') {
    return; // Node < 18: bo qua probe (khong chan luong khoi dong)
  }
  const envBase = readEnvVar('OLLAMA_BASE_URL');
  const envKey = readEnvVar('OLLAMA_API_KEY');
  const raw = (envBase || 'http://localhost:11434').trim();
  let origin = raw.replace(/\/+$/, '');
  origin = origin
    .replace(/\/v1\/chat\/completions$/i, '')
    .replace(/\/v1$/i, '')
    .replace(/\/api\/tags$/i, '');
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(origin);

  let timer = null;
  try {
    const ac = new AbortController();
    timer = setTimeout(() => ac.abort(), 1500);
    const headers = { Accept: 'application/json' };
    if (envKey) headers.Authorization = `Bearer ${envKey}`;
    const resp = await fetch(`${origin}/api/tags`, { signal: ac.signal, headers });
    clearTimeout(timer);
    timer = null;
    if (!resp.ok) {
      log('warn', `Ollama o ${origin} tra HTTP ${resp.status} — bo qua. (Cloud LLM van chay binh thuong)`);
      return;
    }
    const data = await resp.json().catch(() => ({}));
    const models = Array.isArray(data.models) ? data.models : [];
    if (models.length === 0) {
      log('info', `Ollama o ${origin} dang chay nhung CHUA co model. Chay vi du: ollama pull llama3.2`);
    } else {
      const names = models.map((m) => m.name || m.model).filter(Boolean).slice(0, 3).join(', ');
      log('ok', `Ollama OK (${origin}) — ${models.length} model${models.length > 1 ? 's' : ''}: ${names}${models.length > 3 ? ', ...' : ''}`);
    }
  } catch {
    if (timer) clearTimeout(timer);
    if (isLocal) {
      log('info', 'Ollama local chua chay (bo qua) — neu muon dung Ollama: tai https://ollama.com va chay "ollama serve" + "ollama pull llama3.2".');
    } else {
      log('warn', `Khong ket noi duoc Ollama tai ${origin} (tunnel offline?). Cloud LLM van dung binh thuong.`);
    }
  }
}

/**
 * Goi Ollama de unload toan bo model dang load (giai phong VRAM/RAM).
 * Best-effort — khong throw, timeout ngan de khong chan shutdown.
 */
async function unloadOllamaModelsBestEffort() {
  if (typeof fetch !== 'function' || typeof AbortController !== 'function') return;
  const envBase = readEnvVar('OLLAMA_BASE_URL');
  const envKey = readEnvVar('OLLAMA_API_KEY');
  let origin = (envBase || 'http://localhost:11434').trim().replace(/\/+$/, '');
  origin = origin
    .replace(/\/v1\/chat\/completions$/i, '')
    .replace(/\/v1$/i, '')
    .replace(/\/api\/tags$/i, '');

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (envKey) headers.Authorization = `Bearer ${envKey}`;

  let models = [];
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 1500);
    const resp = await fetch(`${origin}/api/ps`, { signal: ac.signal, headers });
    clearTimeout(t);
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      if (Array.isArray(data && data.models)) {
        models = data.models.map((m) => (m && (m.name || m.model)) || '').filter(Boolean);
      }
    }
  } catch {
    return;
  }

  if (models.length === 0) return;

  let unloaded = 0;
  for (const model of models) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 2500);
      const resp = await fetch(`${origin}/api/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, keep_alive: 0 }),
        signal: ac.signal,
      });
      clearTimeout(t);
      if (resp.ok) unloaded++;
    } catch { /* ignore */ }
  }
  if (unloaded > 0) {
    log('ok', `Da yeu cau Ollama unload ${unloaded}/${models.length} model — VRAM duoc giai phong.`);
  }
}

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: PROJECT_DIR,
      shell: true,
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    
    child.on('close', (code) => {
      if (code === 0 || options.ignoreError) resolve(code);
      else reject(new Error(`Command failed with code ${code}`));
    });
    
    child.on('error', reject);
  });
}

async function ensureDependencies() {
  log('step', 'Kiem tra moi truong...');
  
  // Kiá»ƒm tra Node.js
  const hasNode = await checkCommand('node');
  if (!hasNode) {
    log('err', 'KHONG TIM THAY NODE.JS!');
    log('info', 'Chay lai file 01_BAT_DAU_OMNISUITE.bat (tu dong cai bang winget), hoac tai: https://nodejs.org/');
    return false;
  }
  log('ok', 'Node.js OK');
  
  // Kiá»ƒm tra Python
  const hasPython = await checkCommand('python');
  if (!hasPython) {
    log('err', 'KHONG TIM THAY PYTHON!');
    log('info', 'Chay lai file 01_BAT_DAU_OMNISUITE.bat (tu dong cai bang winget), hoac tai: https://www.python.org/downloads/');
    return false;
  }
  log('ok', 'Python OK');
  
  return true;
}

/**
 * Dong bo ma nguon tu GitHub / may chu xa:
 * - Can thu muc .git + phan mem "Git for Windows" (lenh git tren may) — KHONG phai trang web GitHub.
 * - fetch + pull neu working tree sach; khong ghi de file ban da sua chua commit.
 */
async function trySyncGitUpdates() {
  const gitDir = path.join(PROJECT_DIR, '.git');
  if (!fs.existsSync(gitDir)) {
    log('info', 'Khong co .git — bo qua tai ban moi (thuong la ban ZIP, khong ket noi may chu ma nguon).');
    return;
  }

  const hasGit = await checkCommand('git');
  if (!hasGit) {
    log('warn', 'Chua cai Git-for-Windows (phan mem lenh "git") — bo qua tai ban moi tu internet.');
    log('info', 'Git-for-Windows tai: https://git-scm.com/download/win — khac GitHub (website luu code).');
    return;
  }

  log('step', 'Kiem tra ban moi tu may chu ma nguon (GitHub) — lenh git fetch...');

  try {
    await execAsync('git fetch origin', {
      cwd: PROJECT_DIR,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    log('warn', 'Khong fetch duoc origin (offline hoac loi mang?). Tiep tuc chay app.');
    return;
  }

  try {
    const { stdout: porcelain } = await execAsync('git status --porcelain', {
      cwd: PROJECT_DIR,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });

    if ((porcelain || '').trim()) {
      log('warn', 'Ban co file thay doi chua commit/luu — BO QUA lenh git pull (tranhs mat ban sua).');
      log('info', 'Muon tai ban moi tu GitHub: commit hoac hoan tac roi chay lai 01_BAT_DAU.');
      return;
    }

    const { stdout: branchOut } = await execAsync('git rev-parse --abbrev-ref HEAD', {
      cwd: PROJECT_DIR,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    const branch = (branchOut || '').trim();
    if (!branch || branch === 'HEAD') {
      log('warn', 'Detached HEAD - bo qua pull.');
      return;
    }

    let nBehind = 0;
    try {
      const { stdout: cnt } = await execAsync(`git rev-list --count HEAD..origin/${branch}`, {
        cwd: PROJECT_DIR,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
      nBehind = parseInt((cnt || '').trim(), 10) || 0;
    } catch {
      log('warn', `Khong so sanh duoc voi origin/${branch} - bo qua pull.`);
      return;
    }

    if (nBehind === 0) {
      log('ok', `Da la ban moi nhat (nhanh ${branch}).`);
      return;
    }

    log('info', `Phat hien ${nBehind} commit moi tren may chu — dang git pull...`);
    await runCommand('git', ['pull', '--no-edit', 'origin', branch], { silent: false });
    log('ok', 'Da tai code moi tu may chu (vi du GitHub) bang lenh git.');
  } catch (e) {
    log('warn', `Dong bo bang git khong thanh cong: ${e.message}`);
    log('info', 'Ban van co the chay app - kiem tra conflict hoac mang.');
  }
}

async function installDependencies() {
  // Táº¡o logs directory
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);
  
  // CÃ i npm packages
  if (!fs.existsSync(path.join(PROJECT_DIR, 'node_modules'))) {
    log('step', 'Dang cai Node.js packages (lan dau)...');
    log('warn', 'Qua trinh nay co the mat 3-5 phut...');
    try {
      await runCommand('npm', ['install'], { silent: false });
      log('ok', 'Node.js packages da san sang');
    } catch (e) {
      log('err', 'npm install that bai!');
      log('info', 'Thu: npm install --registry https://registry.npmmirror.com');
      return false;
    }
  } else {
    log('ok', 'Node.js packages da co san');
  }
  
  // CÃ i Python packages
  if (fs.existsSync(path.join(PROJECT_DIR, 'requirements.txt'))) {
    log('step', 'Dang cai Python packages...');
    try {
      await runCommand('python', ['-m', 'pip', 'install', '-r', 'requirements.txt'], { silent: false, ignoreError: true });
      log('ok', 'Python packages da san sang');
    } catch (e) {
      log('warn', 'Co loi khi cai Python packages (co the bo qua)');
    }
  }
  
  return true;
}

function startService(name, cmd, args, readyCheck = null) {
  return new Promise((resolve) => {
    log('step', `Khoi dong ${name}...`);
    
    const child = spawn(cmd, args, {
      cwd: PROJECT_DIR,
      shell: true,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });
    
    child.on('error', (err) => {
      log('err', `${name} loi: ${err.message}`);
    });
    
    // Äá»£i má»™t chÃºt Ä‘á»ƒ service khá»Ÿi Ä‘á»™ng
    setTimeout(() => {
      log('ok', `${name} da khoi dong`);
      resolve(child);
    }, 3000);
  });
}


function ensureEnvTokens() {
  let envContent = '';
  let modified = false;

  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf8');
  } else if (fs.existsSync(ENV_EXAMPLE_PATH)) {
    envContent = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');
    log('warn', 'Khong tim thay .env, se tao tu .env.example');
  } else {
    log('warn', 'Khong tim thay .env va .env.example, se tao .env moi');
  }

  // INTERNAL_TOKEN: không tự sinh — để trống hoặc bỏ dòng = runner (/run) không cần header x-internal-token.
  const tokenRegex = /^INTERNAL_TOKEN=(.*)$/m;
  const tokenMatch = envContent.match(tokenRegex);
  const token = tokenMatch ? (tokenMatch[1] || '').trim() : '';

  // Ensure NEXTAUTH_SECRET
  const secretRegex = /^NEXTAUTH_SECRET=(.*)$/m;
  const secretMatch = envContent.match(secretRegex);
  const existingSecret = secretMatch ? (secretMatch[1] || '').trim() : '';
  let secret = existingSecret;

  if (!secret) {
    secret = `omnisuite_${crypto.randomBytes(32).toString('hex')}`;
    if (secretMatch) {
      envContent = envContent.replace(secretRegex, `NEXTAUTH_SECRET=${secret}`);
    } else {
      if (envContent.length && !envContent.endsWith('\n')) envContent += '\n';
      envContent += `NEXTAUTH_SECRET=${secret}\n`;
    }
    modified = true;
  }

  // Ensure NEXTAUTH_URL for stable NextAuth client/server fetch behavior
  const nextAuthUrlRegex = /^NEXTAUTH_URL=(.*)$/m;
  const nextAuthUrlMatch = envContent.match(nextAuthUrlRegex);
  const existingNextAuthUrl = nextAuthUrlMatch ? (nextAuthUrlMatch[1] || '').trim() : '';
  const defaultNextAuthUrl = 'http://localhost:3000';

  if (!existingNextAuthUrl) {
    if (nextAuthUrlMatch) {
      envContent = envContent.replace(nextAuthUrlRegex, `NEXTAUTH_URL=${defaultNextAuthUrl}`);
    } else {
      if (envContent.length && !envContent.endsWith('\n')) envContent += '\n';
      envContent += `NEXTAUTH_URL=${defaultNextAuthUrl}\n`;
    }
    modified = true;
  }

  if (modified || !fs.existsSync(ENV_PATH)) {
    fs.writeFileSync(ENV_PATH, envContent, 'utf8');
    log('ok', 'Da tao/cap nhat .env (NEXTAUTH_URL / NEXTAUTH_SECRET). INTERNAL_TOKEN: dat trong .env neu muon khoa runner.');
  }

  process.env.INTERNAL_TOKEN = token;
  process.env.NEXTAUTH_SECRET = secret;
  process.env.NEXTAUTH_URL = existingNextAuthUrl || defaultNextAuthUrl;
}
async function main() {
  console.clear();
  console.log(`${colors.bold}${colors.cyan}`);
  console.log('========================================');
  console.log('   OMNISUITE AI - LAUNCHER');
  console.log('========================================');
  console.log(`${colors.reset}`);
  
  // 1. Kiá»ƒm tra mÃ´i trÆ°á»ng
  const envOk = await ensureDependencies();
  if (!envOk) {
    console.log('\nNhan Enter de thoat...');
    await new Promise(r => process.stdin.once('data', r));
    process.exit(1);
  }

  // 1b. Tu dong tai ban moi tu may chu ma nguon (vd GitHub) neu co .git + Git-for-Windows + khong file sua doi
  await trySyncGitUpdates();

  // 2. CÃ i Ä‘áº·t dependencies
  const depsOk = await installDependencies();
  if (!depsOk) {
    console.log('\nNhan Enter de thoat...');
    await new Promise(r => process.stdin.once('data', r));
    process.exit(1);
  }

  ensureEnvTokens();

  // 2b. Kiem tra Ollama (tuy chon - khong chan luong khoi dong)
  await probeOllama();

  // 3. Khá»Ÿi Ä‘á»™ng cÃ¡c services
  console.log('\n');
  log('info', 'Dang khoi dong he thong...');
  
  const services = [];
  
  // Service 1: Python Interpreter (port 8081)
  services.push(await startService(
    'Python Backend (8081)',
    'node',
    ['scripts/start-backend.js']
  ));
  
  // Service 2: Python Engine (port 8082)
  services.push(await startService(
    'Python Engine (8082)',
    'python',
    ['-m', 'uvicorn', 'python_engine.main:app', '--host', '127.0.0.1', '--port', '8082', '--reload']
  ));
  
  // Service 3: Next.js Frontend (port 3000)
  services.push(await startService(
    'Next.js Frontend (3000)',
    'node',
    ['--dns-result-order=ipv4first', 'node_modules/next/dist/bin/next', 'dev']
  ));
  
  // Má»Ÿ trÃ¬nh duyá»‡t sau 10 giÃ¢y
  setTimeout(() => {
    log('info', 'Mo trinh duyet...');
    exec('start http://localhost:3000');
  }, 10000);
  
  // Hiá»ƒn thá»‹ thÃ´ng tin
  console.log('\n');
  console.log(`${colors.green}${colors.bold}`);
  console.log('========================================');
  console.log('   SERVER DANG CHAY!');
  console.log('   URL: http://localhost:3000');
  console.log('========================================');
  console.log(`${colors.reset}`);
  console.log('\nNhan Ctrl+C de dung tat ca services\n');
  
  // Xá»­ lÃ½ dá»«ng graceful + giáº£i phÃ³ng VRAM Ollama
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('warn', '\nDang dung cac services va giai phong VRAM Ollama...');
    try {
      await unloadOllamaModelsBestEffort();
    } catch (_) { /* ignore */ }
    services.forEach(s => {
      try { s.kill(); } catch(e) {}
    });
    setTimeout(() => process.exit(0), 2000);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  // Giá»¯ process sá»‘ng
  await new Promise(() => {});
}

main().catch(err => {
  log('err', `Loi khong mong muon: ${err.message}`);
  process.exit(1);
});

