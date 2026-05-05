export interface APIInfo {
  provider: string;
  capabilities: string[];
  color: string;
}

export const identifyKey = (key: string): APIInfo | null => {
  if (!key) return null;

  if (key.startsWith('sk-ant-')) {
    return { provider: 'Claude', capabilities: ['Viết bài AI full-length', 'Phân tích nội dung sâu'], color: 'orange' };
  }
  if (key.startsWith('sk-or-v1-')) {
    return { provider: 'OpenRouter', capabilities: ['Truy cập hàng trăm model AI', 'Llama 3, Qwen, DeepSeek...'], color: 'indigo' };
  }
  if (key.startsWith('sk-')) {
    return { provider: 'OpenAI', capabilities: ['Viết bài AI đa dạng model', 'Tạo nội dung SEO'], color: 'emerald' };
  }
  if (key.startsWith('sk-') && key.length > 30) {
    // Note: DeepSeek keys often share same format, so they'll be identified as OpenAI
    // But we'll add DeepSeek explicitly to the settings field mapping
    return { provider: 'DeepSeek', capabilities: ['Viết bài giá rẻ', 'Tư duy logic tốt'], color: 'blue' };
  }
  if (key.startsWith('AIza')) {
    return { provider: 'Gemini', capabilities: ['Viết bài AI tốc độ cao', 'Phân tích miễn phí (với bản Flash)'], color: 'blue' };
  }
  if (key.startsWith('gsk_')) {
    return { provider: 'Groq', capabilities: ['Viết bài AI siêu tốc', 'Ít độ trễ'], color: 'rose' };
  }
  if (/^[a-f0-9]{64}$/i.test(key)) {
    return { provider: 'SerpAPI', capabilities: ['Nghiên cứu từ khóa SERP', 'Quét Google Maps'], color: 'indigo' };
  }
  if (key.length > 20 && key.includes('.')) {
    return { provider: 'WordPress', capabilities: ['Đăng bài tự động', 'Quản lý website'], color: 'purple' };
  }
  
  
  return null;
};

export const getFieldCapability = (fieldId: string): string[] => {
  const map: Record<string, string[]> = {
    openai_api_key: ['Viết bài AI', 'Tạo Schema'],
    gemini_api_key: ['Viết bài AI', 'Phân tích Keywords'],
    claude_api_key: ['Viết bài chuyên sâu', 'Tóm tắt bài viết'],
    groq_api_key: ['Viết bài siêu tốc'],
    deepseek_api_key: ['Viết bài giá rẻ', 'Deep Thinking'],
    openrouter_api_key: ['Hỗ trợ đa dạng model', 'Tối ưu chi phí'],
    serpapi_key: ['Nghiên cứu từ khóa', 'Quét Google Maps'],
    dataforseo_user: ['Dữ liệu SEO chuyên nghiệp', 'Volume từ khóa'],
    google_maps_api_key: ['Quét Google Maps (Tìm kiếm)', 'Tìm SĐT/Website'],
    outscraper_key: ['Quét Google Maps nâng cao', 'Trình duyệt đám mây'],
    wp_app_pass: ['Đăng bài WordPress', 'Cập nhật Media']
  };
  return map[fieldId] || [];
};
