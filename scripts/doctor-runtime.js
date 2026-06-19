#!/usr/bin/env node
/**
 * Lightweight runtime contract doctor.
 * It catches drift between click-to-run scripts, package scripts, system contract,
 * and Python requirements before the launcher starts services.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTRACT_PATH = path.join(ROOT, 'config', 'omnisuite.system.json');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const REPORT_PATH = path.join(ROOT, '.omnisuite', 'doctor-report.json');
const { entrypoints: readContractEntrypoints } = require('./system-spine');

function readJson(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return { ...fallback, _readError: error && error.message ? error.message : String(error) };
  }
}

function readText(rel) {
  const filePath = path.join(ROOT, rel);
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  } catch {
    return '';
  }
}

function hasRequirement(requirementsText, packageName) {
  const re = new RegExp(`^\\s*${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'im');
  return re.test(requirementsText);
}

function runRuntimeDoctor({ log = null } = {}) {
  const issues = [];
  const warnings = [];
  const contract = readJson(CONTRACT_PATH, {});
  const pkg = readJson(PACKAGE_PATH, {});

  const fail = (message) => issues.push(message);
  const warn = (message) => warnings.push(message);

  if (contract._readError) fail(`Khong doc duoc config/omnisuite.system.json: ${contract._readError}`);
  if (pkg._readError) fail(`Khong doc duoc package.json: ${pkg._readError}`);

  const signatureFiles = contract.setup?.signatureFiles || [];
  for (const rel of signatureFiles) {
    if (!fs.existsSync(path.join(ROOT, rel))) fail(`Contract tro toi file khong ton tai: ${rel}`);
  }

  const services = Array.isArray(contract.services) ? contract.services : [];
  for (const svc of services) {
    if (svc.managedBy) continue;
    if (!svc.command) fail(`Service thieu command: ${svc.id || svc.label || 'unknown'}`);
    if (Array.isArray(svc.args)) {
      for (const arg of svc.args) {
        if (typeof arg === 'string' && /^(scripts|python_engine|src)\//.test(arg.replace(/\\/g, '/'))) {
          const rel = arg.replace(/\\/g, path.sep);
          if (!fs.existsSync(path.join(ROOT, rel))) fail(`Service ${svc.id || svc.label} tro toi file khong ton tai: ${arg}`);
        }
      }
    }
  }

  const scripts = pkg.scripts || {};
  if (scripts.go !== 'node scripts/contract-go.js') warn('package.json script "go" khong tro ve scripts/contract-go.js');
  if (scripts.app !== 'node scripts/contract-go.js') warn('package.json script "app" khong tro ve scripts/contract-go.js');
  if (scripts.repair !== 'node scripts/contract-go.js --repair') warn('package.json script "repair" khong tro ve contract repair');

  for (const rel of ['01_START_OMNISUITE.bat', '02_STOP_OMNISUITE.bat', '03_UNINSTALL_OMNISUITE.bat', 'scripts/quick-launcher.js']) {
    if (!fs.existsSync(path.join(ROOT, rel))) fail(`Thieu file bam chay: ${rel}`);
  }

  for (const [name, rel] of Object.entries(readContractEntrypoints(contract))) {
    if (typeof rel === 'string' && !fs.existsSync(path.join(ROOT, rel))) {
      fail(`Entrypoint contract khong ton tai (${name}): ${rel}`);
    }
  }

  const pyReq = readText('python_engine/requirements.txt');
  for (const dep of ['fastapi', 'uvicorn', 'httpx', 'beautifulsoup4', 'playwright', 'pytrends', 'pandas', 'numpy', 'scikit-learn']) {
    if (!hasRequirement(pyReq, dep)) warn(`python_engine/requirements.txt thieu dependency keyword/runtime: ${dep}`);
  }

  const rootReq = readText('requirements.txt');
  if (!/^-r\s+python_engine\/requirements\.txt/im.test(rootReq)) {
    warn('requirements.txt khong include python_engine/requirements.txt');
  }

  const report = {
    ok: issues.length === 0,
    issues,
    warnings,
    checkedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  if (log) {
    for (const message of issues) log('err', `[doctor] ${message}`);
    for (const message of warnings) log('warn', `[doctor] ${message}`);
    if (!issues.length && !warnings.length) log('ok', 'Doctor: contract/runtime dong bo.');
  }

  return report;
}

if (require.main === module) {
  const report = runRuntimeDoctor({
    log(type, message) {
      const prefix = type === 'err' ? '[LOI]' : type === 'warn' ? '[CANH BAO]' : '[OK]';
      console.log(`${prefix} ${message}`);
    },
  });
  process.exit(report.ok ? 0 : 1);
}

module.exports = { runRuntimeDoctor };
