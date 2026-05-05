import { google } from 'googleapis';
import { getSystemConfig } from './config';

/**
 * Google Search Console API Helper
 * Supports both OAuth2 (User) and Service Account (System)
 */
export async function getGSCClient(authMethod: 'oauth' | 'service', credentials?: string | { access_token: string }) {
  const system = getSystemConfig();

  if (authMethod === 'service') {
    const keyString = typeof credentials === 'string' ? credentials : system.gsc_service_account_key;
    if (!keyString) throw new Error("Service Account Key missing for GSC");

    try {
      const key = JSON.parse(keyString);
      const auth = new google.auth.JWT({
        email: key.client_email,
        key: key.private_key,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
      });
      return google.searchconsole({ version: 'v1', auth });
    } catch (e) {
      throw new Error("Invalid Service Account JSON format");
    }
  } else {
    // OAuth2 Flow
    const token = (credentials as any)?.access_token;
    if (!token) throw new Error("OAuth token missing for GSC");

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: token });
    return google.searchconsole({ version: 'v1', auth: oauth2Client });
  }
}

/**
 * Normalizes property URI for GSC API
 */
export function normalizeSiteUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('https://') || url.startsWith('http://')) {
    return url.endsWith('/') ? url : url + '/';
  }
  if (!url.startsWith('sc-domain:')) {
    return `sc-domain:${url}`;
  }
  return url;
}

/**
 * Fetches basic time-series metrics
 */
export async function getSiteStats(client: any, siteUrl: string, days = 30) {
  const normalizedUrl = normalizeSiteUrl(siteUrl);
  
  const today = new Date();
  // Most recent GSC data is 2-3 days old.
  const endDate = new Date(today);
  endDate.setDate(today.getDate() - 3); 
  
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - days - 3); // Extra days to account for latency

  const formattedStartDate = startDate.toISOString().split('T')[0];
  const formattedEndDate = endDate.toISOString().split('T')[0];

  const response = await client.searchanalytics.query({
    siteUrl: normalizedUrl,
    requestBody: {
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      dimensions: ['date'],
      rowLimit: 1000
    }
  });

  return response.data.rows || [];
}

/**
 * Fetches high-level overview metrics
 */
export async function getGSCPropertyOverview(client: any, siteUrl: string) {
  const normalizedUrl = normalizeSiteUrl(siteUrl);
  
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() - 3);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 33);

  const response = await client.searchanalytics.query({
    siteUrl: normalizedUrl,
    requestBody: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      rowLimit: 1
    }
  });

  const totals = response.data.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return totals;
}

/**
 * Fetches page-level metrics to calculate active pages and decay
 */
export async function getGSCPageMetrics(client: any, siteUrl: string, days = 30) {
  const normalizedUrl = normalizeSiteUrl(siteUrl);
  
  const today = new Date();
  const endDateCurrent = new Date(today);
  endDateCurrent.setDate(today.getDate() - 3);
  const startDateCurrent = new Date(today);
  startDateCurrent.setDate(today.getDate() - days - 3);

  const res = await client.searchanalytics.query({
    siteUrl: normalizedUrl,
    requestBody: {
      startDate: startDateCurrent.toISOString().split('T')[0],
      endDate: endDateCurrent.toISOString().split('T')[0],
      dimensions: ['page'],
      rowLimit: 5000
    }
  });

  return res.data.rows || [];
}

/**
 * Fetches cannibalization candidates (queries with multiple pages)
 */
export async function getGSCCannibalization(client: any, siteUrl: string) {
  const normalizedUrl = normalizeSiteUrl(siteUrl);
  
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() - 3);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 30);

  const res = await client.searchanalytics.query({
    siteUrl: normalizedUrl,
    requestBody: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      dimensions: ['query', 'page'],
      rowLimit: 5000
    }
  });

  return res.data.rows || [];
}
