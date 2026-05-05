import { chromium } from 'playwright';
import axios from 'axios';
import { PLAYWRIGHT_HEADLESS, PLAYWRIGHT_LAUNCH_ARGS } from '@/shared/lib/playwright/config';

export interface MapsRow {
  keyword: string;
  rank: number;
  name: string;
  category: string;
  url_web: string;
  web_sources?: string[];
  email: string;
  phone: string;
  address: string;
  rating: string;
  reviews: string;
  lat: string;
  lng: string;
  url_map: string;
  is_ad: boolean;
}

const SOCIAL_HOSTS = [
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'zalo.me',
  'youtube.com',
  'linkedin.com',
  'x.com',
  'twitter.com',
];

const DISCOVERY_BLACKLIST = [
  'google.com',
  'tripadvisor.com',
  'yelp.com',
  'foody.vn',
  'f99.vn',
  'lozi.vn',
  'shopee.vn',
  'lazada.vn',
  'tiki.vn',
  'sendo.vn',
  'tgdd.vn',
  'dienmayxanh.com',
  'vnexpress.net',
  'dantri.com.vn',
  'tuoitre.vn',
  'thanhnien.vn',
  'kenh14.vn',
  '24h.com.vn',
  'vietnamnet.vn',
  'soha.vn',
  'afamily.vn',
  'eva.vn',
  'yellowpages.vn',
  'masothue.com',
  'tracuuthongtin.com',
  'doanhnghiep.io.vn',
  'chotot.com',
  'muaban.net',
  'enbac.com',
  'batdongsan.com.vn',
];

const normalizeHttpUrl = (url: string) => {
  try {
    const u = new URL(url.trim());
    u.hash = '';
    return u.toString();
  } catch {
    return '';
  }
};

const isSocialUrl = (url: string) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SOCIAL_HOSTS.some((h) => host.includes(h));
  } catch {
    return false;
  }
};

/**
 * Deep Email Scan Worker: Visits website to find email patterns
 */
export async function findEmailFromWebsite(url: string | undefined, browser: any): Promise<string> {
  if (!url || !url.startsWith('http')) return '';
  if (isSocialUrl(url)) return '';
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // RAM & Speed Optimization: Block heavy resources
    await page.route('**/*', (route: any) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    // Step 1: Scan Home Page (Very Quick)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 6000 });
    let content = await page.content();
    let emails = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    
    const validEmail = (list: string[]) => list.find(e => !/example|template|email@domain|sentry|git|wix|wp|bootstrap/i.test(e));
    
    let email = validEmail(emails || []);
    if (email) return email.toLowerCase();

    // Step 2: Quick check for Contact link
    const contactHref = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const found = links.find(l => {
        const t = l.innerText.toLowerCase();
        return t.includes('contact') || t.includes('lien he') || t.includes('liên hệ') || t.includes('about') || t.includes('gioi thieu') || t.includes('giới thiệu');
      });
      return found ? found.href : null;
    });

    if (contactHref && contactHref.startsWith('http')) {
      await page.goto(contactHref, { waitUntil: 'domcontentloaded', timeout: 3000 });
      content = await page.content();
      emails = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      email = validEmail(emails || []);
      if (email) return email.toLowerCase();
    }

    return '';
  } catch (err) {
    return '';
  } finally {
    await context.close();
  }
}

/**
 * Website Discovery: Multi-strategy search + address verification
 */
type WebDiscoveryResult = {
  primaryWebsite: string;
  links: string[];
};

/**
 * Website + social discovery from Google web results.
 * Returns a primary website and additional social/website links.
 */
