/**
 * Next.js dev with IPv4-first DNS and localhost bind when OMNISUITE_LOCALHOST_ONLY=1.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.join(__dirname, '..');
const ENV_PATH = path.join(PROJECT_DIR, '.env');

function readEnvFlag(name, defaultOn = true) {
  if (process.env[name] !== undefined) {
    const v = String(process.env[name]).trim().toLowerCase();
    return v !== '0' && v !== 'false' && v !== 'no';
  }
  try {
    if (!fs.existsSync(ENV_PATH)) return defaultOn;
    const content = fs.readFileSync(ENV_PATH, 'utf8');
    const m = content.match(new RegExp(`^${name}=(.*)$`, 'm'));
    if (!m) return defaultOn;
    const v = (m[1] || '').trim().toLowerCase();
    return v !== '0' && v !== 'false' && v !== 'no';
  } catch {
    return defaultOn;
  }
}

const localhostOnly = readEnvFlag('OMNISUITE_LOCALHOST_ONLY', true);
const nextBin = path.join(PROJECT_DIR, 'node_modules', 'next', 'dist', 'bin', 'next');
const args = ['--dns-result-order=ipv4first', nextBin, 'dev', '--webpack'];
if (localhostOnly) args.push('-H', '127.0.0.1');

const child = spawn(process.execPath, args, {
  cwd: PROJECT_DIR,
  stdio: 'inherit',
  env: process.env,
  shell: false,
});

child.on('exit', (code) => process.exit(code ?? 0));
