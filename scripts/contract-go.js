#!/usr/bin/env node
/**
 * Contract-aware GO bridge.
 *
 * This small wrapper reads config/omnisuite.system.json first, exports a few stable
 * runtime variables, writes a tiny runtime snapshot, then delegates to the existing
 * quick launcher. It gives the project one shared runtime contract without replacing
 * the battle-tested launcher in one risky edit.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTRACT_PATH = path.join(ROOT, 'config', 'omnisuite.system.json');
const RUNTIME_DIR = path.join(ROOT, '.omnisuite');
const RUNTIME_PATH = path.join(RUNTIME_DIR, 'contract-runtime.json');
const QUICK_LAUNCHER = path.join(ROOT, 'scripts', 'quick-launcher.js');

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return { ...fallback, _readError: error && error.message ? error.message : String(error) };
  }
}

function writeRuntime(contract) {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const services = Array.isArray(contract.services) ? contract.services : [];
  fs.writeFileSync(
    RUNTIME_PATH,
    JSON.stringify(
      {
        contractPath: CONTRACT_PATH,
        contractVersion: contract.version || 1,
        dashboardUrl: contract.app?.dashboardUrl || 'http://localhost:3000',
        serviceIds: services.map((s) => s.id).filter(Boolean),
        requiredServices: services.filter((s) => s.required).map((s) => s.id).filter(Boolean),
        commands: contract.commands || {},
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );
}

function printContractSummary(contract) {
  const services = Array.isArray(contract.services) ? contract.services : [];
  console.log('[GO] Contract:', path.relative(ROOT, CONTRACT_PATH));
  console.log('[GO] Dashboard:', contract.app?.dashboardUrl || 'http://localhost:3000');
  if (services.length) {
    const line = services
      .map((s) => `${s.id || s.label}${s.port ? `:${s.port}` : ''}${s.required ? '*' : ''}`)
      .join(' | ');
    console.log('[GO] Services:', line);
  }
}

function main() {
  const fallback = {
    version: 1,
    app: { dashboardUrl: 'http://localhost:3000' },
    services: [],
    envDefaults: {},
    commands: {},
  };
  const contract = readJson(CONTRACT_PATH, fallback);
  if (contract._readError) {
    console.warn('[GO] Khong doc duoc system contract:', contract._readError);
  }

  writeRuntime(contract);
  printContractSummary(contract);

  const env = {
    ...process.env,
    OMNISUITE_ROOT: ROOT,
    OMNISUITE_SYSTEM_CONFIG: CONTRACT_PATH,
    OMNISUITE_CONTRACT_RUNTIME: RUNTIME_PATH,
    OMNISUITE_DASHBOARD_URL: contract.app?.dashboardUrl || 'http://localhost:3000',
  };

  for (const [key, value] of Object.entries(contract.envDefaults || {})) {
    if (!env[key]) env[key] = String(value);
  }

  const child = spawn(process.execPath, [QUICK_LAUNCHER, ...process.argv.slice(2)], {
    cwd: ROOT,
    stdio: 'inherit',
    env,
  });

  child.on('close', (code) => process.exit(code ?? 0));
  child.on('error', (error) => {
    console.error('[GO] Khong khoi dong duoc quick launcher:', error.message);
    process.exit(1);
  });
}

main();
