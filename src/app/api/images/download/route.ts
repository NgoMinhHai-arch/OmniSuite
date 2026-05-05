import { NextResponse } from 'next/server';
import axios from 'axios';
import sharp from 'sharp';

export async function POST(req: Request) {
  try {
    const { url, convertToWebp = false, seoName = 'image' } = await req.json();

    if (!url) return NextResponse.json({ error: 'Không có URL' }, { status: 400 });

    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bing.com/'
      },
      timeout: 10000
    });

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const subject = (seoName || 'image').replace(/[\s\/\\?%*:|"<>]+/g, '-');
    const fileExt = convertToWebp ? 'webp' : 'jpg';
    const finalFileName = `OmniSuite_${subject}_${timestamp}.${fileExt}`;

    let data = response.data;
    let contentType = response.headers['content-type'] || 'image/jpeg';

    if (convertToWebp) {
      data = await sharp(data).webp({ quality: 82 }).toBuffer();
      contentType = 'image/webp';
    }

    return new Response(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(finalFileName)}"`,
      },
    });
  } catch (error: any) {
    console.error('Download Error:', error.message);
    return NextResponse.json({ error: 'Lỗi tải ảnh' }, { status: 500 });
  }
}
