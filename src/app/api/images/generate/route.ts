import { NextResponse } from 'next/server';
import { generateAiImage } from '@/modules/images/services/imageService';

export async function POST(req: Request) {
  try {
    const { prompt, provider = 'openai', apiKey } = await req.json();

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Vui lòng nhập Prompt.' }, { status: 400 });
    }

    console.log(`[NextJS] Đang yêu cầu AI (${provider}) tạo ảnh`);
    const resultUrl = await generateAiImage(prompt, provider, apiKey);

    return NextResponse.json({ success: true, data: resultUrl });
  } catch (error: any) {
    console.error('Lỗi API khởi chạy AI image:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
