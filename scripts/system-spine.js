#!/usr/bin/env node
/**
 * OmniSuite System Spine
 *
 * One shared place for runtime contract, entrypoints, dependency signatures,
 * local cache roots, and service startup metadata. Launchers and doctors should
 * read from here instead of each carrying their own copy of the system skeleton.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  resolvePythonExecutable,
  pythonEnvPatch,
  localPythonPackagesDir,
  localPlaywrightBrowsersDir,
} = require('./resolve-python');

const ROOT = process.env.OMNISUITE_ROOT || path.join(__dirname, '..');
const CONTRACT_PATH = path.join(ROOT, 'config', 'omnisuite.system.json');
const RUNTIME_DIR = path.join(ROOT, '.omnisuite');
const RUNTIME_PATH = path.join(RUNTIME_DIR, 'contract-runtime.json');

const DEFAULT_SIGNATURE_FILES = [
  'package-lock.json',
  'package.json',
  'requirements.txt',
  'python_engine/requirements.txt',
  'services/clip_service/requirements.txt',
  'config/omnisuite.system.json',
];

const DEFAULT_NODE_MODULES = ['next', 'playwright'];
const DEFAULT_PYTHON_MODULES = ['fastapi', 'uvicorn', 'flask', 'httpx', 'bs4', 'playwright'];

function readJson(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return { ...fallback, _readError: error && error.message ? error.message : String(error) };
  }
}

function readContract(fallback = {}) {
  return readJson(CONTRACT_PATH, fallback);
}

function runtimeDirs() {
  return {
    runtime: RUNTIME_DIR,
    pythonPackages: localPythonPackagesDir(),
    pipCache: path.join(RUNTIME_DIR, 'cache', 'pip'),
    torchCache: path.join(RUNTIME_DIR, 'cache', 'torch'),
    huggingfaceCache: path.join(RUNTIME_DIR, 'cache', 'huggingface'),
    playwrightBrowsers: localPlaywrightBrowsersDir(),
    puppeteerCache: path.join(RUNTIME_DIR, 'cache', 'puppeteer'),
    data: path.join(RUNTIME_DIR, 'data'),
    state: path.join(RUNTIME_DIR, 'state'),
  };
}

function ensureRuntimeDirs() {
  for (const dir of Object.values(runtimeDirs())) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function setupConfig(contract = readContract()) {
  return contract.setup || {};
}

function signatureFiles(contract = readContract()) {
  return setupConfig(contract).signatureFiles || DEFAULT_SIGNATURE_FILES;
}

function requiredNodeModules(contract = readContract()) {
  return setupConfig(contract).requiredNodeModules || DEFAULT_NODE_MODULES;
}

function requiredPythonModules(contract = readContract()) {
  return setupConfig(contract).requiredPythonModules || DEFAULT_PYTHON_MODULES;
}

function entrypoints(contract = readContract()) {
  const out = { ...(contract.entrypoints || {}) };
  for (const [key, value] of Object.entries(contract.bigUpdate?.entrypoints || {})) {
    out[`bigUpdate.${key}`] = value;
  }
  return out;
}

function fileHash(rel) {
  const filePath = path.join(ROOT, rel);
  if (!fs.existsSync(filePath)) return '';
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').slice(0, 16);
}

function dependencySignature(contract = readContract()) {
  return signatureFiles(contract).map(fileHash).join(':');
}

function runnableServices(contract = readContract()) {
  const services = Array.isArray(contract.services) ? contract.services : [];
  return services
    .filter((svc) => !svc.managedBy && svc.command)
    .map((svc) => ({
      ...svc,
      command: svc.command === 'python' ? resolvePythonExecutable() : svc.command,
      args: Array.isArray(svc.args) ? svc.args : [],
      port: svc.port || null,
      label: svc.label || svc.id || svc.command,
    }));
}

function buildRuntimeSnapshot(contract = readContract(), extra = {}) {
  const services = Array.isArray(contract.services) ? contract.services : [];
  return {
    spineVersion: contract.bigUpdate?.version || '1',
    contractPath: CONTRACT_PATH,
    contractVersion: contract.version || 1,
    dashboardUrl: contract.app?.dashboardUrl || 'http://localhost:3000',
    serviceIds: services.map((s) => s.id).filter(Boolean),
    requiredServices: services.filter((s) => s.required).map((s) => s.id).filter(Boolean),
    runnableServices: runnableServices(contract).map((s) => s.id || s.label),
    commands: contract.commands || {},
    entrypoints: entrypoints(contract),
    runtimeDirs: runtimeDirs(),
    dependencySignature: dependencySignature(contract),
    generatedAt: new Date().toISOString(),
    ...extra,
  };
}

function writeRuntimeSnapshot(contract = readContract(), extra = {}) {
  ensureRuntimeDirs();
  const snapshot = buildRuntimeSnapshot(contract, extra);
  fs.writeFileSync(RUNTIME_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
  return snapshot;
}

function contractEnv(contract = readContract(), extra = {}) {
  const env = {
    ...process.env,
    ...pythonEnvPatch(),
    ...extra,
    OMNISUITE_ROOT: ROOT,
    OMNISUITE_SYSTEM_CONFIG: CONTRACT_PATH,
    OMNISUITE_CONTRACT_RUNTIME: RUNTIME_PATH,
    OMNISUITE_DASHBOARD_URL: contract.app?.dashboardUrl || 'http://localhost:3000',
  };

  for (const [key, value] of Object.entries(contract.envDefaults || {})) {
    if (!env[key]) env[key] = String(value);
  }

  return env;
}

function printSummary(contract = readContract()) {
  console.log('[SPINE] Contract:', path.relative(ROOT, CONTRACT_PATH));
  console.log('[SPINE] Dashboard:', contract.app?.dashboardUrl || 'http://localhost:3000');
  console.log('[SPINE] Signature:', dependencySignature(contract));
  const services = runnableServices(contract);
  if (services.length) {
    console.log('[SPINE] Services:', services.map((s) => `${s.id || s.label}${s.port ? `:${s.port}` : ''}`).join(' | '));
  }
}

if (require.main === module) {
  const contract = readContract({});
  writeRuntimeSnapshot(contract);
  printSummary(contract);
}

module.exports = {
  ROOT,
  CONTRACT_PATH,
  RUNTIME_DIR,
  RUNTIME_PATH,
  readJson,
  readContract,
  runtimeDirs,
  ensureRuntimeDirs,
  signatureFiles,
  requiredNodeModules,
  requiredPythonModules,
  entrypoints,
  dependencySignature,
  runnableServices,
  buildRuntimeSnapshot,
  writeRuntimeSnapshot,
  contractEnv,
  printSummary,
};
