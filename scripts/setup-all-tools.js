/**
 * Tu dong cai dat / cap nhat moi thu OmniSuite can khi khoi dong.
 * Goi tu launcher.js — khong can chay tay npm/pip/playwright.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_DIR = process.env.OMNISUITE_ROOT || path.join(__dirname, '..');
const GUARD_DIR = path.join(PROJECT_DIR, '.omnisuite');

const PIP_REQS = [
  { rel: 'python_engine/requirements.txt', label: 'Python engine (8082)' },
  { rel: 'requirements.txt', label: 'Interpreter + shared (8081)' },
  { rel: 'services/clip_service/requirements.txt', label: 'Image CLIP (8000)', heavy: true },
];

const PYTHON_CHECKS = [
  { mod: 'uvicorn', label: 'uvicorn (8082)' },
  { mod: 'flask', label: 'flask (8081)' },
  { mod: 'fastapi', label: 'fastapi' },
];

/** Python trong .omnisuite (cung pip da cai) — tranh import check sai interpreter. */
function getPythonCmd() {
  const local = path.join(PROJECT_DIR, '.omnisuite', 'python', 'python.exe');
  if (fs.existsSync(local)) return local;
  return 'python';
}

function skipPlaywrightSetup() {
  const v = (process.env.OMNISUITE_SKIP_PLAYWRIGHT || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Node + Python Playwright dung chung %LOCALAPPDATA%\\ms-playwright */
function chromiumBrowserReady() {
  if (skipPlaywrightSetup()) return true;
  const base = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'ms-playwright')
    : '';
  if (!base || !fs.existsSync(base)) return false;
  try {
    return fs.readdirSync(base).some((name) => /^chromium/i.test(name));
  } catch {
    return false;
  }
}

function runCommand(cmd, args, options = {}) {
  const isShellRequired = process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx');
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: PROJECT_DIR,
      shell: isShellRequired,
      stdio: options.silent ? 'pipe' : 'inherit',
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    });
    child.on('close', (code) => {
      if (code === 0 || options.ignoreError) resolve(code);
      else reject(new Error(`${cmd} exited ${code}`));
    });
    child.on('error', reject);
  });
}

/** Nhac nguoi dung moi ~6s khi lenh lau ma it log (tranh tuong may treo). */
async function runWithWaitIndicator(promise, logFn, hints) {
  const lines = Array.isArray(hints) ? hints : [hints];
  let i = 0;
  let sec = 0;
  const spinner = ['|', '/', '-', '\\'];
  const timer = setInterval(() => {
    sec += 6;
    const hint = lines[i % lines.length];
    const spin = spinner[Math.floor(sec / 6) % spinner.length];
    i += 1;
    logFn('info', `  ${spin} Van dang chay (${sec}s) — ${hint}`);
  }, 6000);
  try {
    return await promise;
  } finally {
    clearInterval(timer);
  }
}

function fileHash(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').slice(0, 16);
}

function needsPlaywrightReinstall() {
  if (skipPlaywrightSetup()) return false;
  if (chromiumBrowserReady()) return false;

  const marker = path.join(GUARD_DIR, 'setup-state.json');
  const lockHash = fileHash(path.join(PROJECT_DIR, 'package-lock.json'));
  const reqHashes = PIP_REQS.map((r) => fileHash(path.join(PROJECT_DIR, r.rel))).join('|');
  const bundle = `${lockHash}:${reqHashes}`;
  try {
    const prev = JSON.parse(fs.readFileSync(marker, 'utf8'));
    if (prev.depsBundle === bundle && prev.playwrightOk) return false;
  } catch {
    /* first run */
  }
  return true;
}

