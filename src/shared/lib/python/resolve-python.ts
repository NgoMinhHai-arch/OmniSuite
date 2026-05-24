import fs from 'fs';
import path from 'path';

/** Keep in sync with scripts/resolve-python.js */
const RUNTIME_JSON = path.join(process.cwd(), '.omnisuite', 'runtime.json');

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
