/**
 * Tu dong cai dat / cap nhat moi thu OmniSuite can khi khoi dong.
 * Goi tu launcher.js — khong can chay tay npm/pip/playwright.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolvePythonExecutable, pythonEnvPatch } = require('./resolve-python');

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

function getPythonCmd() {
  return resolvePythonExecutable();
}

function skipPlaywrightSetup() {
  const v = (process.env.OMNISUITE_SKIP_PLAYWRIGHT || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

const PLAYWRIGHT_BROWSERS_JSON = path.join(
  PROJECT_DIR,
  'node_modules',
  'playwright-core',
  'browsers.json',
);

function msPlaywrightBase() {
  const explicit = (process.env.PLAYWRIGHT_BROWSERS_PATH || '').trim();
  if (explicit) return explicit;
  return process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'ms-playwright') : '';
}

function readPlaywrightRevisions() {
  try {
    const data = JSON.parse(fs.readFileSync(PLAYWRIGHT_BROWSERS_JSON, 'utf8'));
    const rev = (name) => data.browsers.find((b) => b.name === name)?.revision;
    return { chromium: rev('chromium'), headlessShell: rev('chromium-headless-shell') };
  } catch {
    return { chromium: null, headlessShell: null };
  }
}

function browserFolderName(browserName, revision) {
  return `${browserName.replace(/-/g, '_')}-${revision}`;
}

function fileIsExecutable(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/** Duong dan chrome-headless-shell theo Playwright 1.59+ (headless: true). */
function headlessShellExecutableCandidates(base, revision) {
  const dir = path.join(base, browserFolderName('chromium-headless-shell', revision));
  if (process.platform === 'win32') {
    return [path.join(dir, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')];
  }
  if (process.platform === 'darwin') {
    return [
      path.join(dir, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'),
      path.join(dir, 'chrome-headless-shell-mac-x64', 'chrome-headless-shell'),
    ];
  }
  return [path.join(dir, 'chrome-headless-shell-linux64', 'chrome-headless-shell')];
}

function chromiumHeadlessShellReady(base) {
  const { headlessShell } = readPlaywrightRevisions();
  if (headlessShell && headlessShellExecutableCandidates(base, headlessShell).some(fileIsExecutable)) {
    return true;
  }
  try {
    for (const name of fs.readdirSync(base)) {
      const m = /^chromium_headless_shell-(\d+)$/.exec(name);
      if (!m) continue;
      if (headlessShellExecutableCandidates(base, m[1]).some(fileIsExecutable)) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Node + Python Playwright dung chung %LOCALAPPDATA%\\ms-playwright.
 * Playwright 1.59+: chromium.launch({ headless: true }) can chromium-headless-shell,
 * khong chi thu muc chromium-* (full browser).
 */
function chromiumBrowserReady() {
  if (skipPlaywrightSetup()) return true;
  const base = msPlaywrightBase();
  if (!base || !fs.existsSync(base)) return false;
  return chromiumHeadlessShellReady(base);
}

function runCommand(cmd, args, options = {}) {
  const isShellRequired = process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx');
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: PROJECT_DIR,
      shell: isShellRequired,
      stdio: options.silent ? 'pipe' : 'inherit',
      env: pythonEnvPatch(),
    });
    child.on('close', (code) => {
      if (code === 0 || options.ignoreError) resolve(code);
      else reject(new Error(`${cmd} exited ${code}`));
    });
    child.on('error', reject);
  });
}

const MS_PLAYWRIGHT_DIR = msPlaywrightBase;

/** Playwright 1.59+ headless: true chi can headless shell (~90MB), khong can full chromium (~300MB). */
const PLAYWRIGHT_BROWSER_TARGETS = ['chromium-headless-shell'];
const PLAYWRIGHT_INSTALL_TIMEOUT_MS = 10 * 60 * 1000;
const PLAYWRIGHT_STALL_MS = 90 * 1000;
const PLAYWRIGHT_HEADLESS_SHELL_TARGET_BYTES = 95 * 1024 * 1024;

let msPlaywrightBytesCache = { at: 0, value: 0 };

function playwrightCliEnv() {
  const base = msPlaywrightBase();
  const env = {
    ...pythonEnvPatch(),
    PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT: '180000',
  };
  if (base) {
    env.PLAYWRIGHT_BROWSERS_PATH = base;
    try {
      fs.mkdirSync(base, { recursive: true });
    } catch {
      /* ignore */
    }
  }
  return env;
}

function fullChromiumExecutable(base, revision) {
  return path.join(base, browserFolderName('chromium', revision), 'chrome-win64', 'chrome.exe');
}

function isHeadlessShellFolderComplete(base, revision) {
  return headlessShellExecutableCandidates(base, revision).some(fileIsExecutable);
}

/** Xoa khoa / thu muc cai dat do neu Playwright bi treo giua chung. */
function preparePlaywrightInstall(logFn, { aggressive = false } = {}) {
  const base = msPlaywrightBase();
  if (!base) return;

  msPlaywrightBytesCache = { at: 0, value: 0 };

  const lockPath = path.join(base, '__dirlock');
  if (fs.existsSync(lockPath)) {
    let removeLock = aggressive;
    if (!removeLock) {
      try {
        const ageMs = Date.now() - fs.statSync(lockPath).mtimeMs;
        removeLock = ageMs > 2 * 60 * 1000;
      } catch {
        removeLock = true;
      }
    }
    if (removeLock) {
      try {
        fs.unlinkSync(lockPath);
        logFn('warn', '  Da xoa khoa Playwright (__dirlock) — lan cai truoc co the bi treo.');
      } catch {
        logFn('warn', '  Khong xoa duoc __dirlock — dong moi cua so Playwright dang chay roi thu lai.');
      }
    }
  }

  if (!fs.existsSync(base)) return;

  const { chromium, headlessShell } = readPlaywrightRevisions();
  let removed = false;

  try {
    for (const name of fs.readdirSync(base)) {
      const folderPath = path.join(base, name);
      if (!fs.statSync(folderPath).isDirectory()) continue;

      const headlessMatch = /^chromium_headless_shell-(\d+)$/.exec(name);
      if (headlessMatch) {
        if (!isHeadlessShellFolderComplete(base, headlessMatch[1])) {
          fs.rmSync(folderPath, { recursive: true, force: true });
          logFn('warn', `  Da xoa cai dat loi: ${name}`);
          removed = true;
        }
        continue;
      }

      const chromiumMatch = /^chromium-(\d+)$/.exec(name);
      if (chromiumMatch) {
        const rev = chromiumMatch[1];
        const complete = fileIsExecutable(fullChromiumExecutable(base, rev));
        if (!complete || aggressive) {
          fs.rmSync(folderPath, { recursive: true, force: true });
          logFn(
            'warn',
            complete
              ? `  Da xoa Chromium day du (chi can headless shell): ${name}`
              : `  Da xoa Chromium day du chua xong: ${name}`,
          );
          removed = true;
        }
      }
    }
  } catch (e) {
    logFn('warn', `  Don thu muc ms-playwright: ${e.message}`);
  }

  if (removed) msPlaywrightBytesCache = { at: 0, value: 0 };

  if (headlessShell && !isHeadlessShellFolderComplete(base, headlessShell) && aggressive) {
    const partial = path.join(base, browserFolderName('chromium-headless-shell', headlessShell));
    if (fs.existsSync(partial)) {
      try {
        fs.rmSync(partial, { recursive: true, force: true });
        logFn('warn', `  Da xoa headless shell do de cai lai: ${path.basename(partial)}`);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Uoc luong dung luong ms-playwright (tai + giai nen). */
function msPlaywrightBytes() {
  const base = MS_PLAYWRIGHT_DIR();
  if (!base || !fs.existsSync(base)) return 0;

  function walk(dir) {
    let total = 0;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      try {
        if (ent.isDirectory()) total += walk(full);
        else total += fs.statSync(full).size;
      } catch {
        /* locked / partial write */
      }
    }
    return total;
  }

  try {
    return walk(base);
  } catch {
    return 0;
  }
}

function msPlaywrightBytesCached() {
  const now = Date.now();
  if (now - msPlaywrightBytesCache.at < 4000) return msPlaywrightBytesCache.value;
  const value = msPlaywrightBytes();
  msPlaywrightBytesCache = { at: now, value };
  return value;
}

/** Playwright co the tai nhieu goi — % co the reset. */
function createPlaywrightProgressTracker() {
  let downloadPct = 0;
  let packageIndex = 1;
  let prevDownloadPct = 0;
  let extractStartedAt = 0;

  return {
    noteOutput(text) {
      if (/downloaded to|Giai nen|extracting|unpack/i.test(text)) {
        if (!extractStartedAt) extractStartedAt = Date.now();
      }
      for (const m of text.matchAll(/(\d{1,3})%/g)) {
        const pct = Number(m[1]);
        if (Number.isNaN(pct) || pct < 0 || pct > 100) continue;
        if (pct < prevDownloadPct - 15 && prevDownloadPct >= 80) packageIndex += 1;
        prevDownloadPct = pct;
        downloadPct = pct;
      }
      if (downloadPct >= 100 && !extractStartedAt) extractStartedAt = Date.now();
    },
    markExtractPhase() {
      if (!extractStartedAt) extractStartedAt = Date.now();
    },
    snapshot() {
      if (chromiumBrowserReady()) {
        return { overallPct: 100, label: 'Hoan tat' };
      }

      const bytes = msPlaywrightBytesCached();
      const extractTarget = PLAYWRIGHT_HEADLESS_SHELL_TARGET_BYTES;
      const extractPct = bytes > 0 ? Math.min(99, Math.round((bytes / extractTarget) * 100)) : 0;
      const extractAgeSec = extractStartedAt ? (Date.now() - extractStartedAt) / 1000 : 0;
      // Playwright giai nen vao thu muc tam — ms-playwright chi tang khi gan xong.
      const timeExtractPct = extractStartedAt ? Math.min(44, Math.floor(extractAgeSec / 4)) : 0;
      const blendedExtractPct = Math.max(extractPct, timeExtractPct);

      if (downloadPct > 0 && downloadPct < 100) {
        const overallPct = Math.max(1, Math.round(downloadPct * 0.55));
        return {
          overallPct,
          label: `Dang tai goi ${packageIndex} (${downloadPct}%)`,
        };
      }

      if (downloadPct >= 100 || bytes > 2 * 1024 * 1024 || extractStartedAt) {
        const overallPct = Math.min(99, 55 + blendedExtractPct);
        const mb = (bytes / (1024 * 1024)).toFixed(1);
        return {
          overallPct,
          label:
            downloadPct >= 100 || extractStartedAt
              ? `Giai nen / cai driver (${mb} MB trong ms-playwright${timeExtractPct > extractPct ? ' — dang giai nen tam' : ''})`
              : 'Dang chuan bi giai nen',
        };
      }

      return {
        overallPct: Math.max(1, Math.round(extractPct * 0.4)),
        label: 'Bat dau tai chromium-headless-shell',
      };
    },
  };
}

/** Chay lenh, doc % tu stdout/stderr Playwright va van hien log goc. */
function runCommandWithPlaywrightProgress(cmd, args, tracker, options = {}) {
  const isShellRequired = process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx');
  const timeoutMs = options.timeoutMs ?? PLAYWRIGHT_INSTALL_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: PROJECT_DIR,
      shell: isShellRequired,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: playwrightCliEnv(),
    });

    let settled = false;
    const finish = (err, code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearInterval(stallTimer);
      if (err) reject(err);
      else if (code === 0 || options.ignoreError) resolve(code);
      else reject(new Error(`${cmd} exited ${code}`));
    };

    const relay = (chunk, stream) => {
      tracker.noteOutput(chunk.toString());
      stream.write(chunk);
    };

    child.stdout.on('data', (chunk) => relay(chunk, process.stdout));
    child.stderr.on('data', (chunk) => relay(chunk, process.stderr));

    child.on('close', (code) => finish(null, code));
    child.on('error', (err) => finish(err));

    const timeout = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      finish(new Error(`Playwright install qua ${Math.round(timeoutMs / 60000)} phut — huy va thu lai`));
    }, timeoutMs);

    let lastBytes = msPlaywrightBytesCached();
    let lastGrowthAt = Date.now();
    const stallTimer = setInterval(() => {
      const bytes = msPlaywrightBytesCached();
      if (bytes > lastBytes + 512 * 1024) {
        lastBytes = bytes;
        lastGrowthAt = Date.now();
        return;
      }
      if (chromiumBrowserReady()) {
        finish(null, 0);
        return;
      }
      if (Date.now() - lastGrowthAt >= PLAYWRIGHT_STALL_MS) {
        tracker.markExtractPhase();
        try {
          child.kill('SIGTERM');
        } catch {
          /* ignore */
        }
        finish(new Error('Playwright khong ghi them file sau 90s — co the antivirus/lock treo cai dat'));
      }
    }, 15000);
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

/** Playwright: hien % tong (tai + giai nen) moi ~3s. */
async function runPlaywrightInstall(cmd, args, logFn) {
  const tracker = createPlaywrightProgressTracker();
  let sec = 0;
  const spinner = ['|', '/', '-', '\\'];
  const timer = setInterval(() => {
    sec += 3;
    const { overallPct, label } = tracker.snapshot();
    const spin = spinner[Math.floor(sec / 3) % spinner.length];
    logFn('info', `  ${spin} ${overallPct}% — ${label} (${sec}s)`);
  }, 3000);

  try {
    await runCommandWithPlaywrightProgress(cmd, args, tracker, { ignoreError: true });
  } catch (e) {
    throw e;
  } finally {
    clearInterval(timer);
    msPlaywrightBytesCache = { at: 0, value: 0 };
    const { overallPct } = tracker.snapshot();
    if (overallPct >= 100) logFn('info', '  100% — Playwright headless shell san sang');
  }
}

/** Cai chromium-headless-shell (Playwright 1.59+ headless: true). */
async function installPlaywrightBrowsers(logFn) {
  if (chromiumBrowserReady()) return true;

  preparePlaywrightInstall(logFn);

  const runTarget = async (target, force) => {
    const args = ['playwright', 'install', target];
    if (force) args.push('--force');
    logFn('info', `  Lenh: npx ${args.join(' ')}`);
    await runPlaywrightInstall('npx', args, logFn);
    return chromiumBrowserReady();
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const force = attempt > 1;
    if (force) {
      logFn('warn', '  Thu lai Playwright (lan 2) — don file loi va --force...');
      preparePlaywrightInstall(logFn, { aggressive: true });
    }

    for (const target of PLAYWRIGHT_BROWSER_TARGETS) {
      try {
        if (await runTarget(target, force)) return true;
      } catch (e) {
        logFn('warn', `  ${target}: ${e.message}`);
        preparePlaywrightInstall(logFn, { aggressive: true });
      }
    }
  }

  const py = getPythonCmd();
  try {
    await runCommand(py, ['-c', 'import playwright'], { silent: true });
  } catch {
    return chromiumBrowserReady();
  }

  logFn('step', '  Thu cai Playwright qua Python...');
  for (let attempt = 1; attempt <= 2; attempt++) {
    const force = attempt > 1;
    if (force) preparePlaywrightInstall(logFn, { aggressive: true });
    for (const target of PLAYWRIGHT_BROWSER_TARGETS) {
      const args = ['-m', 'playwright', 'install', target];
      if (force) args.push('--force');
      try {
        await runPlaywrightInstall(py, args, logFn);
        if (chromiumBrowserReady()) return true;
      } catch (e) {
        logFn('warn', `  Python ${target}: ${e.message}`);
      }
    }
  }

  return chromiumBrowserReady();
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

function saveSetupState(playwrightOk, verifyResult = {}) {
  fs.mkdirSync(GUARD_DIR, { recursive: true });
  const lockHash = fileHash(path.join(PROJECT_DIR, 'package-lock.json'));
  const reqHashes = PIP_REQS.map((r) => fileHash(path.join(PROJECT_DIR, r.rel))).join('|');
  fs.writeFileSync(
    path.join(GUARD_DIR, 'setup-state.json'),
    JSON.stringify(
      {
        depsBundle: `${lockHash}:${reqHashes}`,
        playwrightOk: !!playwrightOk,
        imagesReady: !!verifyResult.imagesReady,
        mapsReady: !!verifyResult.mapsReady,
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
    logFn('step', 'Buoc 4/5: Playwright — chromium-headless-shell (~90MB, che do headless)');
    logFn('info', '  % cap nhat moi 3s — neu dung >90s tai 56%, script tu don lock va thu lai.');
    try {
      playwrightOk = await installPlaywrightBrowsers(logFn);
      if (playwrightOk) logFn('ok', '  Playwright headless shell — xong');
      else logFn('warn', '  Headless shell chua san sang — thu: npm run setup:repair');
    } catch (e) {
      playwrightOk = false;
      logFn('warn', `  Playwright: ${e.message}`);
    }
  } else {
    logFn('ok', 'Buoc 4/5: Playwright headless shell da co — bo qua');
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

  let verifyResult = { imagesReady: false, mapsReady: playwrightOk, ok: true };
  try {
    const { verifyAndRepair } = require('./verify-and-repair');
    verifyResult = await verifyAndRepair({ repair: true, log: logFn });
    if (!verifyResult.mapsReady && playwrightOk) verifyResult.mapsReady = true;
  } catch (e) {
    logFn('warn', `Kiem tra/sua loi sau cai dat: ${e.message}`);
  }

  saveSetupState(playwrightOk, verifyResult);

  if (!verifyResult.imagesReady) {
    logFn('warn', 'Tim hinh anh: Loi AI (port 8000) chua san sang — thu lai sau khi torch tai xong hoac chay lai 01_START.');
  } else {
    logFn('ok', 'Tim hinh anh: Loi AI san sang');
  }
  if (!verifyResult.mapsReady) {
    logFn('warn', 'Quet ban do: Thieu Chromium Playwright — chay lai 01_START hoac npm run setup:repair');
  } else {
    logFn('ok', 'Quet ban do: Playwright san sang');
  }

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

module.exports = {
  runFullSetup,
  chromiumBrowserReady,
  getPythonCmd,
  skipPlaywrightSetup,
  runPlaywrightInstall,
  installPlaywrightBrowsers,
  preparePlaywrightInstall,
};
