const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { scanTextForSecrets } = require('./lib/security-patterns');

const MODE_STAGED = process.argv.includes('--staged');
const MODE_GITHUB = process.argv.includes('--github-push');

const BLOCKED_TRACKED_PATHS = [
  /^\.env$/i,
  /^\.env\./i,
  /^\.omnisuite\//i,
  /(^|\/)machine\.lock$/i,
  /keyword_cache.*\.json$/i,
];

function runGit(command) {
  return execSync(command, { encoding: 'utf8' });
}

function listTrackedFiles() {
  try {
    const raw = runGit('git ls-files -z');
    return raw.split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

function listStagedFiles() {
  try {
    const raw = runGit('git diff --cached --name-only -z --diff-filter=ACMRTUXB');
    return raw.split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

function shouldSkipContentScan(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return (
    /(^|\/)\.env\.example$/i.test(normalized) ||
    /(^|\/)\.env\.sample$/i.test(normalized) ||
    /(^|\/)(__tests__|test|tests|fixtures?)\//i.test(normalized) ||
    /\.(png|jpg|jpeg|gif|webp|svg|ico|pdf|lock|exe|bin|zip)$/i.test(normalized)
  );
}

function isBlockedTrackedPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (/(^|\/)\.env\.example$/i.test(normalized) || /(^|\/)\.env\.sample$/i.test(normalized)) {
    return false;
  }
  return BLOCKED_TRACKED_PATHS.some((re) => re.test(normalized));
}

function scanContent(filePath, content) {
  if (shouldSkipContentScan(filePath)) return [];
  return scanTextForSecrets(filePath, content);
}

function scanTrackedFiles(files) {
  const findings = [];
  for (const file of files) {
    if (isBlockedTrackedPath(file)) {
      findings.push(`${file}: FILE NHAY CAM — khong duoc commit len GitHub (.env / .omnisuite / cache key)`);
      continue;
    }
    try {
      const content = fs.readFileSync(file, 'utf8');
      findings.push(...scanContent(file, content));
    } catch {
      /* ignore unreadable */
    }
  }
  return findings;
}

function scanStagedDiff() {
  const stagedFiles = listStagedFiles();
  const findings = [];

  for (const file of stagedFiles) {
    if (isBlockedTrackedPath(file)) {
      findings.push(`${file}: FILE NHAY CAM — khong duoc commit len GitHub`);
      continue;
    }
    if (shouldSkipContentScan(file)) continue;
    let patch = '';
    try {
      patch = runGit(`git diff --cached -U0 -- "${file}"`);
    } catch {
      continue;
    }
    const addedLines = patch
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .map((line) => line.slice(1))
      .join('\n');
    if (!addedLines.trim()) continue;
    findings.push(...scanContent(`${file} (staged)`, addedLines));
  }

  return findings;
}

function printGithubLeakAlert(findings) {
  console.error('\n╔══════════════════════════════════════════════════════════════╗');
  console.error('║  CANH BAO BAO MAT — KHONG DUOC DUA API KEY LEN GITHUB       ║');
  console.error('╚══════════════════════════════════════════════════════════════╝\n');
  console.error('Phat hien du lieu nhay cam co the bi LO khi push:');
  for (const f of findings) {
    console.error(`  • ${f}`);
  }
  console.error('\nViec can lam NGAY:');
  console.error('  1) Thu hoi (revoke) API key da lo tren console nha cung cap');
  console.error('  2) Go file khoi commit: git reset HEAD <file>  hoac  git restore --staged <file>');
  console.error('  3) Xoa key khoi lich su neu da push: git filter-repo / BFG (hoac tao key moi)');
  console.error('  4) Chi luu key trong .env (da gitignore) va Settings localStorage\n');
  console.error('Push da bi CHAN. Chay lai: npm run security:scan\n');
}

function main() {
  let findings = [];

  try {
    findings = MODE_STAGED ? scanStagedDiff() : scanTrackedFiles(listTrackedFiles());
  } catch (e) {
    if (e.message && e.message.includes('not a git')) {
      console.log('Security scan: khong co git — bo qua (ban ZIP).');
      return;
    }
    throw e;
  }

  if (findings.length > 0) {
    if (MODE_GITHUB || process.argv.includes('--pre-push')) {
      printGithubLeakAlert(findings);
    } else {
      console.error('Security scan failed. Potential secrets detected:\n');
      for (const finding of findings) {
        console.error(`- ${finding}`);
      }
    }
    process.exit(1);
  }

  console.log(
    MODE_STAGED
      ? 'Security scan passed for staged changes.'
      : 'Security scan passed (no obvious tracked secrets found).',
  );
}

main();
