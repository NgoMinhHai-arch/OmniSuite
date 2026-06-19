/**
 * Post-setup verification and auto-repair for Image (8000) and Maps (Playwright).
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PROJECT_DIR = process.env.OMNISUITE_ROOT || path.join(__dirname, '..');
const GUARD_DIR = path.join(PROJECT_DIR, '.omnisuite');
const NEEDS_FULL_PYTHON = path.join(GUARD_DIR, 'needs-full-python');

const {
  resolvePythonExecutable,
  pythonEnvPatch,
  localPythonPackagesDir,
  writeRuntimeJson,
} = require('./resolve-python');

const PIP_TARGETS = {
  flask: { req: 'requirements.txt', mod: 'flask' },
  clip: { req: 'services/clip_service/requirements.txt', mod: 'torch', also: ['uvicorn', 'fastapi'] },
  engine: { req: 'python_engine/requirements.txt', mod: 'uvicorn' },
  keywords: {
    req: 'python_engine/requirements.txt',
    mod: 'pytrends',
    also: ['httpx', 'bs4', 'playwright', 'pandas', 'numpy', 'sklearn'],
  },
};

function parseArgs(argv) {
  const repair = argv.includes('--repair');
  const quiet = argv.includes('--quiet');
  let only = 'all';
  for (const a of argv) {
    const m = /^--only=(.+)$/.exec(a);
    if (m) only = m[1];
  }
  return { repair, quiet, only };
}

function logMsg(log, type, msg) {
  if (log) log(type, msg);
  else if (!parseArgs(process.argv.slice(2)).quiet) {
    const p = type === 'ok' ? '[OK]' : type === 'err' ? '[LOI]' : type === 'warn' ? '[CANH BAO]' : '[*]';
    console.log(`${p} ${msg}`);
  }
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

function canImport(py, moduleName) {
  try {
    execSync(`"${py}" -c "import ${moduleName}"`, {
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

async function pipInstallReq(py, rel, log) {
  const reqPath = path.join(PROJECT_DIR, rel);
  if (!fs.existsSync(reqPath)) return false;
  logMsg(log, 'step', `  pip install -r ${rel}...`);
  try {
    fs.mkdirSync(localPythonPackagesDir(), { recursive: true });
    await runCommand(
      py,
      ['-m', 'pip', 'install', '--upgrade', '--target', localPythonPackagesDir(), '-r', rel],
      { ignoreError: false },
    );
    return true;
  } catch (e) {
    logMsg(log, 'warn', `  pip that bai: ${e.message}`);
    return false;
  }
}

function requestFullPythonFallback(log) {
  fs.mkdirSync(GUARD_DIR, { recursive: true });
  fs.writeFileSync(NEEDS_FULL_PYTHON, new Date().toISOString(), 'utf8');
  logMsg(log, 'step', 'Dat co hieu can Python day du (winget 3.12)...');
  try {
    const ps1 = path.join(__dirname, 'ensure-runtime.ps1');
    execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}" -InstallFullPython`,
      { cwd: PROJECT_DIR, stdio: 'inherit', windowsHide: true },
    );
    writeRuntimeJson({ prefer: 'full' });
    return true;
  } catch (e) {
    logMsg(log, 'warn', `Khong cai duoc Python winget: ${e.message}`);
    return false;
  }
}

async function repairPythonModules(scope, log) {
  const py = resolvePythonExecutable();
  const repairs = [];
  const errors = [];

  const scopes =
    scope === 'all'
      ? ['flask', 'engine', 'keywords', 'clip']
      : scope === 'clip'
        ? ['clip']
        : scope === 'flask'
          ? ['flask']
          : scope === 'keywords'
            ? ['keywords']
            : [scope];

  for (const key of scopes) {
    const target = PIP_TARGETS[key];
    if (!target) continue;
    if (!canImport(py, target.mod)) {
      const ok = await pipInstallReq(py, target.req, log);
      if (ok) repairs.push(`pip:${target.req}`);
      if (target.also) {
        for (const mod of target.also) {
          if (!canImport(py, mod)) {
            await pipInstallReq(py, target.req, log);
          }
        }
      }
      if (!canImport(py, target.mod) && key === 'clip') {
        requestFullPythonFallback(log);
        const py2 = resolvePythonExecutable();
        await pipInstallReq(py2, target.req, log);
      }
      if (!canImport(py, target.mod)) {
        errors.push(`Thieu module ${target.mod}`);
      }
    }
  }

  return { repairs, errors };
}

async function repairPlaywright(log) {
  const { chromiumBrowserReady, installPlaywrightBrowsers, skipPlaywrightSetup } = require('./setup-all-tools');
  if (skipPlaywrightSetup()) return true;
  if (chromiumBrowserReady()) return true;

  logMsg(log, 'step', 'Cai lai Playwright chromium-headless-shell...');
  try {
    return await installPlaywrightBrowsers((type, msg) => logMsg(log, type, msg));
  } catch (e) {
    logMsg(log, 'warn', `Playwright: ${e.message}`);
    return false;
  }
}

function fetchHealth(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (c) => {
        body += c;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ status: 'unknown' });
        }
      });
    });
    req.on('error', () => resolve({ status: 'stopped' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'stopped' });
    });
  });
}

async function waitClipHealth(log) {
  const sec = parseInt(process.env.OMNISUITE_CLIP_WARMUP_SEC || '90', 10);
  const attempts = Math.max(5, Math.ceil(sec / 3));
  const url = 'http://127.0.0.1:8000/api/v1/health';

  for (let i = 0; i < attempts; i++) {
    const data = await fetchHealth(url);
    if (data.status === 'ready' || data.status === 'ok') return true;
    if (data.status === 'error') {
      logMsg(log, 'warn', `CLIP health error: ${data.message || 'unknown'}`);
      return false;
    }
    logMsg(log, 'info', `  Cho Loi AI (CLIP)... (${(i + 1) * 3}/${attempts * 3}s)`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

/**
 * @param {{ repair?: boolean, only?: string, quiet?: boolean, log?: (type: string, msg: string) => void }} opts
 */
