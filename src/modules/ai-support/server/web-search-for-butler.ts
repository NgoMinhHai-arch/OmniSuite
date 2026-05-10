import { serpApiSearch } from '@/lib/seo/serpapi';
import { callLlm, tryParseJson } from '@/lib/seo/llm-call';
import type { AiSupportLlmParams, ClientKeys } from '@/modules/ai-support/server/types';
import { buildKeys } from '@/modules/ai-support/server/types';
import { getSystemConfig } from '@/shared/lib/config';
import { fetchTavilyContext } from '@/shared/utils/tavily';

export function mergeButlerSearchKeys(client?: ClientKeys): { tavily: string; serpapi: string } {
  const sys = getSystemConfig();
  return {
    tavily: (client?.tavily_api_key || sys.tavily_api_key || '').trim(),
    serpapi: (client?.serpapi_key || sys.serpapi_key || '').trim(),
  };
}

export function hasButlerWebSearch(keys: { tavily: string; serpapi: string }): boolean {
  return !!(keys.tavily || keys.serpapi);
}

/** Trích ngắn từ SerpAPI (organic). */
async function fetchSerpContext(query: string, apiKey: string): Promise<string> {
  const r = await serpApiSearch(apiKey, { query, num: 8, hl: 'vi', gl: 'vn' });
  if (!r.ok || !r.data) return '';
  const org = (r.data as { organic_results?: Array<{ title?: string; link?: string; snippet?: string }> })
    .organic_results;
  if (!Array.isArray(org) || !org.length) return '';
  const lines = org.slice(0, 8).map((o, i) => {
    const t = (o.title || '').trim();
    const s = (o.snippet || '').trim();
    const u = (o.link || '').trim();
    return `${i + 1}. ${t}\n   ${s}\n   ${u}`;
  });
  let text = lines.join('\n\n');
  if (text.length > 5500) text = `${text.slice(0, 5500)}\n... [Đã cắt]`;
  return text;
}

/**
 * Tavily ưu tiên (ngữ cảnh dài hơn), fallback SerpAPI snippets.
 */
export async function fetchButlerWebContext(
  query: string,
  keys: { tavily: string; serpapi: string },
): Promise<{ text: string; source: 'tavily' | 'serpapi' | null }> {
  const qn = query.trim().slice(0, 220);
  if (!qn) return { text: '', source: null };

  if (keys.tavily) {
    const ctx = await fetchTavilyContext(qn, keys.tavily);
    if (ctx.trim()) return { text: ctx, source: 'tavily' };
  }
  if (keys.serpapi) {
    const ctx = await fetchSerpContext(qn, keys.serpapi);
    if (ctx.trim()) return { text: ctx, source: 'serpapi' };
  }
  return { text: '', source: null };
}

interface ClassifyJson {
  search?: string | null;
}

/**
 * Gọi LLM nhỏ: có cần search web cho câu hỏi này không.
 */
export async function classifyButlerWebSearchQuery(input: {
  message: string;
  llm: AiSupportLlmParams;
}): Promise<string | null> {
  const providerLc = (input.llm.provider || '').toLowerCase();
  const jsonMode = providerLc !== 'claude';

  const system = `Bạn phân loại ý định. Trả về ĐÚNG một JSON object, không markdown.
Schema: {"search": null | "chuỗi truy vấn ngắn"}

Đặt "search" là một truy vấn tìm kiếm web (tiếng Việt hoặc Anh, tối đa 12 từ) khi chủ nhân cần thông tin ĐANG/CẬP NHẬT hoặc NGOÀI phần mềm OmniSuite: tin tức, giá, thời tiết, tỷ giá, sự kiện, sản phẩm, release, benchmark, công thức thực tế, “tra cứu nhanh”, hoặc bất kỳ thứ không thể biết chắc nếu không lên mạng.

Đặt "search" là null khi: chỉ hỏi cách dùng OmniSuite, dashboard, sidebar, Quản gia, slash command, API key, SEO tool trong app (Viết bài AI, Quét bản đồ…), hoặc trò chuyện xã giao ngắn, hoặc câu đã đủ trả lời từ kiến thức tĩnh — tuyệt đối không đặt search chỉ để “hướng dẫn dùng tính năng trong app”.`;

  const prompt = `Tin nhắn chủ nhân:\n${input.message.trim().slice(0, 1800)}`;

  try {
    const result = await callLlm(
      {
        system,
        prompt,
        provider: input.llm.provider,
        model: input.llm.model,
        temperature: 0.1,
        maxTokens: 120,
        jsonMode,
      },
      buildKeys(input.llm.keys),
    );
    const parsed = tryParseJson<ClassifyJson>(result.text);
    const s = parsed?.search;
    if (typeof s !== 'string') return null;
    const t = s.trim();
    if (!t || t.length < 2) return null;
    return t.slice(0, 220);
  } catch {
    return null;
  }
}

/** Tin hiệu cần dữ liệu web (ưu tiên lên mạng). */
export function hasStrongWebIntentSignal(message: string): boolean {
  return /mới\s+nhất|hiện\s+tại|hôm\s+nay|tỷ\s+giá|giá\s+vàng|thời\s+tiết|tin\s+thị\s+trường|stackoverflow\.com|github\.com|\bx\.com\b|twitter\.com|\b202[5-9]\b|phiên\s+bản\s+mới|benchmark\s+mới|ngoài\s+omnisuite|trên\s+mạng|đánh\s+giá\s+trên\s+web|so\s+với\s+\w+\s+(ngoài|bên\s+ngoài)/i.test(
    message,
  );
}

/** Hỏi trong app / OmniSuite — thường không cần web trừ khi có tin hiệu mạnh. */
export function looksOmniSuiteInAppQuestion(message: string): boolean {
  const m = message.toLowerCase();
  return /omnisuite|\bdashboard\b|sidebar|menu\s+trái|`?\/?(?:howto|tools|tour)\b|cấu\s+hình\s+hệ\s+thống|quản\s+gia|viết\s+bài\s+ai|quét\s+bản\s+đồ|phân\s+tích\s+từ\s+khóa|bộ\s+công\s+cụ\s+seo|kiểm\s+tra\s+website|seo\s+nâng\s+cao|tìm\s+hình\s+ảnh|hỗ\s+trợ\s+tìm\s+việc|slash\s|tool\s+(trong\s+)?(app|omnisuite)/i.test(
    m,
  );
}

/** Có nên gọi phân loại (tiết kiệm gọi thừa)? */
export function shouldAttemptAutoWebSearch(message: string): boolean {
  const m = message.trim();
  if (m.length < 12) return false;
  if (/^(chào|xin chào|hello|hi|hey|cảm ơn|thanks)\b/i.test(m) && m.length < 40) return false;
  if (looksOmniSuiteInAppQuestion(m) && !hasStrongWebIntentSignal(m)) return false;
  if (/\?/.test(m)) return true;
  if (m.length > 48) return true;
  return /tìm|tra cứu|search|google|mới nhất|hôm nay|giá |tin tức|thời tiết|tỷ giá|bảng giá|review |đánh giá |so sánh /i.test(m);
}
