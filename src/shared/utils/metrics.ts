export const METRICS_KEY = 'omnisuite_metrics';

export interface AppMetrics {
  api_calls: {
    OpenAI: number;
    Gemini: number;
    Claude: number;
    Groq: number;
    SerpAPI: number;
    DataForSEO: number;
    Maps: number;
    Outscraper: number;
    Custom: number;
  };
  tool_usage: {
    content: number;
    keywords: number;
    images: number;
    maps: number;
    scraper: number;
  };
  files_exported: number;
  history: HistoryItem[];
}

export interface HistoryItem {
  id: string;
  tool: string;
  action: string;
  details: string;
  status: 'success' | 'failed' | 'info';
  timestamp: string;
}

export const initialMetrics: AppMetrics = {
  api_calls: { OpenAI: 0, Gemini: 0, Claude: 0, Groq: 0, SerpAPI: 0, DataForSEO: 0, Maps: 0, Outscraper: 0, Custom: 0 },
  tool_usage: { content: 0, keywords: 0, images: 0, maps: 0, scraper: 0 },
  files_exported: 0,
  history: [],
};

export const getMetrics = (): AppMetrics => {
  if (typeof window === 'undefined') return initialMetrics;
  const saved = localStorage.getItem(METRICS_KEY);
  if (!saved) return initialMetrics;
  try {
    const parsed = JSON.parse(saved);
    return {
      ...initialMetrics,
      ...parsed,
      api_calls: { ...initialMetrics.api_calls, ...(parsed.api_calls || {}) },
      tool_usage: { ...initialMetrics.tool_usage, ...(parsed.tool_usage || {}) },
      history: parsed.history || []
    };
  } catch (e) {
    return initialMetrics;
  }
};

export const saveMetrics = (metrics: AppMetrics) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
};

export const trackAPICall = (provider: string) => {
  const metrics = getMetrics();
  const p = (provider || 'Custom') as keyof AppMetrics['api_calls'];
  if (metrics.api_calls[p] !== undefined) {
    metrics.api_calls[p]++;
  } else {
    metrics.api_calls.Custom++;
  }
  saveMetrics(metrics);
};

export const trackToolUsage = (tool: keyof AppMetrics['tool_usage']) => {
  const metrics = getMetrics();
  if (metrics.tool_usage[tool] !== undefined) {
    metrics.tool_usage[tool]++;
  }
  saveMetrics(metrics);
};

export const trackExport = () => {
  const metrics = getMetrics();
  metrics.files_exported++;
  saveMetrics(metrics);
};

export const addHistory = (tool: string, action: string, details: string, status: 'success' | 'failed' | 'info' = 'success') => {
  if (typeof window === 'undefined') return;
  const metrics = getMetrics();
  const newItem: HistoryItem = {
    id: Math.random().toString(36).substr(2, 9),
    tool,
    action,
    details,
    status,
    timestamp: new Date().toISOString()
  };
  metrics.history = [newItem, ...(metrics.history || [])].slice(0, 50); // Keep last 50
  saveMetrics(metrics);
};

export const resetMetrics = (): AppMetrics => {
  if (typeof window === 'undefined') return initialMetrics;
  localStorage.removeItem(METRICS_KEY);
  return initialMetrics;
};