export async function discoverWebPresence(name: string, address: string, phone: string, browser: any): Promise<WebDiscoveryResult> {
  const isCandidateOk = (url: string) => {
    try {
      const u = new URL(url);
      if (!url.startsWith('http')) return false;
      if (url.includes('/search?') || u.hostname.includes('google.com')) return false;
      return !DISCOVERY_BLACKLIST.some((b) => u.hostname.includes(b));
    } catch {
      return false;
    }
  };

  const verifyBusinessWebsite = async (url: string): Promise<boolean> => {
    if (!isCandidateOk(url) || isSocialUrl(url)) return false;
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    try {
      await pg.route('**/*', (route: any) => {
        return ['image', 'media', 'font'].includes(route.request().resourceType()) ? route.abort() : route.continue();
      });
      await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
      const bodyText: string = await pg.evaluate(() => document.body.innerText.toLowerCase());
      const nameWords = name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
      const nameHits = nameWords.filter((w: string) => bodyText.includes(w)).length;
      const nameOk = nameWords.length === 0 || nameHits >= Math.ceil(nameWords.length * 0.5);
      const phoneDigits = (phone || '').replace(/\D/g, '');
      const phoneOk = !phoneDigits || bodyText.replace(/\D/g, '').includes(phoneDigits);
      return nameOk && phoneOk;
    } catch {
      return false;
    } finally {
      await ctx.close();
    }
  };

  const searchGoogle = async (pg: any, query: string): Promise<string[]> => {
    await pg.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`, {
      waitUntil: 'domcontentloaded',
      timeout: 12000
    });
    await pg.waitForTimeout(600);
    const links: string[] = await pg.evaluate(() => {
      const selectors = ['div.yuRUbf > a', 'div.tF2Cxc a[data-ved]', 'div.g a[ping]', 'a[href^="http"]'];
      const found: string[] = [];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((el: any) => {
          const h = el.href || '';
          if (h.startsWith('http') && !found.includes(h)) found.push(h);
        });
      }
      return found.slice(0, 16);
    });
    return links.map(normalizeHttpUrl).filter(Boolean);
  };

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('**/*', (route: any) => {
    return ['image', 'media', 'font'].includes(route.request().resourceType()) ? route.abort() : route.continue();
  });

  try {
    const queries = [
      `"${name}" website chinh thuc`,
      `${name} ${address}`,
      `${name} ${address} facebook`,
      `${name} ${address} instagram`,
      `${name} ${address} tiktok`,
      phone ? `"${name}" "${phone}"` : '',
    ].filter(Boolean);

    const candidates: string[] = [];
    for (const q of queries) {
      const links = await searchGoogle(page, q);
      for (const link of links) {
        if (!link || candidates.includes(link)) continue;
        candidates.push(link);
      }
      if (candidates.length >= 32) break;
    }

    const filtered = candidates.filter(isCandidateOk);
    const socialLinks = filtered.filter(isSocialUrl).slice(0, 6);
    const websiteLinks = filtered.filter((u) => !isSocialUrl(u));

    let primaryWebsite = '';
    for (const website of websiteLinks.slice(0, 8)) {
      if (await verifyBusinessWebsite(website)) {
        primaryWebsite = website;
        break;
      }
    }

    if (!primaryWebsite && websiteLinks.length > 0) {
      primaryWebsite = websiteLinks[0];
    }

    const mergedLinks = Array.from(new Set([
      ...(primaryWebsite ? [primaryWebsite] : []),
      ...socialLinks,
      ...websiteLinks.slice(0, 4),
    ])).slice(0, 8);

    return { primaryWebsite, links: mergedLinks };
  } catch {
    return { primaryWebsite: '', links: [] };
  } finally {
    await context.close();
  }
}

export async function discoverWebsite(name: string, address: string, phone: string, browser: any): Promise<string> {
  const found = await discoverWebPresence(name, address, phone, browser);
  return found.primaryWebsite || found.links[0] || '';
}

export async function scrapeGoogleMapsPlaywright({ 
  keyword, 
  maxResults, 
  deepScan = false,
  onRow, 
  onLog 
}: { 
  keyword: string, 
  maxResults: number, 
  deepScan?: boolean,
  onRow: (row: MapsRow) => void, 
  onLog: (msg: string) => void 
}) {
  const browser = await chromium.launch({ 
    headless: PLAYWRIGHT_HEADLESS,
    args: PLAYWRIGHT_LAUNCH_ARGS, 
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const SEARCH_PAUSE = 1000; // TÄƒng má»™t chÃºt Ä‘á»ƒ Google ká»‹p load
  const CLICK_PAUSE = 600;  // TÄƒng Ä‘á»ƒ panel ká»‹p hiá»‡n thá»‹ dá»¯ liá»‡u

  try {
    onLog(`ðŸ” Äang tÃ¬m kiáº¿m: ${keyword}...`);
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(keyword)}`, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Wait for the side list to appear
    try {
      await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
    } catch (e) {
      onLog('âš ï¸ KhÃ´ng tÃ¬m tháº¥y danh sÃ¡ch káº¿t quáº£.');
    }
    
    const results: MapsRow[] = [];
    const processedFingerprints = new Set<string>();
    const seenHrefs = new Set<string>();
    const collectedHrefs: string[] = [];

    // Collect a larger candidate pool so final output can match requested count.
    const collectTarget = Math.max(maxResults * 4, maxResults + 40);

    // ===== PHASE 1: THU THáº¬P Háº¾T HREF TRÆ¯á»šC =====
    onLog(`ðŸ“™ Äang thu tháº­p danh sÃ¡ch Ä‘á»‹a Ä‘iá»ƒm...`);
    let noNewItemCount = 0;

    while (collectedHrefs.length < collectTarget) {
      const allHrefs = await page.$$eval(
        'a[href*="/maps/place/"]',
        (els) => els.map((el) => (el as HTMLAnchorElement).href)
      );

      let foundNew = false;
      for (const href of allHrefs) {
        const mapsId = href.match(/!1s([^!]+)/)?.[1] || href.split('?')[0];
        if (mapsId && !seenHrefs.has(mapsId)) {
          seenHrefs.add(mapsId);
          collectedHrefs.push(href);
          foundNew = true;
          if (collectedHrefs.length >= collectTarget) break;
        }
      }

      if (!foundNew) {
        noNewItemCount++;
        if (noNewItemCount >= 6) break; // tolerate slow-loading feeds to avoid under-collection
      } else {
        noNewItemCount = 0;
      }

      // Kiá»ƒm tra Ä‘Ã£ háº¿t danh sÃ¡ch chÆ°a
      const isEnd = await page.evaluate(() => {
        const t = document.body.innerText;
        return t.includes('Báº¡n Ä‘Ã£ xem háº¿t danh sÃ¡ch nÃ y') ||
               t.includes("You've reached the end of the list");
      });
      if (isEnd) {
        onLog('ðŸ ÄÃ£ tÃ¬m háº¿t táº¥t cáº£ Ä‘á»‹a Ä‘iá»ƒm trÃªn báº£n Ä‘á»“.');
        break;
      }

      const feed = await page.$('div[role="feed"]');
      if (feed) {
        await feed.evaluate((el) => el.scrollBy(0, 1200));
        await page.waitForTimeout(SEARCH_PAUSE);
      } else break;
    }

    onLog(`ðŸ“‹ Thu tháº­p ${collectedHrefs.length} Ä‘á»‹a Ä‘iá»ƒm. Äang láº¥y chi tiáº¿t...`);

    // ===== PHASE 2: ÄIá»€U HÆ¯á»šNG & Láº¤Y Dá»® LIá»†U CHI TIáº¾T =====
    for (const href of collectedHrefs) {
      if (results.length >= maxResults) break;
      onLog(`ðŸ”Ž Äang xá»­ lÃ½ ${results.length + 1}/${Math.min(collectedHrefs.length, maxResults)}...`);

      try {
        await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForSelector('h1.DUwDvf', { timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(CLICK_PAUSE);

        const extractData = () => page.evaluate(() => {
          const qs = (sel: string) => document.querySelector(sel)?.textContent?.trim() || '';
          const qa = (sel: string, attr: string) => document.querySelector(sel)?.getAttribute(attr) || '';
          const name = qs('h1.DUwDvf') || qs('h1.fontHeadlineLarge') || qs('[role="main"] h1');
          const category = qs('button.DkEaL') || qs('.D6kYec .fontBodyMedium');
          const address = qs('button[data-item-id="address"]') || qs('button[aria-label*="Address:"]');
          let phone = '';
          const phoneBtn = document.querySelector('button[data-item-id^="phone:tel:"]');
          if (phoneBtn) phone = phoneBtn.textContent?.trim() || '';
          const website = qa('a[data-item-id="authority"]', 'href');
          const webResults = Array.from(document.querySelectorAll('a[href^="http"]'))
            .map((a: any) => a.href || '')
            .filter((href: string) =>
              href.startsWith('http') &&
              !href.includes('google.com/maps') &&
              !href.includes('google.com/search') &&
              !href.includes('/policies/') &&
              !href.includes('/support/')
            )
            .slice(0, 20);
          let rating = '0', reviews = '0';
          const rBtn = document.querySelector('button[aria-label*="star"]');
          if (rBtn) {
            const label = rBtn.getAttribute('aria-label') || '';
            const rM = label.match(/([\d.,]+)\s*star/);
            if (rM) rating = rM[1].replace(',', '.');
            const rvM = label.match(/\(([\d.,\s]+)\)/);
            if (rvM) reviews = rvM[1].replace(/\D/g, '');
          }
          return { name, category, rating, reviews, address, phone, website, webResults };
        });

        let data = await extractData();

        // RETRY náº¿u khÃ´ng láº¥y Ä‘Æ°á»£c tÃªn
        if (!data.name) {
          await page.waitForTimeout(800);
          data = await extractData();
        }

        // Fallback tÃªn tá»« URL náº¿u trang khÃ´ng load ká»‹p
        const nameFromUrl = decodeURIComponent(href.split('/maps/place/')[1]?.split('/')[0] || '').replace(/\+/g, ' ');
        const finalName = (data.name && data.name !== 'Results' && data.name.length > 1)
          ? data.name
          : nameFromUrl || '';
        if (!finalName) {
          onLog(`âš ï¸ Bá» qua: khÃ´ng láº¥y Ä‘Æ°á»£c tÃªn tá»« href.`);
          continue;
        }

        // Fingerprint: Æ°u tiÃªn placeId (unique/Ä‘á»‹a Ä‘iá»ƒm), KHÃ”NG dÃ¹ng SÄT vÃ¬ cÃ¡c chi nhÃ¡nh cÃ³ thá»ƒ dÃ¹ng chung hotline
        const placeId = href.match(/!1s([^!]+)/)?.[1] || href.match(/place\/([^/]+)/)?.[1] || '';
        const fingerprint = placeId
          ? `id_${placeId}`
          : `name_${finalName}_${data.address.substring(0, 30)}`;

        if (processedFingerprints.has(fingerprint)) {
          onLog(`âš ï¸ Bá» qua trÃ¹ng láº·p: ${finalName}`);
          continue;
        }
        processedFingerprints.add(fingerprint);

        let currentWebsite = data.website || '';
        let webSources: string[] = Array.from(new Set([
          ...(currentWebsite ? [normalizeHttpUrl(currentWebsite)] : []),
          ...((data.webResults || []).map((u: string) => normalizeHttpUrl(u))),
        ])).filter(Boolean);
        let email = '';

        if (deepScan) {
          onLog(`🔍 Thu thập web/social cho: ${finalName}...`);
          const discovered = await discoverWebPresence(finalName, data.address, data.phone, browser);
          webSources = Array.from(new Set([
            ...webSources,
            ...(discovered.links || []),
          ])).filter(Boolean).slice(0, 8);

          if (!currentWebsite) {
            currentWebsite = discovered.primaryWebsite || webSources.find((u) => !isSocialUrl(u)) || webSources[0] || '';
          }

          const emailTargets = Array.from(new Set([
            ...(currentWebsite ? [currentWebsite] : []),
            ...webSources.filter((u) => !isSocialUrl(u)),
          ])).slice(0, 4);

          for (const targetUrl of emailTargets) {
            email = await findEmailFromWebsite(targetUrl, browser);
            if (email) break;
          }
        }

        const row: MapsRow = {
          keyword,
          rank: results.length + 1,
          name: finalName,
          category: data.category || '',
          url_web: currentWebsite,
          web_sources: webSources,
          email,
          phone: data.phone || '',
          address: data.address || '',
          rating: data.rating || '0',
          reviews: data.reviews || '0',
          lat: '', lng: '',
          url_map: page.url() || href,
          is_ad: false, // Phase 2 Ä‘iá»u hÆ°á»›ng trá»±c tiáº¿p, khÃ´ng phÃ¡t hiá»‡n Ä‘Æ°á»£c ad
        };

        results.push(row);
        onRow(row);

      } catch (err) {
        // Tiáº¿p tá»¥c sang Ä‘á»‹a Ä‘iá»ƒm tiáº¿p theo náº¿u lá»—i
      }
    }

  } finally {
    await browser.close();
  }
}

export async function scrapeGoogleMapsSerpApi({ 
  keyword, 
  maxResults, 
  apiKey 
}: { 
  keyword: string, 
  maxResults: number, 
  apiKey: string 
}): Promise<MapsRow[]> {
  const results: MapsRow[] = [];
  const seen = new Set<string>();
  const pageSize = 20;
  const maxPages = Math.max(1, Math.ceil(maxResults / pageSize) + 1);

  try {
    for (let page = 0; page < maxPages; page++) {
      if (results.length >= maxResults) break;
      const start = page * pageSize;
      const url = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(keyword)}&api_key=${apiKey}&type=search&start=${start}`;
      const response = await axios.get(url);

      const pushItem = (item: any, isAd: boolean) => {
        if (results.length >= maxResults) return;
        const identity = item.place_id || item.data_id || item.cid || item.link || `${item.title || ''}_${item.address || ''}`;
        if (!identity || seen.has(identity)) return;
        seen.add(identity);
        results.push({
          keyword,
          rank: results.length + 1,
          name: item.title || '',
          category: item.type || '',
          url_web: item.website || '',
          web_sources: item.website ? [item.website] : [],
          email: '',
          phone: item.phone || '',
          address: item.address || '',
          rating: item.rating ? String(item.rating) : '',
          reviews: item.reviews ? String(item.reviews) : '',
          lat: item.gps_coordinates?.latitude ? String(item.gps_coordinates.latitude) : '',
          lng: item.gps_coordinates?.longitude ? String(item.gps_coordinates.longitude) : '',
          url_map: item.link || '',
          is_ad: isAd,
        });
      };

      if (page === 0) {
        const adResults = response.data.ads || [];
        for (const item of adResults) pushItem(item, true);
      }

      const localResults = response.data.local_results || [];
      for (const item of localResults) pushItem(item, false);

      if (localResults.length === 0) {
        break;
      }
    }

    results.forEach((row, idx) => {
      row.rank = idx + 1;
    });
  } catch (error: any) {
    const msg = error.response?.data?.error || error.message;
    throw new Error(`SerpAPI error: ${msg}`);
  }

  return results;
}

