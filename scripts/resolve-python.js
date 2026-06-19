/**
 * Shared Python resolution for launcher / setup / start-backend.
 * Keep in sync with src/shared/lib/python/resolve-python.ts
 */
const fs = require('fs');
const path = require('path');

const PROJECT_DIR = process.env.OMNISUITE_ROOT || path.join(__dirname, '..');
const RUNTIME_JSON = path.join(PROJECT_DIR, '.omnisuite', 'runtime.json');
const OMNISUITE_DIR = path.join(PROJECT_DIR, '.omnisuite');
const LOCAL_PACKAGES_DIR = path.join(OMNISUITE_DIR, 'python-packages');
const CACHE_DIR = path.join(OMNISUITE_DIR, 'cache');
const PLAYWRIGHT_DIR = path.join(OMNISUITE_DIR, 'ms-playwright');

function readRuntimeJson() {
  try {
    if (!fs.existsSync(RUNTIME_JSON)) return null;
    return JSON.parse(fs.readFileSync(RUNTIME_JSON, 'utf8'));
  } catch {
    return null;
  }
}

function bundledPythonWin() {
  return path.join(PROJECT_DIR, '.omnisuite', 'python', 'python.exe');
}

function bundledPythonUnix() {
  return path.join(PROJECT_DIR, '.omnisuite', 'python', 'bin', 'python3');
}

function localPythonPackagesDir() {
  return LOCAL_PACKAGES_DIR;
}

function localPlaywrightBrowsersDir() {
  return PLAYWRIGHT_DIR;
}

function ensureLocalRuntimeDirs() {
  for (const dir of [
    OMNISUITE_DIR,
    LOCAL_PACKAGES_DIR,
    CACHE_DIR,
    path.join(CACHE_DIR, 'pip'),
    path.join(CACHE_DIR, 'torch'),
    path.join(CACHE_DIR, 'huggingface'),
    path.join(CACHE_DIR, 'puppeteer'),
    PLAYWRIGHT_DIR,
  ]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
  }
}

function absolutizeMaybe(value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  return path.isAbsolute(raw) ? raw : path.join(PROJECT_DIR, raw);
}

function prependPathList(current, entries) {
  const sep = path.delimiter;
  const existing = String(current || '')
    .split(sep)
    .map((p) => p.trim())
    .filter(Boolean);
  const next = [];
  for (const entry of entries) {
    if (entry && !next.includes(entry)) next.push(entry);
  }
  for (const entry of existing) {
    if (entry && !next.includes(entry)) next.push(entry);
  }
  return next.join(sep);
}

function resolvePythonExecutable() {
  const envBin = (process.env.PYTHON_BIN || '').trim();
  if (envBin && fs.existsSync(envBin)) return envBin;

  const runtime = readRuntimeJson();
  if (runtime?.prefer === 'full' && runtime.fullPython && fs.existsSync(runtime.fullPython)) {
    return runtime.fullPython;
  }
  if (runtime?.prefer === 'bundled' && runtime.bundledPython && fs.existsSync(runtime.bundledPython)) {
    return runtime.bundledPython;
  }
  if (runtime?.fullPython && fs.existsSync(runtime.fullPython)) return runtime.fullPython;

  if (process.platform === 'win32') {
    const bundled = bundledPythonWin();
    if (fs.existsSync(bundled)) return bundled;
    return 'python';
  }

  const bundledU = bundledPythonUnix();
  if (fs.existsSync(bundledU)) return bundledU;
  return 'python3';
}

/** Prepend bundled/full Python dirs to PATH for child spawns. */
function pythonEnvPatch(extra = {}) {
  const py = resolvePythonExecutable();
  const patch = { ...process.env, ...extra, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };
  ensureLocalRuntimeDirs();

  patch.PYTHONPATH = prependPathList(patch.PYTHONPATH, [LOCAL_PACKAGES_DIR]);
  patch.PIP_CACHE_DIR = absolutizeMaybe(patch.PIP_CACHE_DIR || path.join(CACHE_DIR, 'pip'));
  patch.TORCH_HOME = absolutizeMaybe(patch.TORCH_HOME || path.join(CACHE_DIR, 'torch'));
  patch.HF_HOME = absolutizeMaybe(patch.HF_HOME || path.join(CACHE_DIR, 'huggingface'));
  patch.HUGGINGFACE_HUB_CACHE = absolutizeMaybe(
    patch.HUGGINGFACE_HUB_CACHE || path.join(CACHE_DIR, 'huggingface', 'hub'),
  );
  patch.TRANSFORMERS_CACHE = absolutizeMaybe(
    patch.TRANSFORMERS_CACHE || path.join(CACHE_DIR, 'huggingface', 'transformers'),
  );
  patch.PLAYWRIGHT_BROWSERS_PATH = absolutizeMaybe(patch.PLAYWRIGHT_BROWSERS_PATH || PLAYWRIGHT_DIR);
  patch.PUPPETEER_CACHE_DIR = absolutizeMaybe(patch.PUPPETEER_CACHE_DIR || path.join(CACHE_DIR, 'puppeteer'));
  patch.XDG_CACHE_HOME = absolutizeMaybe(patch.XDG_CACHE_HOME || CACHE_DIR);

  if (process.platform !== 'win32' || !py.includes(path.sep)) {
    return patch;
  }

  const dir = path.dirname(py);
  const scripts = path.join(dir, 'Scripts');
  const parts = [dir, scripts, patch.Path || patch.PATH || ''].filter(Boolean);
  const merged = parts.join(';');
  patch.Path = merged;
  patch.PATH = merged;
  return patch;
}

function writeRuntimeJson(partial) {
  const dir = path.dirname(RUNTIME_JSON);
  fs.mkdirSync(dir, { recursive: true });
  let prev = {};
  try {
    if (fs.existsSync(RUNTIME_JSON)) prev = JSON.parse(fs.readFileSync(RUNTIME_JSON, 'utf8'));
  } catch {
    /* ignore */
  }
  const next = {
    bundledPython: bundledPythonWin(),
    fullPython: prev.fullPython || null,
    prefer: prev.prefer || 'bundled',
    updatedAt: new Date().toISOString(),
    ...partial,
  };
  if (fs.existsSync(bundledPythonWin())) next.bundledPython = bundledPythonWin();
  fs.writeFileSync(RUNTIME_JSON, JSON.stringify(next, null, 2), 'utf8');
}

module.exports = {
  PROJECT_DIR,
  RUNTIME_JSON,
  resolvePythonExecutable,
  pythonEnvPatch,
  localPythonPackagesDir,
  localPlaywrightBrowsersDir,
  readRuntimeJson,
  writeRuntimeJson,
  bundledPythonWin,
};
