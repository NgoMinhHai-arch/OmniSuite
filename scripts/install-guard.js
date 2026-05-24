/**
 * Install guard — chống sao chép GitHub trái phép, nhúng monorepo chồng chéo, chạy sai thư mục.
 * Goi tu launcher.js / npm run security:guard
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { execSync } = require('child_process');

const PROJECT_DIR = path.resolve(process.env.OMNISUITE_ROOT || process.cwd());
const GUARD_DIR = path.join(PROJECT_DIR, '.omnisuite');
const LOCK_PATH = path.join(GUARD_DIR, 'machine.lock');

function readEnvBool(name, defaultValue = false) {
  const raw = process.env[name] || readEnvFromFile(name);
  if (raw === undefined || raw === '') return defaultValue;
  return raw === '1' || raw.toLowerCase() === 'true';
}

function machineHash() {
  const seed = [os.hostname(), os.userInfo().username, os.platform(), os.arch()].join('|');
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 32);
}

function readEnvFromFile(name) {
  const envPath = path.join(PROJECT_DIR, '.env');
  if (!fs.existsSync(envPath)) return '';
  const content = fs.readFileSync(envPath, 'utf8');
  const re = new RegExp(`^${name}=(.*)$`, 'm');
  const m = content.match(re);
  if (!m) return '';
  let v = (m[1] || '').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

function getGitRemoteUrl() {
  try {
    const gitDir = path.join(PROJECT_DIR, '.git');
    if (!fs.existsSync(gitDir)) return null;
    return execSync('git remote get-url origin', {
      cwd: PROJECT_DIR,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function detectNestedIntegration() {
  if (readEnvBool('OMNISUITE_INTEGRATION_ALLOW')) return null;

  let dir = path.dirname(PROJECT_DIR);
  for (let depth = 0; depth < 5; depth++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'omnisuite-ai' && path.resolve(dir) !== PROJECT_DIR) {
          return dir;
        }
      } catch {
        /* ignore */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function loadLock() {
  if (!fs.existsSync(LOCK_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveLock(data) {
  fs.mkdirSync(GUARD_DIR, { recursive: true });
  fs.writeFileSync(LOCK_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function fail(code, message) {
  console.error('\n========================================');
  console.error('   OMNISUITE — CHAN BAO MAT');
  console.error('========================================');
  console.error(message);
  console.error('========================================\n');
  process.exit(code);
}

function assertInstallGuard() {
  const antiClone = readEnvBool('OMNISUITE_ANTI_CLONE', true);
  const strict = readEnvBool('OMNISUITE_STRICT_SECURITY', true);
  const remote = getGitRemoteUrl();
  const nestedParent = detectNestedIntegration();
  const mHash = machineHash();
  let lock = loadLock();

  if (nestedParent) {
    fail(
      2,
      [
        'Phat hien nhung OmniSuite vao monorepo/du an khac:',
        `  Thu muc cha: ${nestedParent}`,
        'De cho phep nhung co chu y, dat trong .env:',
        '  OMNISUITE_INTEGRATION_ALLOW=1',
        'Khuyen nghi: chay OmniSuite o thu muc goc rieng, khong embed chong cheo.',
      ].join('\n'),
    );
  }

  if (antiClone && remote && !lock) {
    fail(
      3,
      [
        'Ban sao chep tu Git remote khong duoc kich hoat tren may nay.',
        `  Remote: ${remote}`,
        'Day la co che chong clone/tich hop trai phep.',
        'Neu ban la chu du an hop le:',
        '  1) Copy file .omnisuite/machine.lock tu ban cai dat goc (KHONG commit len GitHub), hoac',
        '  2) Dat OMNISUITE_ANTI_CLONE=0 trong .env chi tren may dev tin cay.',
      ].join('\n'),
    );
  }

  const installSecret = process.env.OMNISUITE_INSTALL_SECRET || readEnvFromFile('OMNISUITE_INSTALL_SECRET');

  if (!lock) {
    const secret = installSecret || crypto.randomBytes(24).toString('hex');
    lock = {
      version: 1,
      rootPath: PROJECT_DIR,
      machineHash: mHash,
      installSecretHash: crypto.createHash('sha256').update(secret).digest('hex'),
      createdAt: new Date().toISOString(),
      gitRemote: remote || null,
    };
    saveLock(lock);
    if (!installSecret) {
      console.log('[INFO] Da tao .omnisuite/machine.lock — KHONG commit file nay len GitHub.');
    }
    return { ok: true, lock, strict };
  }

  if (path.resolve(lock.rootPath) !== PROJECT_DIR) {
    fail(
      4,
      [
        'Thu muc cai dat da bi di chuyen hoac sao chep sai:',
        `  Goc dang ky: ${lock.rootPath}`,
        `  Hien tai:     ${PROJECT_DIR}`,
        'Chay lai tu thu muc goc hoac xoa .omnisuite/machine.lock de kich hoat lai (chi tren may chu).',
      ].join('\n'),
    );
  }

  if (lock.machineHash && lock.machineHash !== mHash) {
    fail(
      5,
      [
        'Co che chong chay tren may khac: machine.lock khong khop may hien tai.',
        'Neu ban chuyen may hop le, xoa .omnisuite/machine.lock va kich hoat lai (chi chu du an).',
      ].join('\n'),
    );
  }

  if (installSecret && lock.installSecretHash) {
    const h = crypto.createHash('sha256').update(installSecret).digest('hex');
    if (h !== lock.installSecretHash) {
      fail(6, 'OMNISUITE_INSTALL_SECRET khong khop ban cai dat da dang ky.');
    }
  }

  return { ok: true, lock, strict };
}

if (require.main === module) {
  assertInstallGuard();
  console.log('[OK] Install guard passed.');
}

module.exports = { assertInstallGuard, machineHash, LOCK_PATH, PROJECT_DIR };
