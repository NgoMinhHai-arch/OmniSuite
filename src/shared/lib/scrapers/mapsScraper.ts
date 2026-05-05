import { chromium } from 'playwright';

/**
 * Scrapes photos from Google Maps for a specific query without an API key.
 * This is used for the "API OFF" mode to provide high-quality localized images.
 */
export async function scrapeGoogleMapsPhotos(query: string, limit: number = 10) {
  let browser;
  try {
    console.log(`[Maps Scraper] Launching browser for: "${query}"`);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    // 1. Search Google Maps
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle' });

    // 2. Check if we found a direct match or a list
    // If it's a direct match, the "Photos" or the main photo should be visible.
    // Most specific searches lead to a direct place page or a primary result.
    
    // Attempt to click the main photo area or the photos tab
    // We target the first photo in the profile or the "Ảnh" tab
    const photoSelectors = [
      'button[aria-label^="Ảnh của"]', // Main photo button
      'button[role="tab"][aria-label*="Ảnh"]', // Photos tab
      'button[role="tab"][aria-label*="Photos"]', // English Photos tab
      'div#QA0Szd >> div[role="main"] >> button >> img', // Any major image button
      'div.m6QErb.XiKgde >> a >> div.aHpZye', // Thumbnail list
    ];

    let found = false;
    for (const selector of photoSelectors) {
      if (await page.isVisible(selector)) {
        await page.click(selector);
        found = true;
        break;
      }
    }

    if (!found) {
      // Try to find the first result in a list if it's not a direct match
      const firstResultSelector = 'a.hfpxzc';
      if (await page.isVisible(firstResultSelector)) {
        await page.click(firstResultSelector);
        await page.waitForTimeout(2000); // Wait for the place details to load
        // Try clicking photos again
        for (const selector of photoSelectors) {
          if (await page.isVisible(selector)) {
            await page.click(selector);
            found = true;
            break;
          }
        }
      }
    }

    // 3. Extract Images from the photo gallery
    // The gallery uses lazy loading in a scrollable container.
    // Selector based on research: .m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde
    const galleryContainer = 'div.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde';
    
    await page.waitForSelector('div.aHpZye', { timeout: 10000 }).catch(() => null);
    
    // Scroll a bit to load more if needed
    await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        if (el) el.scrollTop = 500;
    }, galleryContainer);
    await page.waitForTimeout(1000);

    const images = await page.evaluate(() => {
      const imgElements = Array.from(document.querySelectorAll('div.aHpZye'));
      return imgElements.map(el => {
        const style = el.getAttribute('style') || '';
        const match = style.match(/background-image:\s*url\s*\((?:&quot;|"|')?(.+?)(?:&quot;|"|')?\)/);
        if (match && match[1]) {
           let url = match[1];
           // Upgrade to full resolution by replacing the sizing suffix with =s0
           // Common prefixes: =w203-h360-k-no, =s1360-w1360-h1020, etc.
           url = url.split('=')[0] + '=s0';
           return url;
        }
        return null;
      }).filter(Boolean);
    });

    console.log(`[Maps Scraper] Found ${images.length} images.`);
    return images.slice(0, limit).map(url => ({
      url: url,
      thumbnail: url?.replace('=s0', '=w400') || url
    }));

  } catch (error: any) {
    console.error(`[Maps Scraper] Error: ${error.message}`);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}
