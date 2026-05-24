import { SEOService } from '../src/modules/seo/services/seo_service';

async function test() {
  console.log('--- FINAL V15.2 STABILITY TEST ---');
  try {
    const results = await SEOService.analyzeBulk(['seo tool']);
    console.log('FINAL SUCCESS:', JSON.stringify(results, null, 2));
  } catch (e) {
    console.error('FINAL FAILED:', e);
  }
}

test();
