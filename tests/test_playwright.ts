import { chromium } from 'playwright';

async function test() {
  console.log('Starting browser...');
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-setuid-sandbox', '--no-sandbox', '--disable-dev-shm-usage'] 
  });
  console.log('Browser started.');
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const keyword = 'dịch vụ seo';
    
    console.log(`Searching for: ${keyword}`);
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}&num=15`, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    const urls = await page.evaluate(() => {
      const resultSelector = 'div.g, div.tF2Cxc, div.yuRUbf, div.kvH9C, div.Z26q7c';
      const links: string[] = [];
      document.querySelectorAll(resultSelector).forEach((container) => {
        const anchor = container.querySelector('a[href^="http"]');
        if (anchor) {
          links.push((anchor as HTMLAnchorElement).href);
        }
      });
      return links;
    });
    
    console.log('Found URLs:', urls);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

test();
