import { NextResponse } from 'next/server';
import axios from 'axios';
import sharp from 'sharp';
import archiver from 'archiver';
import { PassThrough } from 'stream';

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const providers = [
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': new URL(url).origin + '/' } },
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, // No referer
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko' } } // Legacy
  ];

  for (const config of providers) {
    try {
      const resp = await axios({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
        headers: config.headers,
        timeout: 12000,
        maxRedirects: 5
      });
      if (resp.data) return Buffer.from(resp.data);
    } catch (e) {
      continue;
    }
  }
  throw new Error(`Không thể tải ảnh từ: ${url}`);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items = body.items || (body.urls ? body.urls.map((url: string) => ({ url, topic: body.seoName })) : []);
    const { convertToWebp = false, seoName = 'seo-image' } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Không có danh sách ảnh.' }, { status: 400 });
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const subject = (seoName || 'images').replace(/[\s\/\\?%*:|"<>]+/g, '-');
    const finalFileName = `OmniSuite_Bulk_${subject}_${timestamp}.zip`;

    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = new PassThrough();
    archive.pipe(stream);

    // Run parallel archiving with concurrency limit
    (async () => {
      const CONCURRENCY = 5;
      const topicCounters: Record<string, number> = {};

      for (let i = 0; i < items.length; i += CONCURRENCY) {
        const chunk = items.slice(i, i + CONCURRENCY);
        
        await Promise.all(chunk.map(async (item: any) => {
          try {
            const fileBuffer = await fetchImageBuffer(item.url);
            const topic = item.topic || 'image';
            topicCounters[topic] = (topicCounters[topic] || 0) + 1;
            
            const fileExt = convertToWebp ? 'webp' : 'jpg';
            const baseName = `${topic.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${String(topicCounters[topic]).padStart(2, '0')}`;

            let finalBuffer = fileBuffer;
            if (convertToWebp) {
              try {
                finalBuffer = await sharp(fileBuffer).webp({ quality: 82 }).toBuffer();
              } catch (e) {
                console.warn(`Sharp error for ${item.url}`);
              }
            }

            archive.append(finalBuffer, { name: `${baseName}.${fileExt}` });
          } catch (err: any) {
            console.warn(`Bỏ qua file lỗi (${item.url}): ${err.message}`);
          }
        }));
      }
      await archive.finalize();
    })();

    return new Response(stream as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(finalFileName)}"`,
      },
    });
  } catch (error: any) {
    console.error('Download Zip Error:', error.message);
    return NextResponse.json({ error: 'Lỗi nén file' }, { status: 500 });
  }
}