async function verifyAndRepair(opts = {}) {
  const log = opts.log || null;
  const repair = !!opts.repair;
  const only = opts.only || 'all';

  const result = {
    ok: true,
    imagesReady: false,
    mapsReady: false,
    repairs: [],
    errors: [],
  };

  const py = resolvePythonExecutable();
  const needClip = only === 'all' || only === 'clip';
  const needMaps = only === 'all' || only === 'maps';
  const needFlask = only === 'all' || only === 'flask';
  const needKeywords = only === 'all' || only === 'keywords';

  if (needFlask || only === 'all') {
    if (!canImport(py, 'flask')) {
      if (repair) {
        const r = await repairPythonModules('flask', log);
        result.repairs.push(...r.repairs);
        result.errors.push(...r.errors);
      } else {
        result.errors.push('Thieu flask (8081)');
      }
    }
  }

  if (needClip || only === 'engine') {
    const mods = ['uvicorn', 'fastapi', 'torch'];
    const missing = mods.filter((m) => !canImport(py, m));
    if (missing.length) {
      if (repair) {
        const r = await repairPythonModules('clip', log);
        result.repairs.push(...r.repairs);
        result.errors.push(...r.errors);
      } else {
        result.errors.push(`Thieu: ${missing.join(', ')}`);
      }
    }
  }

  if (needKeywords) {
    const missing = ['pytrends', 'playwright', 'bs4', 'httpx', 'pandas', 'sklearn'].filter(
      (m) => !canImport(py, m),
    );
    if (missing.length) {
      if (repair) {
        const r = await repairPythonModules('keywords', log);
        result.repairs.push(...r.repairs);
        result.errors.push(...r.errors);
      } else {
        result.errors.push(`Keyword tool thieu: ${missing.join(', ')}`);
      }
    }
  }

  if (needMaps) {
    const { chromiumBrowserReady } = require('./setup-all-tools');
    result.mapsReady = chromiumBrowserReady();
    if (!result.mapsReady && repair) {
      const ok = await repairPlaywright(log);
      result.mapsReady = ok;
      if (ok) result.repairs.push('playwright:chromium');
    }
  } else {
    const { chromiumBrowserReady } = require('./setup-all-tools');
    result.mapsReady = chromiumBrowserReady();
  }

  const pyAfter = resolvePythonExecutable();
  const torchOk = canImport(pyAfter, 'torch');
  const uvicornOk = canImport(pyAfter, 'uvicorn');

  if (needClip && torchOk && uvicornOk) {
    const healthNow = await fetchHealth('http://127.0.0.1:8000/api/v1/health');
    if (healthNow.status === 'ready' || healthNow.status === 'ok') {
      result.imagesReady = true;
    } else if (repair) {
      result.imagesReady = await waitClipHealth(log);
    }
  }

  if (!result.imagesReady && needClip && torchOk && uvicornOk) {
    result.errors.push('Port 8000 chua ready (CLIP dang nap hoac chua khoi dong)');
  }
  if (!torchOk && needClip) result.errors.push('Thieu torch — Loi AI chua san sang');
  if (!uvicornOk && needClip) result.errors.push('Thieu uvicorn — Loi AI chua san sang');

  result.ok = result.errors.length === 0 || (result.mapsReady && torchOk && uvicornOk);
  return result;
}

if (require.main === module) {
  const { repair, quiet, only } = parseArgs(process.argv.slice(2));
  verifyAndRepair({ repair, only, quiet })
    .then((r) => {
      if (!quiet) {
        console.log(JSON.stringify(r, null, 2));
      }
      const exitOk = r.imagesReady || r.mapsReady || only === 'maps' ? r.mapsReady : r.imagesReady;
      process.exit(exitOk || r.ok ? 0 : 1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { verifyAndRepair };
