#!/usr/bin/env node
/**
 * Resilient Playwright browser installer for OmniSuite.
 *
 * Why this exists:
 * - Python runner setup used to call `python -m playwright install chromium` once.
 * - On flaky networks, antivirus locks, or half-written ms-playwright folders, that fails and
 *   leaves the user with a broken /run-browser setup.
 * - The main OmniSuite setup already has retry/cleanup/progress logic in setup-all-tools.js.
 *   This small CLI reuses it from PowerShell/Bash runner setup scripts.
 */

const fs = require('fs');
const path = require('path');

const {
  chromiumBrowserReady,
  installPlaywrightBrowsers,
  skipPlaywrightSetup,
} = require('./setup-all-tools');

function ensureSharedBrowsersPath() {
  if ((process.env.PLAYWRIGHT_BROWSERS_PATH || '').trim()) return;

  let base = '';
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    base = path.join(process.env.LOCALAPPDATA, 'ms-playwright');
  } else if (process.platform === 'darwin' && process.env.HOME) {
    base = path.join(process.env.HOME, 'Library', 'Caches', 'ms-playwright');
  } else if (process.env.HOME) {
    base = path.join(process.env.HOME, '.cache', 'ms-playwright');
  }

  if (base) {
    fs.mkdirSync(base, { recursive: true });
    process.env.PLAYWRIGHT_BROWSERS_PATH = base;
  }
}

function log(type, msg) {
  const prefix = type === 'ok' ? '[OK]' : type === 'warn' ? '[CANH BAO]' : type === 'err' ? '[LOI]' : '[*]';
  console.log(`${prefix} ${msg}`);
}

function printFallbackHint() {
  log('warn', 'Khong cai duoc Playwright Chromium/headless shell. Day thuong la loi mang, proxy, antivirus hoac thu muc ms-playwright bi khoa.');
  log('info', 'Thu chay lai: npm run setup:repair -- --only=maps');
  log('info', 'Neu mang chan tai, co the dat PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH toi Chrome/Edge co san roi chay lai.');
  if (process.platform === 'win32') {
    log('info', 'Vi du PowerShell: $env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"');
  }
}

async function main() {
  ensureSharedBrowsersPath();

  if (skipPlaywrightSetup()) {
    log('info', 'Bo qua Playwright vi OMNISUITE_SKIP_PLAYWRIGHT=1.');
    return;
  }

  if (chromiumBrowserReady()) {
    log('ok', 'Playwright Chromium/headless shell da san sang.');
    return;
  }

  const ok = await installPlaywrightBrowsers(log);
  if (!ok || !chromiumBrowserReady()) {
    printFallbackHint();
    process.exitCode = 1;
    return;
  }

  log('ok', 'Playwright Chromium/headless shell san sang.');
}

main().catch((err) => {
  log('err', err && err.message ? err.message : String(err));
  printFallbackHint();
  process.exit(1);
});
