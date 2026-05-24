import { NextResponse } from 'next/server';
import { scrapeImages, type ImageFilterStrength } from '@/modules/images/services/imageService';

function normalizeFilterStrength(v: unknown): ImageFilterStrength {
  if (v === 'precise' || v === 'advanced' || v === 'default') return v;
  return 'default';
}

export async function POST(req: Request) {
  try {
    const { 
      keyword, 
      limit = 10, 
      location = '', 
      placeTypeLabel = '', 
      exclude = '',
      usePremium = false,
      serpApiKey = '',
      aiFilterEnabled = false,
      aiModel = 'system',
      aiProvider = 'system',
      aiApiKey = '',
      filterStrength: rawFilterStrength = 'default'
    } = await req.json();

    const filterStrength = normalizeFilterStrength(rawFilterStrength);

    if (!keyword && !location && !placeTypeLabel) {
      return NextResponse.json({ success: false, error: 'Vui lòng cung cấp ít nhất một thông tin tìm kiếm.' }, { status: 400 });
    }

    console.log(`[NextJS] Bắt đầu Hybrid Scrape cho: "${keyword}" (Premium: ${usePremium})`);
    const urls = await scrapeImages(
      keyword, 
      limit, 
      location, 
      placeTypeLabel, 
      exclude, 
      usePremium, 
      serpApiKey, 
      aiFilterEnabled,
      aiModel,
      aiProvider,
      aiApiKey,
      filterStrength
    );

    return NextResponse.json({ success: true, count: urls.length, data: urls });
  } catch (error: any) {
    const rawMessage = String(error?.message || 'Lỗi không xác định');
    const lowerMessage = rawMessage.toLowerCase();
    console.error('Lỗi API image scrape:', rawMessage);

    if (lowerMessage.includes('econnreset') || lowerMessage.includes('socket hang up')) {
      return NextResponse.json({
        success: false,
        error: 'Kết nối tới Lõi AI bị gián đoạn tạm thời. Vui lòng bấm thử lại.'
      }, { status: 503 });
    }

    if (lowerMessage.includes('timeout')) {
      return NextResponse.json({
        success: false,
        error: 'Lõi AI phản hồi quá chậm. Vui lòng thử lại sau ít phút.'
      }, { status: 504 });
    }

    return NextResponse.json({ success: false, error: rawMessage }, { status: 500 });
  }
}
