#!/usr/bin/env node
/**
 * Contract-aware Start bridge.
 *
 * This small wrapper reads config/omnisuite.system.json first, exports a few stable
 * runtime variables, writes a tiny runtime snapshot, then delegates to the existing
 * quick launcher. It gives the project one shared runtime contract without replacing
 * the battle-tested launcher in one risky edit.
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTRACT_PATH = path.join(ROOT, 'config', 'omnisuite.system.json');
const QUICK_LAUNCHER = path.join(ROOT, 'scripts', 'quick-launcher.js');
const { runRuntimeDoctor } = require('./doctor-runtime');
const { contractEnv, readContract, writeRuntimeSnapshot } = require('./system-spine');

function printContractSummary(contract) {
  const services = Array.isArray(contract.services) ? contract.services : [];
  console.log('[START] Contract:', path.relative(ROOT, CONTRACT_PATH));
  console.log('[START] Dashboard:', contract.app?.dashboardUrl || 'http://localhost:3000');
  if (services.length) {
    const line = services
      .map((s) => `${s.id || s.label}${s.port ? `:${s.port}` : ''}${s.required ? '*' : ''}`)
      .join(' | ');
    console.log('[START] Services:', line);
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
  const contract = readContract(fallback);
  if (contract._readError) {
    console.warn('[START] Khong doc duoc system contract:', contract._readError);
  }

  writeRuntimeSnapshot(contract);
  printContractSummary(contract);
  const doctor = runRuntimeDoctor({
    log(type, message) {
      const prefix = type === 'err' ? '[START][LOI]' : type === 'warn' ? '[START][CANH BAO]' : '[START][OK]';
      console.log(`${prefix} ${message}`);
    },
  });
  if (!doctor.ok) {
    console.error('[START] Contract/runtime chua dong bo. Bam lai 01_START_OMNISUITE.bat sau khi xem loi tren.');
    process.exit(1);
  }

  const env = contractEnv(contract);

  const child = spawn(process.execPath, [QUICK_LAUNCHER, ...process.argv.slice(2)], {
    cwd: ROOT,
    stdio: 'inherit',
    env,
  });

  child.on('close', (code) => process.exit(code ?? 0));
  child.on('error', (error) => {
    console.error('[START] Khong khoi dong duoc quick launcher:', error.message);
    process.exit(1);
  });
}

main();
