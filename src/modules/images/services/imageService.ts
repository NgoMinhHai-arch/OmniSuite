import axios from 'axios';
import AiProcessManager from '@/shared/lib/aiProcessManager';

/**
 * PRODUCTION IMAGE PIPELINE BRIDGE (SILENT PROCESS MANAGEMENT)
 * Interfaces with the Python-based pipeline_engine.py (Port 8000)
 */

const BASE_URL = 'http://127.0.0.1:8000'; 
const PIPELINE_URL = `${BASE_URL}/api/v1/semantic-filter`;
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN;

export interface ImageResult {
  url: string;
  thumbnail: string;
  title: string;
  alt?: string;
  filename?: string;
  score?: number;
}

/**
 * Main service to scrape and filter images using the AI Pipeline
 */
export async function scrapeImages(
  keyword: string, 
  limit: number = 15, 
  location: string = '', 
  placeTypeLabel: string = '',
  exclude: string = '',
  usePremium: boolean = false,
  serpapi_key: string = '',
  aiFilterEnabled: boolean = true,
  aiModel: string = 'system',
  aiProvider: string = 'system',
  aiApiKey: string = '',
  onProgress?: (msg: string) => void
) {
  try {
    if (!INTERNAL_TOKEN) {
      throw new Error('Thiếu INTERNAL_TOKEN trong biến môi trường.');
    }

    const query = `${keyword} ${location} ${placeTypeLabel}`.trim();
    if (onProgress) onProgress(`🔍 Khởi động Hybrid Search AI: "${query}"...`);

    // STEP 1: Ensure AI Backend is running
    const manager = AiProcessManager.getInstance();
    const isReady = await manager.ensureStarted(onProgress);

    if (!isReady) {
      throw new Error("Không thể khởi động Lõi AI. Vui lòng kiểm tra môi trường Python.");
    }

    const sourceStatus = usePremium ? "Hybrid (Bing + Google + Maps)" : "Bing Only";
    if (onProgress) onProgress(`🧠 Đang lọc ảnh chất lượng cao từ ${sourceStatus}...`);

    const callPipeline = () => axios.post(PIPELINE_URL, {
      keyword: keyword,
      location: location,
      place_type: placeTypeLabel,
      limit: limit,
      use_premium: usePremium,
      serpapi_key: serpapi_key,
    }, {
      timeout: 150000,
      headers: {
        'X-Internal-Token': INTERNAL_TOKEN
      }
    });

    const isTransientNetworkError = (err: any) => {
      const msg = String(err?.message || '').toLowerCase();
      const code = String(err?.code || '').toUpperCase();
      return code === 'ECONNRESET' ||
        code === 'ECONNREFUSED' ||
        msg.includes('read econnreset') ||
        msg.includes('econnreset') ||
        msg.includes('econnrefused') ||
        msg.includes('socket hang up');
    };

    let response: any;
    try {
      response = await callPipeline();
    } catch (firstError: any) {
      if (isTransientNetworkError(firstError)) {
        if (onProgress) onProgress('Hệ thống đang tự kết nối lại Lõi AI...');
        await new Promise((r) => setTimeout(r, 1200));
        response = await callPipeline();
      } else {
        throw firstError;
      }
    }

    const data = response.data;
    if (data.status === 'success') {
      const results: ImageResult[] = data.images.map((img: any) => ({
        url: img.url,
        thumbnail: img.url || img.thumbnail,
        title: query,
        alt: img.alt || `Ảnh thực tế ${query}`,
        filename: img.filename || `${query.replace(/\s+/g, '-')}.webp`,
        score: img.score
      }));
      if (onProgress) onProgress(`✅ Đã tìm thấy ${results.length} ảnh đạt chuẩn.`);
      return results;
    }
    return [];

  } catch (error: any) {
    // Tối ưu hóa báo lỗi để không bị hiện [object Object]
    if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        const errorString = typeof detail === 'string' ? detail : JSON.stringify(detail);
        console.error("--- LỖI BACKEND AI ---", detail);
        throw new Error(`Lỗi hệ thống AI: ${errorString}`);
    }
    
    const status = error.response?.status;
    if (status === 401) throw new Error("Lỗi bảo mật: Mã xác thực nội bộ không khớp.");
    if (status === 422) throw new Error("Lỗi dữ liệu: Tham số gửi xuống Lõi AI không hợp lệ.");
    if (status === 503) throw new Error("Hệ thống AI đang khởi động. Vui lòng thử lại sau 10 giây.");

    const message = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toUpperCase();
    if (code === 'ECONNABORTED' || message.includes('timeout')) {
      throw new Error("Lõi AI phản hồi quá chậm. Vui lòng thử lại sau ít phút.");
    }
    if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || message.includes('socket hang up') || message.includes('read econnreset')) {
      throw new Error("Lõi AI vừa được khởi động lại hoặc gián đoạn kết nối. Vui lòng bấm thử lại.");
    }

    console.error("AI Pipeline Scrape Error:", error.message);
    throw new Error(`Lỗi kết nối: ${error.message}`);
  }
}

/**
 * AI Image Generation (DALL-E 3)
 */
export async function generateAiImage(prompt: string, provider: string, apiKey: string) {
  if (provider === 'openai') {
    const response = await axios.post('https://api.openai.com/v1/images/generations', {
      model: "dall-e-3", prompt: prompt, n: 1, size: "1024x1024"
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
    return response.data.data[0].url;
  }
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024`;
}