function saveSetupState(playwrightOk) {
  fs.mkdirSync(GUARD_DIR, { recursive: true });
  const lockHash = fileHash(path.join(PROJECT_DIR, 'package-lock.json'));
  const reqHashes = PIP_REQS.map((r) => fileHash(path.join(PROJECT_DIR, r.rel))).join('|');
  fs.writeFileSync(
    path.join(GUARD_DIR, 'setup-state.json'),
    JSON.stringify(
      {
        depsBundle: `${lockHash}:${reqHashes}`,
        playwrightOk: !!playwrightOk,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );
}

async function pythonCanImport(moduleName) {
  try {
    await runCommand(getPythonCmd(), ['-c', `import ${moduleName}`], { silent: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {(type: string, msg: string) => void} log
 */
async function runFullSetup(log = () => {}) {
  const logFn = (type, msg) => log(type, msg);
  const py = getPythonCmd();

  if (!fs.existsSync(LOGS_DIR())) fs.mkdirSync(LOGS_DIR(), { recursive: true });

  logFn('info', 'Neu man hinh "dung im" lau — xem dong [*] ... Van dang chay (may KHONG bi treo).');

  logFn('step', 'Buoc 1/5: Node.js — npm install (Next.js, Playwright, Puppeteer...)');
  try {
    const npmArgs = fs.existsSync(path.join(PROJECT_DIR, 'node_modules'))
      ? ['install', '--prefer-offline', '--no-audit', '--no-fund']
      : ['install', '--no-audit', '--no-fund'];
    await runWithWaitIndicator(runCommand('npm', npmArgs, { silent: false }), logFn, [
      'Dang tai/cap nhat goi npm',
      'Lan dau co the 2-5 phut — khong tat cua so',
    ]);
    logFn('ok', 'Node.js packages san sang');
  } catch (e) {
    logFn('err', `npm install that bai: ${e.message}`);
    logFn('info', 'Thu: npm install --registry https://registry.npmmirror.com');
    return false;
  }

  logFn('step', 'Buoc 2/5: Python — pip install requirements (8081/8082/8000)');
  try {
    await runCommand(py, ['-m', 'pip', 'install', '-q', '--upgrade', 'pip', 'wheel'], {
      silent: true,
      ignoreError: true,
    });
  } catch {
    /* ignore */
  }

  for (const { rel, label, heavy } of PIP_REQS) {
    const reqPath = path.join(PROJECT_DIR, rel);
    if (!fs.existsSync(reqPath)) {
      logFn('warn', `Bo qua ${label} — khong co ${rel}`);
      continue;
    }
    if (heavy) {
      logFn('warn', `${label}: torch/transformers ~2GB — lan dau co the 10-20 phut (may van chay binh thuong).`);
    }
    logFn('step', `  pip: ${label}...`);
    try {
      const pipArgs = heavy
        ? ['-m', 'pip', 'install', '-r', rel]
        : ['-m', 'pip', 'install', '-q', '-r', rel];
      const pipRun = runCommand(py, pipArgs, { silent: heavy ? false : true, ignoreError: true });
      if (heavy) {
        await runWithWaitIndicator(pipRun, logFn, [
          'Dang tai torch/transformers (goi lon)',
          'Pip co the it log — cho them',
          'Antivirus quet file moi co them 1-2 phut',
        ]);
      } else {
        await pipRun;
      }
      logFn('ok', `  ${label} — xong`);
    } catch (e) {
      logFn('warn', `  ${label} — loi: ${e.message}`);
    }
  }

  logFn('step', 'Buoc 3/5: Kiem tra module Python bat buoc');
  for (const { mod, label } of PYTHON_CHECKS) {
    const ok = await pythonCanImport(mod);
    if (ok) logFn('ok', `  import ${label}`);
    else {
      logFn('warn', `  Thieu ${label} — thu cai lai requirements.txt`);
      try {
        await runCommand(py, ['-m', 'pip', 'install', '-q', '-r', 'requirements.txt'], {
          ignoreError: true,
        });
      } catch {
        /* ignore */
      }
    }
  }

  let playwrightOk = chromiumBrowserReady();
  const installBrowsers = needsPlaywrightReinstall();

  if (skipPlaywrightSetup()) {
    logFn('info', 'Buoc 4/5: Bo qua Playwright (OMNISUITE_SKIP_PLAYWRIGHT=1)');
    playwrightOk = true;
  } else if (installBrowsers) {
    logFn('step', 'Buoc 4/5: Playwright Chromium — tai trinh duyet automation');
    logFn('info', '  Sau khi hien 100%%, co the im lang 2-8 phut — dang giai nen / cai them thanh phan.');
    try {
      await runWithWaitIndicator(
        runCommand('npx', ['playwright', 'install', 'chromium'], { ignoreError: true }),
        logFn,
        [
          'Playwright: dang giai nen Chromium sau khi tai xong',
          'Khong tat cua so CMD — may van dang xu ly',
          'Co the tai them headless shell / driver',
        ],
      );
      playwrightOk = chromiumBrowserReady();
      if (playwrightOk) logFn('ok', '  Playwright (Node) chromium — xong');
      else logFn('warn', '  Chromium chua thay trong ms-playwright — thu buoc Python...');
    } catch (e) {
      playwrightOk = false;
      logFn('warn', `  Playwright Node: ${e.message}`);
    }
    if (!playwrightOk) {
      logFn('step', '  pip/playwright: cai Chromium cho Python...');
      try {
        await runWithWaitIndicator(
          runCommand(py, ['-m', 'playwright', 'install', 'chromium'], { ignoreError: true }),
          logFn,
          ['Playwright Python: dang tai hoac giai nen trinh duyet', 'Cho them vai phut neu man hinh im'],
        );
        playwrightOk = chromiumBrowserReady();
        if (playwrightOk) logFn('ok', '  Playwright (Python) chromium — xong');
      } catch {
        logFn('warn', '  Playwright Python: bo qua (co the chua cai playwright trong pip)');
      }
    } else {
      logFn('info', '  Bo qua cai Python lan 2 — Chromium da co trong ms-playwright');
    }
  } else {
    logFn('ok', 'Buoc 4/5: Playwright Chromium da co — bo qua');
  }

  logFn('step', 'Buoc 5/5: Git security hooks (neu co .git)');
  if (fs.existsSync(path.join(PROJECT_DIR, '.git'))) {
    try {
      await runCommand('node', ['scripts/install-git-hooks.js'], { silent: true, ignoreError: true });
      logFn('ok', '  Git hooks: pre-commit/pre-push chan API key len GitHub');
    } catch {
      logFn('info', '  Chay tay: npm run security:install-hooks');
    }
  }

  saveSetupState(playwrightOk);
  return true;
}

function LOGS_DIR() {
  return path.join(PROJECT_DIR, 'logs');
}

if (require.main === module) {
  const colors = { reset: '\x1b[0m', green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m' };
  const log = (type, msg) => {
    const p = type === 'ok' ? '[OK]' : type === 'err' ? '[LOI]' : type === 'warn' ? '[CANH BAO]' : '[*]';
    console.log(`${p} ${msg}`);
  };
  runFullSetup(log)
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { runFullSetup };
