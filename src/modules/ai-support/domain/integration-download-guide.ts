import type { RunnerId } from './runner-registry.generated';

export type DownloadableIntegrationId = 'open_manus' | 'browser_use';

const RUNNER_TO_INTEGRATION: Partial<Record<RunnerId, DownloadableIntegrationId>> = {
  open_manus: 'open_manus',
  browser_use: 'browser_use',
};

const PACKAGES: Record<
  DownloadableIntegrationId,
  { title: string; sizeHint: string; folder: string; slash: string }
> = {
  open_manus: {
    title: 'OpenManus',
    sizeHint: '~200–400 MB',
    folder: 'integrations/ai-support/submodules/open-manus',
    slash: '/run',
  },
  browser_use: {
    title: 'browser-use',
    sizeHint: '~100–150 MB',
    folder: 'integrations/ai-support/submodules/browser-use',
    slash: '/run-browser',
  },
};

export function integrationIdForRunner(runner: RunnerId): DownloadableIntegrationId | null {
  return RUNNER_TO_INTEGRATION[runner] ?? null;
}

export function runnerNeedsDownload(runner: RunnerId): boolean {
  return integrationIdForRunner(runner) !== null;
}

/** Trước khi server bắt đầu tải — hiện trong log runner. */
export function buildPreDownloadLog(runner: RunnerId): string {
  const id = integrationIdForRunner(runner);
  if (!id) return 'Đang khởi chạy runner…';
  const p = PACKAGES[id];
  return [
    `Lần đầu dùng ${p.slash}: OmniSuite sẽ tải ${p.title} (${p.sizeHint}) về thư mục dự án.`,
    'Chỉ tải đúng gói này — không tải hết integration lúc cài app.',
    'Vui lòng chờ 1–5 phút (tùy mạng). Có thể đóng cửa sổ tải Git nếu Windows hỏi.',
  ].join('\n');
}

export function buildAfterDownloadLog(runner: RunnerId): string {
  const id = integrationIdForRunner(runner);
  if (!id) return 'Đã sẵn sàng — đang chạy nhiệm vụ…';
  const p = PACKAGES[id];
  return `Đã tải xong ${p.title}. Đang khởi chạy agent…`;
}

