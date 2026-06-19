import fs from 'fs';
import path from 'path';
import { chromium, type Browser, type LaunchOptions } from 'playwright';
import { PLAYWRIGHT_HEADLESS, PLAYWRIGHT_LAUNCH_ARGS } from './config';
import { localPlaywrightBrowsersDir } from '@/shared/lib/python/resolve-python';

const CHROMIUM_EXECUTABLE_ENV_KEYS = [
  'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH',
  'CHROMIUM_EXECUTABLE_PATH',
  'CHROME_PATH',
  'OMNISUITE_CHROME_PATH',
];

export const PLAYWRIGHT_INSTALL_HINT_VI =
  'Bam lai 01_START_OMNISUITE.bat de tu cai Playwright Chromium. Neu mang chan tai, dat PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH toi chrome.exe/msedge.exe co san roi chay lai.';

function ensureBrowsersPath(): void {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH?.trim()) return;
  const base = localPlaywrightBrowsersDir();
  if (base && fs.existsSync(base)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = base;
  }
}

function normalizeExecutable(candidate: string | undefined): string | null {
  const p = (candidate || '').trim().replace(/^['"]|['"]$/g, '');
  if (!p) return null;
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile() ? p : null;
  } catch {
    return null;
  }
}

function defaultChromeCandidates(): string[] {
  if (process.platform === 'win32') {
    const roots = [process.env.LOCALAPPDATA, process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']].filter(Boolean) as string[];
    return roots.flatMap((root) => [
      path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]);
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
  ];
}

function resolveChromiumExecutablePath(): string | undefined {
  for (const key of CHROMIUM_EXECUTABLE_ENV_KEYS) {
    const p = normalizeExecutable(process.env[key]);
    if (p) return p;
  }
  for (const candidate of defaultChromeCandidates()) {
    const p = normalizeExecutable(candidate);
    if (p) return p;
  }
  return undefined;
}

export function formatPlaywrightLaunchError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/executable doesn't exist|browserType\.launch/i.test(message)) {
    return `${message} — ${PLAYWRIGHT_INSTALL_HINT_VI}`;
  }
  return message;
}

export async function launchChromium(extra?: LaunchOptions): Promise<Browser> {
  ensureBrowsersPath();
  const executablePath = resolveChromiumExecutablePath();
  try {
    return await chromium.launch({
      headless: PLAYWRIGHT_HEADLESS,
      args: PLAYWRIGHT_LAUNCH_ARGS,
      ...(executablePath ? { executablePath } : {}),
      ...extra,
    });
  } catch (err) {
    throw new Error(formatPlaywrightLaunchError(err));
  }
}
