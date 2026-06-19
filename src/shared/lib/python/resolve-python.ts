import fs from 'fs';
import path from 'path';

/** Keep in sync with scripts/resolve-python.js */
const RUNTIME_JSON = path.join(process.cwd(), '.omnisuite', 'runtime.json');

function omnisuiteDir(root = process.cwd()) {
  return path.join(root, '.omnisuite');
}

export function localPythonPackagesDir(root = process.cwd()): string {
  return path.join(omnisuiteDir(root), 'python-packages');
}

export function localPlaywrightBrowsersDir(root = process.cwd()): string {
  return path.join(omnisuiteDir(root), 'ms-playwright');
}

function absolutizeMaybe(root: string, value: string | undefined): string | undefined {
  const raw = (value || '').trim();
  if (!raw) return undefined;
  return path.isAbsolute(raw) ? raw : path.join(root, raw);
}

function prependPathList(current: string | undefined, entries: string[]): string {
  const existing = (current || '')
    .split(path.delimiter)
    .map((p) => p.trim())
    .filter(Boolean);
  const next: string[] = [];
  for (const entry of entries) {
    if (entry && !next.includes(entry)) next.push(entry);
  }
  for (const entry of existing) {
    if (entry && !next.includes(entry)) next.push(entry);
  }
  return next.join(path.delimiter);
}

function readRuntimeJson(): {
  bundledPython?: string;
  fullPython?: string;
  prefer?: 'bundled' | 'full';
} | null {
  try {
    if (!fs.existsSync(RUNTIME_JSON)) return null;
    return JSON.parse(fs.readFileSync(RUNTIME_JSON, 'utf8'));
  } catch {
    return null;
  }
}

function bundledPythonWin(root: string) {
  return path.join(root, '.omnisuite', 'python', 'python.exe');
}

function bundledPythonUnix(root: string) {
  return path.join(root, '.omnisuite', 'python', 'bin', 'python3');
}

/**
 * Prefer PYTHON_BIN → runtime.json (full/bundled) → .omnisuite/python → python/python3.
 */
export function resolvePythonExecutable(): string {
  const root = process.cwd();
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
    const bundled = bundledPythonWin(root);
    if (fs.existsSync(bundled)) return bundled;
    return 'python';
  }

  const bundledU = bundledPythonUnix(root);
  if (fs.existsSync(bundledU)) return bundledU;
  return 'python3';
}

export function pythonEnvPatch(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const root = process.cwd();
  const cacheDir = path.join(omnisuiteDir(root), 'cache');
  const patch: NodeJS.ProcessEnv = {
    ...process.env,
    ...extra,
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
  };

  patch.PYTHONPATH = prependPathList(patch.PYTHONPATH, [localPythonPackagesDir(root)]);
  patch.PIP_CACHE_DIR = absolutizeMaybe(root, patch.PIP_CACHE_DIR) || path.join(cacheDir, 'pip');
  patch.TORCH_HOME = absolutizeMaybe(root, patch.TORCH_HOME) || path.join(cacheDir, 'torch');
  patch.HF_HOME = absolutizeMaybe(root, patch.HF_HOME) || path.join(cacheDir, 'huggingface');
  patch.HUGGINGFACE_HUB_CACHE =
    absolutizeMaybe(root, patch.HUGGINGFACE_HUB_CACHE) || path.join(cacheDir, 'huggingface', 'hub');
  patch.TRANSFORMERS_CACHE =
    absolutizeMaybe(root, patch.TRANSFORMERS_CACHE) || path.join(cacheDir, 'huggingface', 'transformers');
  patch.PLAYWRIGHT_BROWSERS_PATH =
    absolutizeMaybe(root, patch.PLAYWRIGHT_BROWSERS_PATH) || localPlaywrightBrowsersDir(root);
  patch.PUPPETEER_CACHE_DIR =
    absolutizeMaybe(root, patch.PUPPETEER_CACHE_DIR) || path.join(cacheDir, 'puppeteer');
  patch.XDG_CACHE_HOME = absolutizeMaybe(root, patch.XDG_CACHE_HOME) || cacheDir;

  const py = resolvePythonExecutable();
  if (process.platform === 'win32' && py.includes(path.sep)) {
    const dir = path.dirname(py);
    const scripts = path.join(dir, 'Scripts');
    const mergedPath = [dir, scripts, patch.Path || patch.PATH || ''].filter(Boolean).join(';');
    patch.Path = mergedPath;
    patch.PATH = mergedPath;
  }

  return patch;
}
