import fs from 'fs';
import path from 'path';
import { chromium, type Browser, type LaunchOptions } from 'playwright';
import { PLAYWRIGHT_HEADLESS, PLAYWRIGHT_LAUNCH_ARGS } from './config';

export const PLAYWRIGHT_INSTALL_HINT_VI =
  'Chạy trong thư mục dự án: npx playwright install chromium-headless-shell (hoặc khởi động lại launcher / npm run setup:repair để tự cài).';

function ensureBrowsersPath(): void {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH?.trim()) return;
  const base = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'ms-playwright')
    : '';
  if (base && fs.existsSync(base)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = base;
  }
}

export function formatPlaywrightLaunchError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/executable doesn't exist/i.test(message)) {
    return `${message} — ${PLAYWRIGHT_INSTALL_HINT_VI}`;
  }
  return message;
}

export async function launchChromium(extra?: LaunchOptions): Promise<Browser> {
  ensureBrowsersPath();
  try {
    return await chromium.launch({
      headless: PLAYWRIGHT_HEADLESS,
      args: PLAYWRIGHT_LAUNCH_ARGS,
      ...extra,
    });
  } catch (err) {
    throw new Error(formatPlaywrightLaunchError(err));
  }
}
