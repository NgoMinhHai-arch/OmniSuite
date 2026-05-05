import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(req: Request) {
  let url = '';
  try {
    const { searchParams } = new URL(req.url);
    url = decodeURIComponent(searchParams.get('url') || '');

    if (!url) {
      return new Response('No URL provided', { status: 400 });
    }

    let referer = 'https://www.google.com/';
    try {
      referer = new URL(url).origin + '/';
    } catch (e) {}

    // Headers set 1 (Standard with Referer)
    const headers1 = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': referer,
      'Cache-Control': 'no-cache'
    };

    // Headers set 2 (Aggressive, no referer)
    const headers2 = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.1',
      'Accept': 'image/*,*/*',
    };

    let response;
    try {
      response = await axios({
        method: 'GET',
        url: url,
        responseType: 'arraybuffer',
        headers: headers1,
        timeout: 8000,
        maxRedirects: 5
      });
    } catch (err: any) {
      console.warn(`[Proxy Retry] ${url}: ${err.message}`);
      // Retry without referer
      response = await axios({
        method: 'GET',
        url: url,
        responseType: 'arraybuffer',
        headers: headers2,
        timeout: 10000,
        maxRedirects: 3
      });
    }

    const contentType = response.headers['content-type'] || 'image/jpeg';

    return new Response(response.data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error(`[Proxy Fatal] ${url}: ${error.message}`);
    // Return transparent 1x1 GIF fallback
    return new Response(
      Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
      { headers: { 'Content-Type': 'image/gif' } }
    );
  }
}
