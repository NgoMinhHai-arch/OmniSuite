export type SlashHandlerKind =
  | 'chat'
  | 'plan'
  | 'static'
  | 'system_check'
  | 'runner'
  | 'web_search'
  | 'noop_future';

export interface SlashCommandDef {
  command: string;
  label: string;
  description: string;
  handlerKind: SlashHandlerKind;
  /** Một dòng có thể copy để thử — hiển thị trong /help và gợi ý slash. */
  example?: string;
}

export const AI_SUPPORT_SLASH_COMMANDS: SlashCommandDef[] = [
  {
    command: '/help',
    label: 'Danh sách lệnh',
    description: 'In đầy đủ slash + ví dụ (không gọi LLM).',
    handlerKind: 'static',
    example: '/help',
  },
  {
    command: '/tour',
    label: 'Tour OmniSuite',
    description: 'Tổng quan ~60 giây: nhóm công cụ và luồng làm việc điển hình.',
    handlerKind: 'static',
    example: '/tour',
  },
  {
    command: '/tools',
    label: 'Danh sách trang',
    description: 'Liệt kê các mục chính trong sidebar và việc nên làm ở đó.',
    handlerKind: 'static',
    example: '/tools',
  },
  {
    command: '/check',
    label: 'Kiểm tra cấu hình',
    description: 'API key / provider / Tavily-SerpAPI đã có chưa (theo Cấu hình & .env).',
    handlerKind: 'system_check',
    example: '/check',
  },
  {
    command: '/settings',
    label: 'Hướng dẫn Cấu hình',
    description: 'Nhắc đường dẫn nhập key, Ollama, tìm kiếm web.',
    handlerKind: 'static',
    example: '/settings',
  },
  {
    command: '/llm',
    label: 'Chọn LLM',
    description: 'Gợi ý provider/model theo nhu cầu (local vs cloud).',
    handlerKind: 'static',
    example: '/llm local không cần API key',
  },
  {
    command: '/howto',
    label: 'Hướng dẫn theo chủ đề',
    description: '/howto <chủ đề> — tra cứu trong knowledge OmniSuite.',
    handlerKind: 'static',
    example: '/howto viết bài SEO',
  },
  {
    command: '/troubleshoot',
    label: 'Xử lý lỗi',
    description: '/troubleshoot <triệu chứng> — gợi ý sửa lỗi thường gặp.',
    handlerKind: 'static',
    example: '/troubleshoot ollama không kết nối',
  },
  {
    command: '/integrations',
    label: 'Integration đã clone',
    description: 'Liệt kê integrations/, slash runner (/run, /run-browser…), app Node/Docker riêng.',
    handlerKind: 'static',
    example: '/integrations',
  },
  {
    command: '/web',
    label: 'Tìm web (bắt buộc)',
    description: '/web <truy vấn> — chỉ định lên mạng (cần Tavily hoặc SerpAPI trong Cấu hình).',
    handlerKind: 'web_search',
    example: '/web tin AI Agent framework nổi bật 2026',
  },
  {
    command: '/plan',
    label: 'Kế hoạch 3 tầng',
    description: '/plan <mục tiêu> — Não · Tay agent · Công cụ (JSON có cấu trúc).',
    handlerKind: 'plan',
    example: '/plan săn job remote và chỉnh CV theo từng JD',
  },
  {
    command: '/browser',
    label: 'Plan ưu tiên browser',
    description: 'Giống /plan nhưng đẩy browser_agent lên đầu khi chọn agent tầng 2.',
    handlerKind: 'plan',
    example: '/browser mở các site tuyển dụng và tóm tắt JD phù hợp profile dev',
  },
  {
    command: '/run',
    label: 'OpenManus (/run)',
    description: '/run <nhiệm vụ> — chạy code/shell trên máy bạn (cần AI_SUPPORT_RUNNER_ENABLED + venv runners).',
    handlerKind: 'runner',
    example: '/run liệt kê 10 file mới nhất trong thư mục Downloads và in tên + kích thước',
  },
  {
    command: '/run-browser',
    label: 'Browser Agent',
    description: '/run-browser <nhiệm vụ> — Playwright + browser-use (cùng điều kiện runner như /run).',
    handlerKind: 'runner',
    example: '/run-browser mở https://duckduckgo.com và tìm "tỷ giá USD VND hôm nay", in kết quả đầu tiên',
  },
  {
    command: '/apply',
    label: 'ApplyPilot',
    description: '/apply doctor|init|run|apply — pipeline nộp đơn (mặc định doctor nếu không gõ thêm).',
    handlerKind: 'runner',
    example: '/apply doctor',
  },
  {
    command: '/score',
    label: 'Score JD vs resume',
    description: '/score <mô tả JD hoặc paste JD> — điểm khớp job vs resume (job-scraper LLM).',
    handlerKind: 'runner',
    example:
      '/score Senior Frontend React TypeScript remote EU 5+ năm tiếng Anh fluent paste JD đầy đủ phía sau',
  },
];

/** Nút “bắt đầu nhanh” dưới ô chat — mỗi chuỗi là một chức năng tiêu biểu. */
export const QUAN_GIA_QUICK_CHIPS: readonly string[] = [
  '/help',
  '/tour',
  '/tools',
  '/check',
  '/integrations',
  '/web khác nhau Tavily và SerpAPI là gì',
  '/plan săn job remote và chỉnh CV theo JD',
  '/browser lập kế hoạch dùng trình duyệt tìm việc',
  '/run liệt kê file .pdf trong Downloads (chỉ tên)',
  '/run-browser mở google.com tìm Next.js 15 và tóm tắt 3 dòng',
  '/apply doctor',
  '/score Paste JD: Backend Python AWS microservices senior remote',
];

export function parseSlashInput(input: string): { command: string | null; args: string } {
  const text = (input || '').trim();
  if (!text.startsWith('/')) return { command: null, args: text };
  const [raw, ...rest] = text.split(/\s+/);
  return { command: raw.toLowerCase(), args: rest.join(' ').trim() };
}

export function findSlashCommand(command: string | null): SlashCommandDef | null {
  if (!command) return null;
  return AI_SUPPORT_SLASH_COMMANDS.find((item) => item.command === command) || null;
}
