'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Save, Shield, Key, Globe, Map, Zap, CheckCircle2, 
  Share2, Settings, MessageSquare, Terminal, Search, 
  RefreshCw, Activity, AlertCircle, LayoutGrid, Database,
  Cpu, Rocket,   Lock, Wand2, ArrowRight, XCircle, Trash2,
  Plug, ZapOff, Upload, BarChart, TrendingUp, Info, HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { trackToolUsage, addHistory } from '@/shared/utils/metrics';
import { identifyKey, getFieldCapability } from '@/shared/utils/api-validator';
import { useSession, signIn } from "next-auth/react";

const SETTINGS_KEY = 'omnisuite_settings';

type OpenRouterModelMeta = {
  id: string;
  displayName: string;
  isFree: boolean;
  inputCostPer1M: number;
  outputCostPer1M: number;
  contextWindow: number;
  modality: string;
  category: 'balanced' | 'reasoning' | 'coding' | 'fast' | 'general';
};

interface SettingField {
  id: string;
  label: string;
  placeholder?: string;
  type: 'text' | 'password' | 'checkbox' | 'select' | 'file';
  options?: string[];
  tooltip?: string;
}

interface SettingSection {
  title: string;
  icon: any;
  description: string;
  fields: SettingField[];
}

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    openai_api_key: '',
    gemini_api_key: '',
    claude_api_key: '',
    groq_api_key: '',
    deepseek_api_key: '',
    openrouter_api_key: '',
    ollama_base_url: '',
    ollama_api_key: '',
    serpapi_key: '',
    pexels_api_key: '',
    outscraper_key: '',
    dataforseo_user: '',
    dataforseo_pass: '',
    google_maps_api_key: '',
    tavily_api_key: '',
    scraperapi_key: '',
    /** Khớp AI_SUPPORT_RUNNER_SECRET trong .env (nếu có) — header x-internal-token cho /run. */
    ai_support_runner_secret: '',
    // Google Search Console
    gsc_service_account_key: '',
    gsc_property_uri: '',
    gsc_use_oauth: false,
    // SEO toolkit extensions
    firecrawl_api_key: '',
    valueserp_api_key: '',
    keywords_everywhere_api_key: '',
    oncrawl_api_key: '',
    oncrawl_project_id: '',
    google_vision_api_key: '',
    google_ads_dev_token: '',
    ga4_property_id: '',
    woo_store_url: '',
    woo_consumer_key: '',
    woo_consumer_secret: '',
    // Content Tool
    default_provider: 'Gemini',
    default_model: 'gemini-1.5-pro'
  });

  const [isSaved, setIsSaved] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [openrouterCatalog, setOpenrouterCatalog] = useState<OpenRouterModelMeta[]>([]);
  const [openrouterFilter, setOpenrouterFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [keyAvailability, setKeyAvailability] = useState<{
    merged: Record<string, boolean>;
    envOnly: Record<string, boolean>;
  }>({ merged: {}, envOnly: {} });

  const syncKeyAvailability = useCallback((keysPayload?: Record<string, unknown>) => {
    const keys =
      keysPayload ??
      (() => {
        try {
          return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        } catch {
          return {};
        }
      })();
    fetch('/api/system/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    })
      .then((res) => res.json())
      .then((data: { merged?: Record<string, boolean>; envOnly?: Record<string, boolean> }) => {
        setKeyAvailability({
          merged: data.merged || {},
          envOnly: data.envOnly || {},
        });
      })
      .catch((err) => console.error('Failed to fetch system status', err));
  }, []);
  const [validationResults, setValidationResults] = useState<Record<string, { provider: string, status: 'valid'|'invalid'|'checking'|'mismatch', color: string }>>({});
  const [smartInput, setSmartInput] = useState('');
  const [smartStatus, setSmartStatus] = useState<{ type: 'success'|'error'|'idle', text: string }>({ type: 'idle', text: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: session } = useSession();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      addHistory('Hệ thống', 'Lỗi Upload', 'Vui lòng chọn file định dạng .json', 'failed');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        JSON.parse(content);
        setSettings(prev => ({ ...prev, gsc_service_account_key: content }));
        addHistory('Hệ thống', 'Cài đặt', `Đã nhận diện file Service Account: ${file.name}`, 'success');
      } catch (err) {
        addHistory('Hệ thống', 'Lỗi Key', 'Nội dung file JSON không hợp lệ.', 'failed');
      }
    };
    reader.readAsText(file);
  };

  const isGSCConnected = (session as any)?.scope?.includes('webmasters.readonly') || (session as any)?.scope?.includes('webmasters');

  const handleConnectGSC = () => {
    // Lưu trạng thái hiện tại vào localStorage trước khi chuyển hướng để không bị mất toggle
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    
    addHistory('Hệ thống', 'Kết nối', 'Đang chuyển hướng sang Google để cấp quyền...', 'info');
    signIn('google', { 
      callbackUrl: '/dashboard/settings',
      scope: 'openid email profile https://www.googleapis.com/auth/webmasters.readonly'
    });
  };

  useEffect(() => {
    if (isGSCConnected && settings.gsc_use_oauth) {
      addHistory('Hệ thống', 'Thành công', 'Đã kết nối thành công Google Search Console', 'success');
    }
  }, [isGSCConnected, settings.gsc_use_oauth]);

  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    let parsed: Record<string, unknown> = {};
    if (saved) {
      try {
        parsed = JSON.parse(saved);
        const migrated =
          typeof (parsed as Record<string, unknown>).internal_token === 'string' &&
          String((parsed as Record<string, unknown>).internal_token).trim() &&
          !(typeof (parsed as Record<string, unknown>).ai_support_runner_secret === 'string' &&
            String((parsed as Record<string, unknown>).ai_support_runner_secret).trim())
            ? {
                ...parsed,
                ai_support_runner_secret: String((parsed as Record<string, unknown>).internal_token),
              }
            : parsed;
        setSettings((prev) => ({ ...prev, ...migrated }));

        // Auto-fetch for initial provider if key exists
        const provider = (parsed.default_provider as string) || 'Gemini';
        let apiKey = '';
        if (provider === 'OpenAI') apiKey = (parsed.openai_api_key as string) || '';
        else if (provider === 'Gemini') apiKey = (parsed.gemini_api_key as string) || '';
        else if (provider === 'Claude') apiKey = (parsed.claude_api_key as string) || '';
        else if (provider === 'Groq') apiKey = (parsed.groq_api_key as string) || '';
        else if (provider === 'DeepSeek') apiKey = (parsed.deepseek_api_key as string) || '';
        else if (provider === 'OpenRouter') apiKey = (parsed.openrouter_api_key as string) || '';
        else if (provider === 'Ollama') apiKey = (parsed.ollama_api_key as string) || 'ollama';

        if (apiKey || provider === 'Ollama') {
          fetchModels(provider, apiKey, provider === 'Ollama' ? (parsed.ollama_base_url as string) : undefined);
        }
      } catch (e) {
        console.error('Failed to parse settings');
      }
    }
    syncKeyAvailability(parsed);
  }, [syncKeyAvailability]);

  // Automatic Key Recognition & Validation
  useEffect(() => {
    const timer = setTimeout(() => {
      const results: any = {};
      Object.entries(settings).forEach(([key, value]) => {
        if (typeof value !== 'string' || !value) return;
        const identification = identifyKey(value);
        if (identification) {
          const fieldType = key.split('_')[0]; 
          const providerMatch = identification.provider.toLowerCase() === fieldType;
          results[key] = {
            provider: identification.provider,
            status: providerMatch ? 'valid' : 'mismatch',
            color: identification.color
          };
        }
      });
      setValidationResults(results);
    }, 1000);
    return () => clearTimeout(timer);
  }, [settings]);

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    syncKeyAvailability(settings as unknown as Record<string, unknown>);
    setIsSaved(true);
    addHistory('Hệ thống', 'Lưu cấu hình', 'Đã cập nhật toàn bộ API Keys và cài đặt.', 'success');
    setTimeout(() => setIsSaved(false), 3000);
  };

  const fetchModels = async (providerOverride?: string, keyOverride?: string, baseUrlOverride?: string) => {
    const provider = providerOverride || settings.default_provider;
    let apiKey = keyOverride || '';
    let customBaseUrl: string | undefined;
    
    if (!keyOverride) {
      if (provider === 'OpenAI') apiKey = settings.openai_api_key;
      else if (provider === 'Gemini') apiKey = settings.gemini_api_key;
      else if (provider === 'Claude') apiKey = settings.claude_api_key;
      else if (provider === 'Groq') apiKey = settings.groq_api_key;
      else if (provider === 'DeepSeek') apiKey = settings.deepseek_api_key;
      else if (provider === 'OpenRouter') apiKey = settings.openrouter_api_key;
      else if (provider === 'Ollama') {
        apiKey = settings.ollama_api_key || 'ollama';
        customBaseUrl = settings.ollama_base_url || undefined;
      }
    } else if (provider === 'Ollama') {
      customBaseUrl = baseUrlOverride || settings.ollama_base_url || undefined;
    }

    if (!apiKey && provider !== 'Ollama') return;

    setIsFetchingModels(true);
    try {
      const resp = await fetch('/api/list-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey || 'ollama',
          ...(customBaseUrl || provider === 'Ollama' ? { customBaseUrl: customBaseUrl || settings.ollama_base_url } : {}),
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Không thể hỗ trợ quét Model");
      
      setAvailableModels(data.models);
      setOpenrouterCatalog(Array.isArray(data.openrouterCatalog) ? data.openrouterCatalog : []);
      addHistory('Hệ thống', 'Quét Model', `Đã tìm thấy ${data.models.length} model cho ${provider}`, 'success');
      return data.models;
    } catch (err: any) {
      addHistory('Hệ thống', 'Lỗi Quét Model', err.message, 'failed');
      setOpenrouterCatalog([]);
      return null;
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSmartConnect = async (val: string) => {
    setSmartInput(val);
    if (!val) {
      setSmartStatus({ type: 'idle', text: '' });
      return;
    }

    const identification = identifyKey(val);
    if (identification) {
      const provider = identification.provider;
      const fieldName = `${provider.toLowerCase()}_api_key`;
      
      if ((settings as any)[fieldName] !== undefined) {
        setSmartStatus({ type: 'success', text: `Đang kết nối ${provider}...` });
        
        setSettings(prev => ({
          ...prev,
          [fieldName]: val,
          default_provider: provider
        }));

        const models = await fetchModels(provider, val);
        if (models && models.length > 0) {
          setSmartStatus({ type: 'success', text: `Đã kết nối thành công ${provider}!` });
          setSmartInput('');
          setTimeout(() => setSmartStatus({ type: 'idle', text: '' }), 3000);
        } else {
          setSmartStatus({ type: 'success', text: `Đã dán Key ${provider}.` });
        }
      }
    } else {
      setSmartStatus({ type: 'error', text: 'Chưa nhận diện được loại Key này.' });
    }
  };

  const disconnectProvider = (providerId: string) => {
    if (providerId === 'Ollama') {
      setSettings(prev => ({ ...prev, ollama_api_key: '', ollama_base_url: '' }));
      addHistory('Hệ thống', 'Ngắt kết nối', 'Đã xóa cấu hình Ollama (URL / key).', 'info');
      return;
    }
    const fieldName = `${providerId.toLowerCase()}_api_key`;
    setSettings(prev => ({ ...prev, [fieldName]: '' }));
    addHistory('Hệ thống', 'Ngắt kết nối', `Đã xóa Key của ${providerId}`, 'info');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as any;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setSettings(prev => ({ ...prev, [name]: val }));
    
    // Auto-fetch models when provider changes
    if (name === 'default_provider') {
      const provider = value;
      let apiKey = '';
      if (provider === 'OpenAI') apiKey = settings.openai_api_key;
      else if (provider === 'Gemini') apiKey = settings.gemini_api_key;
      else if (provider === 'Claude') apiKey = settings.claude_api_key;
      else if (provider === 'Groq') apiKey = settings.groq_api_key;
      else if (provider === 'DeepSeek') apiKey = settings.deepseek_api_key;
      else if (provider === 'OpenRouter') apiKey = settings.openrouter_api_key;
      else if (provider === 'Ollama') apiKey = settings.ollama_api_key || 'ollama';
      
      if (apiKey || provider === 'Ollama') {
        fetchModels(provider, apiKey, provider === 'Ollama' ? settings.ollama_base_url : undefined);
      }
    }
  };
  
  const handleClearServiceAccount = () => {
    setSettings(prev => ({ ...prev, gsc_service_account_key: '' }));
    addHistory('Hệ thống', 'Xóa cấu hình', 'Đã xóa Service Account Key.', 'info');
  };

  const handleDisconnectGSCSession = () => {
    // Note: This won't technically log them out of Google, but will toggle preferred method off
    setSettings(prev => ({ ...prev, gsc_use_oauth: false }));
    addHistory('Hệ thống', 'Ngắt kết nối', 'Đã ngắt kết nối Google Search Console.', 'info');
  };

  const activeProviders = [
    { id: 'OpenAI', key: settings.openai_api_key, icon: Cpu },
    { id: 'Gemini', key: settings.gemini_api_key, icon: MessageSquare },
    { id: 'Claude', key: settings.claude_api_key, icon: Rocket },
    { id: 'Groq', key: settings.groq_api_key, icon: Zap },
    { id: 'DeepSeek', key: settings.deepseek_api_key, icon: Zap },
    { id: 'OpenRouter', key: settings.openrouter_api_key, icon: Globe },
    ...(settings.ollama_base_url?.trim() ||
    settings.ollama_api_key?.trim() ||
    settings.default_provider === 'Ollama'
      ? [{ id: 'Ollama' as const, key: settings.ollama_api_key || settings.ollama_base_url || 'local', icon: HardDrive }]
      : []),
  ].filter(p => p.key);

  const sections: SettingSection[] = [
    {
      title: 'Kết nối AI Thông minh',
      icon: Cpu,
      description: 'Hệ thống tự động nhận diện Key và Model viết bài.',
      fields: [
        { id: 'default_provider', label: 'Nhà cung cấp AI mặc định', type: 'select', options: ['OpenAI', 'Gemini', 'Claude', 'Groq', 'DeepSeek', 'OpenRouter', 'Ollama'] },
        { id: 'default_model', label: 'Model viết bài mặc định', type: availableModels.length > 0 ? 'select' : 'text', options: availableModels, placeholder: 'Quét để xem model' },
        { id: 'openrouter_api_key', label: 'OpenRouter API Key', placeholder: 'sk-or-v1-...', type: 'password' },
        {
          id: 'ollama_base_url',
          label: 'Ollama — URL máy chủ',
          placeholder: 'http://localhost:11434 (mặc định nếu để trống)',
          type: 'text',
          tooltip:
            'Chạy local: để trống hoặc ghi http://localhost:11434 (Ollama mặc định). Remote/tunnel: dán origin không có /v1, ví dụ https://xxx.trycloudflare.com — có thể dán cả /v1/chat/completions, hệ thống chuẩn hóa.',
        },
        {
          id: 'ollama_api_key',
          label: 'Ollama — API Key (tuỳ chọn)',
          placeholder: 'Token tunnel/reverse proxy (nếu có)',
          type: 'password',
          tooltip: 'Colab tunnel thường không cần key. Chỉ điền khi endpoint của bạn yêu cầu Bearer token.',
        },
      ]
    },
    {
      title: 'SEO & Search Hub',
      icon: TrendingUp,
      description: 'Nghiên cứu từ khóa & hình ảnh SEO.',
      fields: [
        { id: 'serpapi_key', label: 'SerpApi Key', placeholder: 'Google Maps/Images key', type: 'password' },
        { id: 'pexels_api_key', label: 'Pexels API Key', placeholder: 'Key kho ảnh stock', type: 'password' },
        { id: 'dataforseo_user', label: 'DataForSEO Login', placeholder: 'ID đăng nhập', type: 'text' },
        { id: 'dataforseo_pass', label: 'DataForSEO Pass', placeholder: 'Mật khẩu API', type: 'password' },
        { id: 'tavily_api_key', label: 'Tavily Search API', placeholder: 'tvly-...', type: 'password' },
      ]
    },
    {
      title: 'Google Search Console',
      icon: BarChart,
      description: 'lấy data từ web của bạn',
      fields: [
        { 
          id: 'gsc_service_account_key', 
          label: 'Upload file Service Account Key (.json)', 
          type: 'file',
          tooltip: 'Nâng cao: Sử dụng cho hệ thống tự động chạy ngầm. Cần file JSON từ Google Cloud Console đã được cấp quyền.'
        },
        { 
          id: 'gsc_property_uri', 
          label: 'Property URI (Domain cần theo dõi)', 
          placeholder: 'https://vutabranding.com/ hoặc sc-domain:vutabranding.com', 
          type: 'text',
          tooltip: 'Nhập URL website (ví dụ: https://example.com/) hoặc sc-domain:example.com để định danh dữ liệu cần lấy.'
        },
        { 
          id: 'gsc_use_oauth', 
          label: 'Đồng bộ qua tài khoản Google Login', 
          type: 'checkbox',
          tooltip: 'Khuyên dùng: Kết nối trực tiếp bằng tài khoản Google cá nhân. Tiện lợi và nhanh chóng nhất.'
        },
      ]
    },
    {
      title: 'Technical Integration',
      icon: Zap,
      description: 'Cấu hình tích hợp kỹ thuật.',
      fields: [
        {
          id: 'ai_support_runner_secret',
          label: 'Runner secret (AI_SUPPORT_RUNNER_SECRET)',
          placeholder: 'Chỉ khi .env có AI_SUPPORT_RUNNER_SECRET=...',
          type: 'password',
          tooltip:
            'Biến riêng cho runner — không dùng INTERNAL_TOKEN (tránh trùng biến môi trường Windows). Để trống .env + để trống ô này = /run không cần header.',
        },
        { id: 'scraperapi_key', label: 'ScraperAPI Key', placeholder: 'Key proxy cào dữ liệu', type: 'password' },
      ]
    },
    {
      title: 'Tích hợp SEO mở rộng',
      icon: Plug,
      description: 'Bổ sung cho các công cụ trong Bộ công cụ SEO.',
      fields: [
        { id: 'firecrawl_api_key', label: 'Firecrawl API Key', placeholder: 'fc-...', type: 'password', tooltip: 'Dùng cho Firecrawl Markdown Scraper, LLM Sitemap Creator (chế độ deep crawl).' },
        { id: 'valueserp_api_key', label: 'ValueSERP API Key', placeholder: 'Key SERP HTML JSON', type: 'password', tooltip: 'Dùng cho N-Gram SERP, Related Searches Tree khi không dùng SerpApi.' },
        { id: 'keywords_everywhere_api_key', label: 'Keywords Everywhere Key', placeholder: 'KE API key', type: 'password', tooltip: 'Volume/CPC/Competition cho Keywords Everywhere tool.' },
        { id: 'oncrawl_api_key', label: 'OnCrawl API Key', placeholder: 'Bearer token', type: 'password', tooltip: 'OnCrawl Extractor.' },
        { id: 'oncrawl_project_id', label: 'OnCrawl Project ID', placeholder: 'project_xxx', type: 'text' },
        { id: 'google_vision_api_key', label: 'Google Vision API Key', placeholder: 'AIza...', type: 'password', tooltip: 'Background Detector, High-Res Image Finder.' },
        { id: 'google_ads_dev_token', label: 'Google Ads Developer Token', placeholder: 'Dev token', type: 'password', tooltip: 'Phân loại keyword Google Ads.' },
        { id: 'ga4_property_id', label: 'GA4 Property ID', placeholder: 'properties/123456789', type: 'text', tooltip: 'BCG Matrix, Forecast Inventory Trends.' },
      ]
    },
    {
      title: 'WooCommerce REST',
      icon: Database,
      description: 'Cho Woo Relevancy & Category Migration.',
      fields: [
        { id: 'woo_store_url', label: 'Store URL', placeholder: 'https://shop.example.com', type: 'text' },
        { id: 'woo_consumer_key', label: 'Consumer Key', placeholder: 'ck_...', type: 'password' },
        { id: 'woo_consumer_secret', label: 'Consumer Secret', placeholder: 'cs_...', type: 'password' },
      ]
    }
  ];

  return (
    <div className="settings-theme-fix max-w-7xl mx-auto pb-20 font-sans px-4">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row justify-between items-center p-10 rounded-[3rem] mb-12 gap-8 shadow-2xl backdrop-blur-xl relative overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-black tracking-tighter flex items-center justify-center md:justify-start gap-4" style={{ color: 'var(--text-primary)' }}>
            <div className="p-2.5 rounded-2xl shadow-xl" style={{ backgroundColor: '#6366f1', boxShadow: '0 10px 30px rgba(99,102,241,0.3)' }}>
              <Settings className="text-white" size={32} />
            </div>
            Cấu hình Hệ thống
          </h1>
          <div className="flex items-center gap-2 mt-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            <Shield size={14} style={{ color: '#f59e0b' }} />
            Bảo mật tuyệt đối: 
            <span style={{ color: '#f59e0b' }}>Dữ liệu lưu tại LocalStorage thiết bị.</span>
            <span>Không thu thập Key của bạn.</span>
          </div>
        </div>
        <button
          onClick={handleSave}
          className={`group px-10 py-6 rounded-3xl font-black text-xl flex items-center gap-3 transition-all duration-300 shadow-2xl ${
            isSaved ? 'bg-emerald-500 text-white scale-95' : 'text-white active:scale-95'
          }`}
          style={isSaved ? {} : { backgroundColor: '#6366f1', boxShadow: '0 10px 30px rgba(99,102,241,0.3)' }}
        >
          {isSaved ? <CheckCircle2 size={24} /> : <Save size={24} />}
          {isSaved ? 'Đã lưu' : 'Lưu cài đặt'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Special AI Providers Section - Unified */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 glass rounded-[2.5rem] p-10 border border-indigo-500/20 shadow-2xl flex flex-col gap-8 relative overflow-hidden h-fit">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[80px] pointer-events-none" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
               <div className="p-4 rounded-2xl text-white shadow-lg" style={{ backgroundColor: '#6366f1', boxShadow: '0 10px 30px rgba(99,102,241,0.3)' }}>
                 <Wand2 size={28} />
               </div>
               <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>KẾT NỐI AI THÔNG MINH</h2>
                  <p className="text-sm font-medium uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>Hệ thống tự nhận diện Provider từ Key</p>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Input Side */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-1">PASTE KEY VÀO ĐÂY</label>
                <div className="relative group">
                  <input
                    type="text"
                    value={smartInput}
                    onChange={(e) => handleSmartConnect(e.target.value)}
                    placeholder="Dán OpenAI, Gemini, Claude hoặc Groq Key..."
                    className="w-full rounded-2xl py-6 px-14 text-lg focus:outline-none focus:ring-4 transition-all font-mono placeholder:font-sans"
                    style={{ backgroundColor: 'var(--hover-bg)', border: '2px solid rgba(99,102,241,0.2)', color: 'var(--text-primary)' }}
                  />
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500" style={{ color: 'var(--text-muted)' }}>
                    <Zap size={24} />
                  </div>
                  {isFetchingModels && (
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-indigo-400">
                      <RefreshCw size={24} className="animate-spin" />
                    </div>
                  )}
                </div>
                <AnimatePresence>
                  {smartStatus.text && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      className={`text-xs font-black p-3 rounded-xl flex items-center gap-2 ${smartStatus.type === 'success' ? 'text-emerald-400 bg-emerald-500/5' : 'text-red-400 bg-red-500/5'}`}
                    >
                      {smartStatus.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      {smartStatus.text}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {sections[0].fields.map(field => {
                  const dashVal = (settings as Record<string, unknown>)[field.id];
                  const hasDashboardKey =
                    typeof dashVal === 'string'
                      ? dashVal.trim().length > 0
                      : typeof dashVal === 'boolean'
                        ? dashVal
                        : false;
                  const showEnvBadge =
                    field.type !== 'select' &&
                    !!keyAvailability.envOnly[field.id] &&
                    !hasDashboardKey;

                  return (
                    <div key={field.id} className="space-y-2 flex flex-col">
                      <div className="flex justify-between items-center pr-1">
                        <label className="text-[10px] font-black uppercase tracking-widest min-h-[24px] flex items-center" style={{ color: 'var(--text-muted)' }}>{field.label}</label>
                        {showEnvBadge && (
                          <span className="text-[8px] font-black text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded uppercase tracking-tighter">Fallback máy chủ (.env)</span>
                        )}
                      </div>
                      <div className="relative">
                          {field.type === 'select' ? (
                            <div className="relative w-full">
                              <select
                                name={field.id} value={(settings as any)[field.id]} onChange={handleChange}
                                className="w-full h-12 rounded-xl px-4 text-xs font-medium focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer leading-none"
                                style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--text-primary)' }}
                              >
                                <option value="">{isFetchingModels && field.id === 'default_model' ? '-- Đang tự động tìm Model... --' : `-- Chọn ${field.label} --`}</option>
                                {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                              {isFetchingModels && field.id === 'default_model' && (
                                <div className="absolute right-10 top-1/2 -translate-y-1/2 text-indigo-400">
                                  <RefreshCw size={12} className="animate-spin" />
                                </div>
                              )}
                            </div>
                          ) : (
                          <div className="relative group">
                            <input
                              type={field.type === 'password' ? 'password' : 'text'} name={field.id} value={(settings as any)[field.id]} onChange={handleChange} placeholder={showEnvBadge ? 'Đang dùng key trên máy chủ (.env). Nhập key tại đây để chỉ dùng trên trình duyệt này…' : field.placeholder}
                              className="w-full h-12 rounded-xl pl-10 pr-4 text-xs font-medium focus:outline-none focus:ring-2 font-mono leading-none"
                              style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--text-primary)' }}
                            />
                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500" style={{ color: 'var(--text-muted)' }}><Rocket size={14} /></div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {settings.default_provider === 'OpenRouter' && openrouterCatalog.length > 0 && (
                <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                      OpenRouter Model Insight
                    </p>
                    <div className="flex items-center gap-2">
                      {(['all', 'free', 'paid'] as const).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setOpenrouterFilter(filter)}
                          className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition"
                          style={{
                            backgroundColor: openrouterFilter === filter ? 'rgba(99,102,241,0.2)' : 'var(--hover-bg)',
                            color: openrouterFilter === filter ? '#818cf8' : 'var(--text-muted)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          {filter === 'all' ? 'Tất cả' : filter === 'free' ? 'Free' : 'Trả phí'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {openrouterCatalog
                      .filter((m) => {
                        if (openrouterFilter === 'free') return m.isFree;
                        if (openrouterFilter === 'paid') return !m.isFree;
                        return true;
                      })
                      .slice(0, 30)
                      .map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSettings((prev) => ({ ...prev, default_model: m.id }))}
                          className="w-full text-left rounded-xl px-3 py-2.5 transition hover:opacity-90"
                          style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)' }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-black truncate" style={{ color: 'var(--text-primary)' }}>
                              {m.displayName}
                            </p>
                            <span
                              className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full"
                              style={{
                                color: m.isFree ? '#34d399' : '#f59e0b',
                                backgroundColor: m.isFree ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                              }}
                            >
                              {m.isFree ? 'FREE' : 'PAID'}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-3 text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>
                            <span>{m.category.toUpperCase()}</span>
                            <span>{m.contextWindow > 0 ? `${Math.round(m.contextWindow / 1000)}k ctx` : 'ctx ?'}</span>
                            <span>${m.inputCostPer1M.toFixed(2)}/1M in</span>
                            <span>${m.outputCostPer1M.toFixed(2)}/1M out</span>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Status Side */}
            <div className="lg:col-span-5 rounded-3xl p-6 flex flex-col gap-6" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(99,102,241,0.2)' }}>
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                 <Plug size={12} /> CÁC KẾT NỐI ĐANG HOẠT ĐỘNG
               </h3>
               
               <div className="space-y-3">
                 {activeProviders.length > 0 ? (
                   activeProviders.map(p => (
                     <div key={p.id} className="p-4 rounded-2xl flex items-center justify-between group/p" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}><p.icon size={16} style={{ color: '#6366f1' }} /></div>
                          <div>
                            <p className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>{p.id}</p>
                            <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>MASKED: {p.key.slice(0, 4)}••••{p.key.slice(-4)}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => disconnectProvider(p.id)}
                          className="p-2 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-all opacity-0 group-hover/p:opacity-100"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <ZapOff size={16} />
                        </button>
                     </div>
                   ))
                 ) : (
                   <div className="py-10 text-center border-2 border-dashed rounded-2xl" style={{ borderColor: 'var(--border-color)' }}>
                      <p className="text-[10px] font-black uppercase tracking-widest px-4" style={{ color: 'var(--text-muted)' }}>Chưa có kết nối nào. Hãy dán Key để bắt đầu.</p>
                   </div>
                 )}
               </div>
            </div>
          </div>
        </div>

        {/* Other Sections */}
        {sections.slice(1).map((section, idx) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
            className="rounded-[2rem] p-8 flex flex-col h-full transition-all shadow-xl group relative overflow-hidden"
            style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-2xl transition-all transform group-hover:rotate-6" style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}>
                <section.icon size={20} style={{ color: '#6366f1' }} />
              </div>
              <div>
                <h2 className="text-sm font-black tracking-tight uppercase leading-tight" style={{ color: 'var(--text-primary)' }}>{section.title}</h2>
                <p className="text-[9px] font-bold mt-0.5 tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>{section.description}</p>
              </div>
            </div>

            <div className="space-y-6 flex-1">
              {section.fields.map(field => {
                  const dashVal = (settings as Record<string, unknown>)[field.id];
                  const hasDashboardKey =
                    typeof dashVal === 'string'
                      ? dashVal.trim().length > 0
                      : typeof dashVal === 'boolean'
                        ? dashVal
                        : false;
                  const showEnvBadge =
                    field.type !== 'select' &&
                    field.type !== 'checkbox' &&
                    field.type !== 'file' &&
                    !!keyAvailability.envOnly[field.id] &&
                    !hasDashboardKey;
                  return (
                    <div key={field.id} className="space-y-1.5">
                      <div className="relative mb-1.5 ml-1">
                        <div className="group/tooltip inline-flex items-center gap-1.5 cursor-help">
                          <label className="text-[9px] font-black uppercase text-indigo-400 group-hover/tooltip:text-indigo-300 transition-colors">{field.label}</label>
                          {field.tooltip && (
                            <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-[#0a0f1e] text-[10px] font-bold text-slate-300 rounded-xl border border-indigo-500/30 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-300 shadow-2xl z-[100] backdrop-blur-xl">
                              <div className="absolute -bottom-1 left-4 w-2 h-2 bg-[#0a0f1e] border-b border-r border-indigo-500/30 rotate-45" />
                              <div className="flex items-start gap-2">
                                <Info size={12} className="text-indigo-400 mt-0.5 shrink-0" />
                                <p className="leading-relaxed whitespace-normal">{field.tooltip}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="relative group">
                        {field.type === 'file' ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileUpload}
                              className="hidden"
                              accept=".json"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black transition-all border-2 border-dashed uppercase tracking-wider"
                                style={{ 
                                  backgroundColor: 'var(--hover-bg)', 
                                  borderColor: (settings as any)[field.id] ? '#10b981' : 'rgba(99,102,241,0.2)',
                                  color: (settings as any)[field.id] ? '#10b981' : 'var(--text-muted)'
                                }}
                              >
                                <Upload size={14} />
                                {(settings as any)[field.id] ? 'ĐÃ NẠP SERVICE ACCOUNT' : 'TẢI LÊN SERVICE ACCOUNT'}
                              </button>
                              
                              {(settings as any)[field.id] && (
                                <button
                                  onClick={handleClearServiceAccount}
                                  className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg"
                                  title="Xóa Key hiện tại"
                                  type="button"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </div>
                        ) : field.type === 'select' ? (
                          <div className="relative w-full">
                            <select
                              name={field.id}
                              value={(settings as any)[field.id]}
                              onChange={handleChange}
                              className="w-full h-12 rounded-xl px-10 text-xs font-medium focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer leading-none"
                              style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--text-primary)' }}
                            >
                              <option value="">-- Chọn {field.label} --</option>
                              {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                              <ArrowRight size={12} className="rotate-90" />
                            </div>
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500" style={{ color: 'var(--text-muted)' }}><Globe size={14} /></div>
                          </div>
                        ) : field.id === 'gsc_use_oauth' ? (
                          <div className="space-y-3">
                             <div className="flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)' }} onClick={() => {
                              const e = { target: { name: field.id, value: !(settings as any)[field.id], type: 'checkbox', checked: !(settings as any)[field.id] } };
                              handleChange(e as any);
                            }}>
                               <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${(settings as any)[field.id] ? '' : ''}`} style={{ backgroundColor: (settings as any)[field.id] ? '#6366f1' : 'var(--hover-bg)', borderColor: (settings as any)[field.id] ? '#6366f1' : 'var(--border-color)' }}>
                                 {(settings as any)[field.id] && <CheckCircle2 size={14} className="text-white" />}
                               </div>
                               <span className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--text-secondary)' }}>DÙNG OAUTH</span>
                            </div>
                            
                            {(settings as any).gsc_use_oauth && (
                              <div className="flex flex-col gap-2 w-full">
                                {isGSCConnected ? (
                                  <>
                                    <div className="w-full h-10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black border border-emerald-500/30 bg-emerald-500/5 text-emerald-500">
                                      <CheckCircle2 size={14} /> ĐÃ KẾT NỐI GOOGLE SEARCH CONSOLE
                                    </div>
                                    <button
                                      onClick={handleDisconnectGSCSession}
                                      className="w-full h-10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black transition-all border border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white"
                                    >
                                      <ZapOff size={14} /> NGẮT KẾT NỐI
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={handleConnectGSC}
                                    className="w-full h-10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black transition-all border border-indigo-500/30 bg-indigo-500/5 text-indigo-500 hover:bg-indigo-500 hover:text-white"
                                  >
                                    <Plug size={14} /> BẤM ĐỂ KẾT NỐI SEARCH CONSOLE
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : field.type === 'checkbox' ? (
                          <div className="flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)' }} onClick={() => {
                            const e = { target: { name: field.id, value: !(settings as any)[field.id], type: 'checkbox', checked: !(settings as any)[field.id] } };
                            handleChange(e as any);
                          }}>
                             <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${(settings as any)[field.id] ? '' : ''}`} style={{ backgroundColor: (settings as any)[field.id] ? '#6366f1' : 'var(--hover-bg)', borderColor: (settings as any)[field.id] ? '#6366f1' : 'var(--border-color)' }}>
                               {(settings as any)[field.id] && <CheckCircle2 size={14} className="text-white" />}
                             </div>
                             <span className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--text-secondary)' }}>KÍCH HOẠT</span>
                          </div>
                        ) : (
                          <>
                            <input
                              type={field.type} name={field.id} value={(settings as any)[field.id] || ''} onChange={handleChange} 
                              placeholder={showEnvBadge ? 'Đang dùng key trên máy chủ (.env). Nhập key tại đây để chỉ dùng trên trình duyệt này…' : field.placeholder}
                              className="w-full h-12 rounded-xl px-10 text-xs font-medium focus:outline-none focus:ring-2 font-mono leading-none"
                              style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--text-primary)' }}
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500 font-black" style={{ color: 'var(--text-muted)' }}>
                              {showEnvBadge ? (
                                <div className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center -ml-1"><CheckCircle2 size={12} className="text-sky-400" /></div>
                              ) : (
                                <Key size={12} />
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      <footer className="mt-20 py-10 text-center" style={{ borderTop: '1px solid var(--border-color)' }}>
        <p className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: 'var(--text-muted)' }}>OmniSuite AI Orchestrator 2026</p>
      </footer>
    </div>
  );
}
