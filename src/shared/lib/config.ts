/**
 * Centralized Configuration Utility
 * Handles merging user-provided keys with global environment fallbacks.
 */

export interface SystemConfig {
  openai_api_key?: string;
  gemini_api_key?: string;
  claude_api_key?: string;
  groq_api_key?: string;
  deepseek_api_key?: string;
  openrouter_api_key?: string;
  serpapi_key?: string;
  tavily_api_key?: string;
  pexels_api_key?: string;
  outscraper_key?: string;
  dataforseo_user?: string;
  dataforseo_pass?: string;
  google_maps_api_key?: string;
  scraperapi_key?: string;
  wp_app_pass?: string;
  gsc_service_account_key?: string;
  gsc_property_uri?: string;
  // SEO toolkit extensions
  firecrawl_api_key?: string;
  valueserp_api_key?: string;
  keywords_everywhere_api_key?: string;
  oncrawl_api_key?: string;
  oncrawl_project_id?: string;
  google_vision_api_key?: string;
  google_ads_dev_token?: string;
  ga4_property_id?: string;
  woo_consumer_key?: string;
  woo_consumer_secret?: string;
  woo_store_url?: string;
}

export const getSystemConfig = (): SystemConfig => {
  return {
    openai_api_key: process.env.OPENAI_API_KEY,
    gemini_api_key: process.env.GEMINI_API_KEY,
    claude_api_key: process.env.CLAUDE_API_KEY,
    groq_api_key: process.env.GROQ_API_KEY,
    deepseek_api_key: process.env.DEEPSEEK_API_KEY,
    openrouter_api_key: process.env.OPENROUTER_API_KEY,
    serpapi_key: process.env.SERPAPI_KEY,
    tavily_api_key: process.env.TAVILY_API_KEY,
    pexels_api_key: process.env.PEXELS_API_KEY,
    outscraper_key: process.env.OUTSCRAPER_KEY,
    dataforseo_user: process.env.DATAFORSEO_USER,
    dataforseo_pass: process.env.DATAFORSEO_PASS,
    google_maps_api_key: process.env.GOOGLE_MAPS_API_KEY,
    scraperapi_key: process.env.SCRAPERAPI_KEY,
    wp_app_pass: process.env.WP_APP_PASS,
    gsc_service_account_key: process.env.GSC_SERVICE_ACCOUNT_JSON,
    gsc_property_uri: process.env.DEFAULT_GSC_PROPERTY_URI,
    firecrawl_api_key: process.env.FIRECRAWL_API_KEY,
    valueserp_api_key: process.env.VALUESERP_API_KEY,
    keywords_everywhere_api_key: process.env.KEYWORDS_EVERYWHERE_API_KEY,
    oncrawl_api_key: process.env.ONCRAWL_API_KEY,
    oncrawl_project_id: process.env.ONCRAWL_PROJECT_ID,
    google_vision_api_key: process.env.GOOGLE_VISION_API_KEY,
    google_ads_dev_token: process.env.GOOGLE_ADS_DEV_TOKEN,
    ga4_property_id: process.env.GA4_PROPERTY_ID,
    woo_consumer_key: process.env.WOO_CONSUMER_KEY,
    woo_consumer_secret: process.env.WOO_CONSUMER_SECRET,
    woo_store_url: process.env.WOO_STORE_URL,
  };
};

/**
 * Merges user-provided strings/keys with system defaults.
 */
export const mergeConfig = (userKeys: Record<string, any> = {}): SystemConfig => {
  const system = getSystemConfig();
  const merged: any = { ...system };

  // Overlay user keys if they are non-empty strings
  Object.keys(userKeys).forEach(key => {
    if (typeof userKeys[key] === 'string' && userKeys[key].trim() !== '') {
      merged[key] = userKeys[key];
    }
  });

  return merged;
};