/** Hướng dẫn đầy đủ khi tải lỗi hoặc setup_required. */
export function buildDownloadGuideForRunner(runner: RunnerId, extra?: string): string {
  const id = integrationIdForRunner(runner);
  if (!id) {
    return [
      'Runner này không tải repo con tự động.',
      extra || '',
      'Xem /integrations hoặc setupHint trong manifest.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  const p = PACKAGES[id];
  return [
    `HƯỚNG DẪN TẢI — ${p.title} (cho ${p.slash})`,
    '',
    'Bạn chỉ cần clone OmniSuite — không cần tải OpenManus/browser-use tay trước.',
    '',
    'Cách 1 — Tự động (khuyến nghị)',
    `  Gõ lại: ${p.slash} <nhiệm vụ của bạn>`,
    '  Lần đầu app sẽ tự tải vào:',
    `  ${p.folder}`,
    '',
    'Cách 2 — Tải tay bằng lệnh (PowerShell trong thư mục OmniSuite)',
    `  npm run integrations:fetch -- ${id}`,
    '',
    'Cách 3 — Dev tải hết submodule',
    '  npm run integrations:sync:all',
    '',
    'Sau khi có repo con, nếu Python báo thiếu package:',
    '  scripts/setup-runners-venv.ps1  (tùy chọn, chỉ khi dùng /run hoặc /run-browser)',
    '',
    extra ? `Chi tiết: ${extra}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildSetupRequiredInstructions(
  runner: RunnerId,
  missing?: string[],
  rawInstructions?: string,
): string {
  const guide = buildDownloadGuideForRunner(runner, rawInstructions);
  if (missing?.length) {
    return `${guide}\n\nThiếu trên máy: ${missing.join(', ')}`;
  }
  return guide;
}

/** Slash /tai — tổng quan tải gói Quản gia. */
export function buildTaiDownloadAnswer(topic?: string): string {
  const t = (topic || '').trim().toLowerCase();
  if (t === 'open_manus' || t === 'open-manus' || t === 'manus') {
    return buildDownloadGuideForRunner('open_manus');
  }
  if (t === 'browser' || t === 'browser_use' || t === 'browser-use') {
    return buildDownloadGuideForRunner('browser_use');
  }
  if (t === 'crawl4ai' || t === 'crawl') {
    return [
      buildDownloadGuideForRunner('browser_use').split('\n')[0],
      '',
      'Crawl4AI — lõi cào web (không phải runner Quản gia):',
      '  npm run integrations:fetch -- crawl4ai',
      '  pip install crawl4ai && playwright install',
      '  Repo: https://github.com/unclecode/crawl4ai',
      '  Trạng thái: /tai-bang',
    ].join('\n');
  }
  if (t === 'activepieces' || t === 'activepiece') {
    return [
      'HƯỚNG DẪN TẢI — Activepieces',
      '',
      '  npm run integrations:fetch -- activepieces',
      '  cd integrations/web-stack/activepieces && docker compose up -d',
      '  GitHub: https://github.com/activepieces/activepieces',
      '  Trạng thái: /tai-bang',
    ].join('\n');
  }

  return [
    'TẢI GÓI INTEGRATION — người dùng tự tải từng cái',
    '',
    'ZIP hay git clone đều KHÔNG có sẵn OpenManus, JobOps, browser-use…',
    'OmniSuite chỉ là khung app; mỗi gói tải riêng khi bạn cần.',
    '',
    '1) Lấy OmniSuite (khuyến nghị git clone, tránh ZIP)',
    '   git clone https://github.com/NgoMinhHai-arch/OmniSuite.git',
    '   cd OmniSuite && npm install',
    '',
    '2) Tải gói bạn cần (chọn một cách):',
    '   • Lần đầu /run hoặc /run-browser → tự tải OpenManus hoặc browser-use',
    '   • npm run integrations:fetch -- <id>  (vd. open_manus, crawl4ai)',
    '   • JobOps, resume-lm…: git clone vào đúng folder trong /integrations (xem /integrations)',
    '',
    '3) Lệnh runner — có thể tự tải lần đầu:',
    '   /run <việc>           → tải OpenManus',
    '   /run-browser <việc>   → tải browser-use',
    '',
    '4) Tải tay (mạng lỗi hoặc app ngoài Quản gia):',
    '   npm run integrations:fetch -- open_manus',
    '   npm run integrations:fetch -- browser_use',
    '   npm run integrations:fetch -- crawl4ai      # lõi cào web',
    '   npm run integrations:fetch -- activepieces  # workflow automation',
    '',
    '5) Pip runner (tùy chọn, sau khi đã có repo con):',
    '   scripts/setup-runners-venv.ps1',
    '',
    'Gõ /tai open_manus hoặc /tai browser để xem chi tiết từng gói.',
    'Gõ /tai-bang để xem bảng đã tải / chưa tải trên máy.',
    'Gõ /integrations để xem danh sách integration trong manifest.',
  ].join('\n');
}

export function buildIntegrationsDownloadPreamble(): string {
  return [
    'LƯU Ý TẢI INTEGRATION',
    '• ZIP hoặc git clone: OpenManus, JobOps, browser-use… đều CHƯA có — bạn tự tải từng gói.',
    '• OmniSuite core (SEO, Quản gia chat) chạy sau npm install; integration tải riêng.',
    '• /run, /run-browser: có thể tự tải lần đầu · JobOps/app khác: clone theo /integrations.',
    '• Bảng đã/chưa tải: /tai-bang · Hướng dẫn: /tai',
    '',
  ].join('\n');
}
