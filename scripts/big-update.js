#!/usr/bin/env node
/**
 * Big Update runner for the OmniSuite system skeleton.
 *
 * This does not start the app. It refreshes the central runtime snapshot,
 * runs the contract doctor, and can repair runtime dependencies when called
 * with --repair.
 */

const { runRuntimeDoctor } = require('./doctor-runtime');
const {
  ensureRuntimeDirs,
  printSummary,
  readContract,
  writeRuntimeSnapshot,
} = require('./system-spine');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(type, message) {
  const prefix = type === 'ok' ? '[OK]' : type === 'err' ? '[LOI]' : type === 'warn' ? '[CANH BAO]' : '[*]';
  const color = type === 'ok' ? colors.green : type === 'err' ? colors.red : type === 'warn' ? colors.yellow : colors.cyan;
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

async function main() {
  const repair = process.argv.includes('--repair');
  console.log(`${colors.bold}${colors.cyan}========================================`);
  console.log('   OMNISUITE BIG UPDATE - SYSTEM SPINE');
  console.log(`========================================${colors.reset}`);

  ensureRuntimeDirs();
  const contract = readContract({});
  const snapshot = writeRuntimeSnapshot(contract, { bigUpdateRanAt: new Date().toISOString() });
  printSummary(contract);
  log('ok', `Runtime snapshot: ${snapshot.spineVersion}`);

  const doctor = runRuntimeDoctor({ log });
  if (!doctor.ok) {
    log('err', 'Doctor phat hien loi khung he thong. Xem .omnisuite/doctor-report.json');
    process.exit(1);
  }

  if (!repair) {
    log('ok', 'Big Update check xong. Neu can tu sua dependency, bam lai 01_START_OMNISUITE.bat.');
    return;
  }

  log('step', 'Dang tu sua dependency/runtime theo contract...');
  const { verifyAndRepair } = require('./verify-and-repair');
  const result = await verifyAndRepair({ repair: true, only: 'all', log });
  if (result.ok) {
    log('ok', 'Big Update repair xong.');
    return;
  }

  log('warn', `Repair con can xem lai: ${(result.errors || []).join('; ') || 'unknown'}`);
}

main().catch((error) => {
  log('err', error && error.message ? error.message : String(error));
  process.exit(1);
});
