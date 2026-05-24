/**
 * Shared Python resolution for launcher / setup / start-backend.
 * Keep in sync with src/shared/lib/python/resolve-python.ts
 */
const fs = require('fs');
const path = require('path');

const PROJECT_DIR = process.env.OMNISUITE_ROOT || path.join(__dirname, '..');
const RUNTIME_JSON = path.join(PROJECT_DIR, '.omnisuite', 'runtime.json');

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
  readRuntimeJson,
  writeRuntimeJson,
  bundledPythonWin,
};
