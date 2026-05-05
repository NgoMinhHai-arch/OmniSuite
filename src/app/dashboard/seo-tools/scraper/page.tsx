'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Download, 
  Trash2, 
  Eye, 
  Maximize2, 
  Minimize2,
  X, 
  Globe, 
  ShieldCheck, 
  Layout,
  Zap,
  Activity,
  ArrowRight,
  BrainCircuit,
  Target,
  RefreshCw
} from 'lucide-react';
import { MagicIcon } from '@/shared/ui/Icons';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import Typography from '@/shared/ui/Typography';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '@/shared/lib/context/TaskContext';

export default function ScraperPage() {
  const [urls, setUrls] = useState('');
  const [keywords, setKeywords] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [keywordMapping, setKeywordMapping] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [analyzingUrl, setAnalyzingUrl] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState('');
  const [analysisData, setAnalysisData] = useState<Record<string, any>>({});
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSiloEnabled, setIsSiloEnabled] = useState(false);
  const [isSiloAnalyzing, setIsSiloAnalyzing] = useState(false);
  const [isStructureDiscoveryEnabled, setIsStructureDiscoveryEnabled] = useState(false);
  
  // --- AI CONFIG STATE ---
   const [aiSettings, setAiSettings] = useState<any>(null);
   const [selectedProvider, setSelectedProvider] = useState('Gemini');
   const [selectedModel, setSelectedModel] = useState('');
   const [availableModels, setAvailableModels] = useState<string[]>([]);
   const [isLoadingModels, setIsLoadingModels] = useState(false);
  
  const [siloProgress, setSiloProgress] = useState({ current: 0, total: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [modalTab, setModalTab] = useState('overview');
  const { startTask, getTask } = useTasks();

  const STORAGE_KEY = 'omnisuite_scraper_state';
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- RE-ATTACH TO BACKGROUND TASK ---
  useEffect(() => {
    const activeTask = getTask('seo_scraper');
    if (activeTask && activeTask.status === 'running') {
      setIsLoading(true);
      setResults(activeTask.results || []);
      if (activeTask.progress) setSearchStatus(activeTask.progress);
      
      const interval = setInterval(() => {
        const t = getTask('seo_scraper');
        if (t) {
          setResults([...t.results]);
          setSearchStatus(t.progress);
          if (t.status !== 'running') {
            setIsLoading(false);
            clearInterval(interval);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [getTask]);

  // --- DATA FETCHING & PERSISTENCE ---
  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/scrape/history');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setResults(data);
        }
      }
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  };

  const handleClearHistory = async () => {
     if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử quét không?")) return;
     try {
        const res = await fetch('/api/scrape/history', { method: 'DELETE' });
        if (res.ok) {
           setResults([]);
           sessionStorage.removeItem(STORAGE_KEY);
        }
     } catch (e) {
        console.error("Failed to clear history:", e);
     }
  };

  useEffect(() => {
    // Try sessionStorage first (for session consistency)
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { results: r, urls: u, keywords: k, analysisData: a, keywordMapping: km } = JSON.parse(saved);
        if (r && r.length > 0) {
            setResults(r);
            if (u) setUrls(u);
            if (k) setKeywords(k);
            if (a) setAnalysisData(a);
            if (km) setKeywordMapping(km);
            return; // Found in session, stop here
        }
      } catch (e) {}
    }
    
    // Fallback to Database History
    fetchHistory();
  }, []);

  useEffect(() => {
      const saved = localStorage.getItem('omnisuite_settings');
      if (saved) {
         try {
            const parsed = JSON.parse(saved);
            setAiSettings(parsed);
            
            const provider = parsed.default_provider || 'Gemini';
            setSelectedProvider(provider);
            setSelectedModel(parsed.default_model || '');
            
            // Auto fetch on load
            triggerFetchModels(provider, parsed);
         } catch (e) {
            console.error('Failed to parse settings');
         }
      }
   }, []);

   const triggerFetchModels = async (provider: string, settings: any) => {
      if (!settings) return;
      setIsLoadingModels(true);
      
      let apiKey = '';
      if (provider === 'OpenAI') apiKey = settings.openai_api_key;
      else if (provider === 'Gemini') apiKey = settings.gemini_api_key;
      else if (provider === 'Claude') apiKey = settings.claude_api_key;
      else if (provider === 'Groq') apiKey = settings.groq_api_key;
      else if (provider === 'DeepSeek') apiKey = settings.deepseek_api_key;
      else if (provider === 'OpenRouter') apiKey = settings.openrouter_api_key;

      if (!apiKey) {
         setIsLoadingModels(false);
         // Fallback to defaults if no key
         const modelMap: Record<string, string[]> = {
            'Gemini': ['gemini-1.5-pro', 'gemini-1.5-flash'],
            'OpenAI': ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
            'Claude': ['anthropic/claude-3-5-sonnet-latest', 'anthropic/claude-3-5-haiku-latest'],
            'Groq': ['groq/llama-3.3-70b-versatile'],
            'DeepSeek': ['deepseek-chat'],
            'OpenRouter': ['openrouter/google/gemini-2.0-flash-001']
         };
         setAvailableModels(modelMap[provider] || []);
         return;
      }

      try {
         const resp = await fetch('/api/list-models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, apiKey })
         });
         const data = await resp.json();
         if (data.models) {
            setAvailableModels(data.models);
         }
      } catch (err) {
         console.error('Fetch models error:', err);
      } finally {
         setIsLoadingModels(false);
      }
   };

   // Update models when provider changes
   const handleProviderChange = (provider: string) => {
      setSelectedProvider(provider);
      triggerFetchModels(provider, aiSettings);
   };

  const getSEOAction = (r: any) => {
    if (r.statusCode && r.statusCode !== 200) return `Lỗi ${r.statusCode}`;
    if (!r.title || r.title === 'N/A') return 'Thiếu Title';
    if (!r.description || r.description === 'N/A') return 'Thiếu mô tả';
    if (r.titleLength < 50 || r.titleLength > 60) return 'Tối ưu Title';
    if (r.descriptionLength < 150 || r.descriptionLength > 160) return 'Tối ưu mô tả';
    return 'Đã xong';
  };

  const getStatusColor = (status: number) => {
    if (!status || status === 200) return 'text-emerald-400';
    if (status >= 400) return 'text-rose-400';
    return 'text-amber-400';
  };

  useEffect(() => {
    if (results.length > 0 || urls || keywords || Object.keys(analysisData).length > 0) {
      const state = { results, urls, keywords, analysisData, keywordMapping };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [results, urls, keywords, analysisData, keywordMapping]);

  const handleSearchKeywords = async () => {
    if (!keywords.trim()) return;
    setIsLoading(true);
    setResults([]);

    const inputLines = keywords.split(/[\n,]/).map(k => k.trim()).filter(k => k).slice(0, 5);
    const isDomainOnly = inputLines.every(line => /^https?:\/\/[^\s]+$/.test(line) || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?$/.test(line));
    const triggerDiscovery = isStructureDiscoveryEnabled || isDomainOnly;

    if (triggerDiscovery) {
      setSearchStatus('Đang khám phá cấu trúc website...');
      startTask('seo_scraper', async (update) => {
        try {
          update({ progress: `Đang kết nối ${inputLines.length} trang chủ...` });

          const allDiscoveredLinks: string[] = [];
          
          for (let hp of inputLines) {
            if (!hp.startsWith('http')) hp = 'https://' + hp;
            update({ progress: `Đang quét cấu trúc: ${hp}...` });
            try {
              const res = await fetch('/api/scrape/discovery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ homepageUrl: hp })
              });
              if (res.ok) {
                const data = await res.json();
                if (data.links) {
                  allDiscoveredLinks.push(...data.links);
                }
              }
            } catch (e) {
              console.error(`Discovery failed for ${hp}`, e);
            }
          }

          if (allDiscoveredLinks.length > 0) {
            const currentUrls = urls.split('\n').map(u => u.trim()).filter(u => u);
            const newUrls = Array.from(new Set([...allDiscoveredLinks])).filter(u => !currentUrls.includes(u));
            const finalUrls = [...currentUrls, ...newUrls].slice(0, 500);
            
            setUrls(finalUrls.join('\n'));
            setSearchStatus(`Đã tìm thấy ${newUrls.length} URL mới.`);
            update({ progress: `Hoàn tất! Đã thêm ${newUrls.length} URL vào Box 2.` });
          } else {
            setSearchStatus('Không tìm thấy cấu trúc URL.');
            update({ progress: 'Không tìm thấy kết quả cấu trúc.' });
          }
        } catch (err) {
          console.error(err);
          setSearchStatus('Lỗi khi khám phá cấu trúc.');
        } finally {
          setIsLoading(false);
        }
      });
      return;
    }

    setSearchStatus('Đang tìm kiếm website từ từ khóa...');
    startTask('seo_scraper', async (update) => {
      try {
        const savedSettings = localStorage.getItem('omnisuite_settings');
        const keysData = savedSettings ? JSON.parse(savedSettings) : {};
        const keywordLines = inputLines;

        update({ progress: 'Đang kết nối API tìm kiếm...' });

        const searchRes = await fetch('/api/search-keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            keywords: keywordLines,
            keys: keysData
          })
        });

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.urls && searchData.urls.length > 0) {
            const currentUrls = urls.split('\n').map(u => u.trim()).filter(u => u);
            const newUrls = searchData.urls.filter((u: string) => !currentUrls.includes(u));
            let allUrls = [...currentUrls, ...newUrls];
            
            if (allUrls.length > 200) allUrls = allUrls.slice(0, 200);
            setUrls(allUrls.join('\n'));
            
            if (searchData.analysis) {
               setAnalysisData(prev => ({ ...prev, ...searchData.analysis }));
            }

            if (searchData.raw_data) {
               const mapping: Record<string, string> = {};
               searchData.raw_data.forEach((item: any) => {
                  mapping[item.url.toLowerCase().replace(/\/$/, "")] = item.keyword;
               });
               setKeywordMapping(prev => ({ ...prev, ...mapping }));
            }
            
            update({ progress: `Đã tìm thấy ${newUrls.length} website.` });
            setSearchStatus(`Tìm thấy ${newUrls.length} website.`);
          } else {
            setSearchStatus('Không tìm thấy kết quả.');
            update({ progress: 'Không tìm thấy kết quả.' });
          }
        } else {
          const err = await searchRes.json().catch(() => ({}));
          const msg = err.error || 'Server error';
          setSearchStatus(`Lỗi: ${msg}`);
          throw new Error(msg);
        }
      } catch (err: any) {
        console.error(err);
        // Only override if it wasn't already set to a specific message
        if (searchStatus.startsWith('Đang')) {
          setSearchStatus('Lỗi hệ thống hoặc API.');
        }
        throw err;
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handleScrapeMetadata = async () => {
    if (!urls.trim()) return;
    
    // If discovery is enabled, run structure scraper instead
    if (isStructureDiscoveryEnabled) {
      await handleScrapeStructure();
      return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setResults([]);
    setSearchStatus('Đang trích xuất dữ liệu metadata...');
    
    try {
      const urlList = urls.split('\n').map(u => u.trim()).filter(u => u);
      
      const savedSettings = localStorage.getItem('omnisuite_settings');
      const aiSettings = savedSettings ? JSON.parse(savedSettings) : null;

      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          urls: urlList,
          aiSettings: {
            ...aiSettings,
            default_provider: selectedProvider,
            default_model: selectedModel
          } 
        }),
        signal: abortControllerRef.current.signal
      });
      
      if (!res.ok) throw new Error(`Lỗi Server: ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setResults(data); 
        
        if (isSiloEnabled) {
          await handleBulkSiloAnalysis(data);
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error(err);
    } finally {
      if (!isSiloEnabled) setIsLoading(false);
    }
  };

  const handleScrapeStructure = async () => {
    if (!urls.trim()) return;
    setIsLoading(true);
    setSearchStatus('Đang thu thập sơ đồ trang web...');
    setResults([]);

    try {
      const siteUrls = urls.split('\n').map(u => u.trim()).filter(u => u).slice(0, 5);
      const allDiscoveredLinks = new Set<string>();

      for (let homepageUrl of siteUrls) {
        if (!homepageUrl.startsWith('http')) homepageUrl = 'https://' + homepageUrl;
        setSearchStatus(`Đang quét cấu trúc: ${homepageUrl}...`);
        try {
          const res = await fetch('/api/scrape/discovery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ homepageUrl })
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.links && Array.isArray(data.links)) {
              data.links.forEach((l: string) => allDiscoveredLinks.add(l));
            }
          }
        } catch (e) {
          console.error(`Discovery failed for ${homepageUrl}`, e);
        }
      }

      const finalUrlList = Array.from(allDiscoveredLinks);
      if (finalUrlList.length > 0) {
        setUrls(finalUrlList.join('\n'));
        setSearchStatus(`Đã tìm thấy ${finalUrlList.length} liên kết. Bắt đầu cào Metadata...`);
        
        // Re-use existing scrape logic with discovered list
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        const savedSettings = localStorage.getItem('omnisuite_settings');
        const aiSettings = savedSettings ? JSON.parse(savedSettings) : null;

        const scrapeRes = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: finalUrlList, aiSettings }),
          signal: abortControllerRef.current.signal
        });

        if (scrapeRes.ok) {
          const data = await scrapeRes.json();
          if (Array.isArray(data)) {
            setResults(data);
            if (isSiloEnabled) await handleBulkSiloAnalysis(data);
          }
        }
      } else {
        setSearchStatus('Không tìm thấy liên kết nội bộ nào.');
      }
    } catch (err) {
      console.error(err);
      setSearchStatus('Lỗi khi thu thập cấu trúc.');
    } finally {
      setIsLoading(false);
    }
  };


  const handleBulkSiloAnalysis = async (targetResults?: any[]) => {
    const list = targetResults || results;
    if (list.length === 0) return;

    setIsSiloAnalyzing(true);
    setSiloProgress({ current: 0, total: list.length });
    
    try {
      for (let i = 0; i < list.length; i++) {
          const item = list[i];
          if (analysisData[item.url]) {
              setSiloProgress(prev => ({ ...prev, current: i + 1 }));
              continue; 
          }
          
          setSiloProgress(prev => ({ ...prev, current: i + 1 }));
          try {
            await handleAnalyzeSingle(item.url, item.title, true);
          } catch (e) {
            console.error(`Silo analysis failed for ${item.url}:`, e);
          }
      }
    } finally {
      setIsSiloAnalyzing(false);
      setIsLoading(false);
    }
  };

  const handleAnalyzeSingle = async (url: string, title: string, silent = false) => {
    if (analysisData[url] && !silent) {
      setSelectedAnalysis(analysisData[url]);
      setIsModalOpen(true);
      return;
    }

    if (!silent) setAnalyzingUrl(url);
    try {
      const savedSettings = localStorage.getItem('omnisuite_settings');
      const keys = savedSettings ? JSON.parse(savedSettings) : {};
      
      const response = await fetch('/api/analyze-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           url, 
           title, 
           provider: selectedProvider.toLowerCase(),
           model: selectedModel,
           api_keys: {
              gemini: aiSettings?.gemini_api_key,
              openai: aiSettings?.openai_api_key,
              anthropic: aiSettings?.claude_api_key,
              groq: aiSettings?.groq_api_key,
              deepseek: aiSettings?.deepseek_api_key
           }
        }),
      });
      
      if (!response.ok) throw new Error('Phân tích thất bại');
      const data = await response.json();
      
      setAnalysisData(prev => ({
        ...prev,
        [url]: data
      }));
      
      if (!silent) {
        setSelectedAnalysis(data);
        setIsModalOpen(true);
      }
    } finally {
      if (!silent) setAnalyzingUrl(null);
    }
  };

  const handleExport = () => {
    if (results.length === 0) return;
    
    // Header definition
    const headers = [
      'STT', 'URL', 'Depth', 'Type', 'Ngày đăng', 'Title', 'Title Len', 'Description', 'Desc Len', 
      'H1', 'Keywords', 'KW Count', 'Density', 'Images', 'Img No Alt', 'Img No Title', 
      'Internal Links', 'External Links', 'Total Links', 'Size (KB)', 'Load Time (ms)', 'Status'
    ];

    const rows = results.map((r, i) => [
      i + 1,
      r.url,
      r.urlDepth || 0,
      r.contentType || 'N/A',
      r.publishDate ? `Đăng: ${r.publishDate.published || 'N/A'} / Sửa: ${r.publishDate.modified || 'N/A'}` : 'N/A',
      `"${(r.title || '').replace(/"/g, '""')}"`,
      r.titleLength || 0,
      `"${(r.description || '').replace(/"/g, '""')}"`,
      r.descriptionLength || 0,
      `"${(r.h1 || '').replace(/"/g, '""')}"`,
      `"${(r.metaKeywords || '').replace(/"/g, '""')}"`,
      r.metaKeywordsCount || 0,
      r.keywordDensity || '0%',
      r.imageStats?.total || 0,
      r.imageStats?.missingAlt || 0,
      r.imageStats?.missingTitle || 0,
      r.linkStats?.internal || 0,
      r.linkStats?.external || 0,
      r.totalLinks || 0,
      r.pageSizeKB || 0,
      r.responseTimeMs || 0,
      r.statusCode || 200
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `OMNISUITE_SEO_AUDIT_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-10 min-h-screen font-inter pb-20 overflow-x-hidden max-w-full min-w-0 box-border">
      <header className="flex justify-between items-end pb-10" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-6">
             <div className="p-3.5 rounded-2xl border shadow-[0_0_15px_rgba(34,211,238,0.3)]" style={{ backgroundColor: 'rgba(6,182,212,0.1)', borderColor: 'rgba(6,182,212,0.3)' }}>
                <Search className="text-cyan-400" size={24} />
             </div>
             <h1 className="text-2xl font-black tracking-tighter uppercase leading-none" style={{ color: 'var(--text-primary)' }}>
                Thu thập dữ liệu website
             </h1>
          </div>
          <div className="flex items-center gap-4 px-2">
             <div className="w-12 h-px bg-white/10" />
             <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest opacity-60">TRÍCH XUẬT & PHÂN TÍCH CẤU TRÚC WEBSITE.</p>
          </div>
        </div>
      </header>

       <div className="flex flex-col gap-8 flex-1 w-full max-w-full min-w-0 box-border">
         {/* --- HORIZONTAL CONTROL CENTER --- */}
         <div className="w-full">
            <Card className="p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.2)' }}>
               <div className="flex flex-col lg:flex-row lg:flex-wrap xl:flex-nowrap gap-8 items-stretch">
                  
                  {/* STEP 1: CONFIG & TOGGLES */}
                  <div className="w-full lg:w-[calc(50%-1rem)] xl:w-[350px] flex gap-5 pr-8 lg:border-r border-white/5 items-center box-border">
                     <div className="w-1 h-24 bg-cyan-500 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.6)] shrink-0" />
                     
                     <div className="flex flex-col gap-4 flex-1">
                        <div className="flex gap-2 flex-wrap">
                           {/* CÀO CẤU TRÚC TOGGLE */}
                           <label className="flex items-center cursor-pointer gap-2 p-1.5 px-3 bg-white/[0.03] border border-white/10 rounded-full hover:bg-white/[0.05] transition-all group shrink-0">
                              <span className={`text-[9px] font-black uppercase tracking-tighter transition-colors ${isStructureDiscoveryEnabled ? 'text-cyan-400' : 'text-slate-500'}`}>
                                 CÀO CẤU TRÚC
                              </span>
                              <div className="relative">
                                 <input type="checkbox" checked={isStructureDiscoveryEnabled} onChange={() => setIsStructureDiscoveryEnabled(!isStructureDiscoveryEnabled)} className="sr-only peer" />
                                 <div className="w-6 h-3 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-2 after:w-2 after:transition-all peer-checked:bg-cyan-500"></div>
                              </div>
                           </label>

                           {/* SILO TOGGLE */}
                           <label title="nâng cao hiệu quả cho cột keyword" className="flex items-center cursor-pointer gap-2 p-1.5 px-3 bg-white/[0.03] border border-white/10 rounded-full hover:bg-white/[0.05] transition-all group shrink-0">
                              <span className={`text-[9px] font-black uppercase tracking-tighter transition-colors ${isSiloEnabled ? 'text-indigo-400' : 'text-slate-500'}`}>
                                 Từ khóa
                              </span>
                              <div className="relative">
                                 <input type="checkbox" checked={isSiloEnabled} onChange={() => setIsSiloEnabled(!isSiloEnabled)} className="sr-only peer" />
                                 <div className="w-6 h-3 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-2 after:w-2 after:transition-all peer-checked:bg-indigo-500"></div>
                              </div>
                           </label>
                        </div>

                        {/* AI SELECTOR GROUP - REACTIVE TO SILO */}
                        <div className={`grid grid-cols-2 gap-2 transition-all duration-500 ${isSiloEnabled ? 'opacity-100 scale-100 brightness-110' : 'opacity-30 grayscale blur-[0.5px] scale-95 pointer-events-none'}`}>
                           <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5">
                                 <BrainCircuit size={10} className="text-indigo-400" />
                                 <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">AI ENGINE</span>
                              </div>
                              <select 
                                 value={selectedProvider} 
                                 onChange={(e) => handleProviderChange(e.target.value)}
                                 className="w-full bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2 text-[10px] font-bold text-indigo-400 outline-none focus:border-indigo-500/50 transition-all cursor-pointer appearance-none"
                              >
                                 {['Gemini', 'OpenAI', 'Claude', 'Groq', 'DeepSeek', 'OpenRouter'].map(p => (
                                    <option key={p} value={p} className="bg-slate-900">{p}</option>
                                 ))}
                              </select>
                           </div>
                           <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                 <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">MODEL</span>
                                 {isLoadingModels && <RefreshCw size={8} className="animate-spin text-cyan-500" />}
                              </div>
                              <select 
                                 value={selectedModel} 
                                 onChange={(e) => setSelectedModel(e.target.value)}
                                 className={`w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold outline-none focus:border-cyan-500/50 transition-all cursor-pointer appearance-none ${isLoadingModels ? 'opacity-50' : 'text-slate-300'}`}
                                 disabled={isLoadingModels}
                              >
                                 <option value="" className="bg-slate-900 text-slate-500">
                                    {isLoadingModels ? 'Đang dò...' : 'Chọn Model'}
                                 </option>
                                 {availableModels.map(m => (
                                    <option key={m} value={m} className="bg-slate-900">{m}</option>
                                 ))}
                              </select>
                           </div>
                        </div>
                        
                        {!isSiloEnabled && (
                           <span className="text-[7px] font-black text-slate-600 uppercase tracking-tighter text-center">Bật Từ khóa để dùng AI</span>
                        )}
                     </div>
                  </div>

                  <div className="w-full lg:w-[calc(50%-1rem)] xl:w-[400px] flex flex-col gap-4 pr-8 lg:border-r border-white/5 box-border">
                     <div className="flex justify-between items-center px-1">
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isStructureDiscoveryEnabled ? 'text-amber-400' : 'text-cyan-400'}`}>
                           {isStructureDiscoveryEnabled ? 'Nhập trang chủ (tối đa 5 trang chủ)' : '1. TÌM URL CƠ BẢN THEO TỪ KHÓA'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase">{keywords.split(/[\n,]/).filter(k => k.trim()).length}/5</span>
                     </div>
                     <div className="flex gap-4 h-full items-stretch">
                        <textarea 
                           placeholder={isStructureDiscoveryEnabled ? "https://example.com, https://blog.com..." : "SEO, Marketing..."} 
                           value={keywords} 
                           onChange={e => setKeywords(e.target.value)} 
                           className={`flex-1 h-24 rounded-2xl p-5 text-sm outline-none resize-none font-mono bg-white/[0.02] border transition-all shadow-inner ${isStructureDiscoveryEnabled ? 'border-amber-500/20 focus:border-amber-500/40' : 'border-white/5 focus:border-cyan-500/30'}`}
                           style={{ color: 'var(--text-primary)' }}
                        />
                        <button 
                           onClick={handleSearchKeywords}
                           disabled={isLoading || !keywords.trim()}
                           className={`px-8 rounded-2xl text-[12px] font-black tracking-widest uppercase transition-all flex flex-col items-center justify-center gap-3 group
                              ${(isLoading || !keywords.trim()) 
                                 ? 'opacity-40 cursor-not-allowed bg-white/5 text-slate-500' 
                                 : isStructureDiscoveryEnabled 
                                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:scale-[1.02] active:scale-95 shadow-lg shadow-amber-500/10'
                                    : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:scale-[1.02] active:scale-95 shadow-lg shadow-cyan-500/10'}`}
                        >
                           {isStructureDiscoveryEnabled ? (
                              <Globe size={20} className={isLoading ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'} />
                           ) : (
                              <Search size={20} className={isLoading ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'} />
                           )}
                           <span className="hidden lg:block">{isStructureDiscoveryEnabled ? 'QUÉT CẤU TRÚC' : 'TÌM URL'}</span>
                        </button>
                     </div>
                  </div>

                  <div className="flex-1 min-w-[300px] flex flex-col gap-4 box-border">
                     <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">2. CÀO DỮ LIỆU WEBSITE</span>
                        {searchStatus && (
                           <span className="text-[10px] text-cyan-500 font-black animate-pulse flex items-center gap-2">
                              {searchStatus}
                           </span>
                        )}
                     </div>
                     <div className="flex gap-4 h-full items-stretch">
                        <textarea 
                           placeholder="Paste URLs tại đây..." 
                           value={urls} 
                           onChange={e => setUrls(e.target.value)} 
                           className="flex-1 h-24 rounded-2xl p-5 text-sm outline-none resize-none font-mono bg-white/[0.02] border border-white/5 focus:border-indigo-500/30 transition-all shadow-inner"
                           style={{ color: 'var(--text-primary)' }}
                        />
                        <button 
                           onClick={handleScrapeMetadata}
                           disabled={isLoading || !urls.trim()}
                           className={`px-10 rounded-2xl text-[12px] font-black tracking-widest uppercase transition-all flex flex-col items-center justify-center gap-3 group
                              ${(isLoading || !urls.trim()) 
                                 ? 'opacity-40 cursor-not-allowed bg-white/5 text-slate-500' 
                                 : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-95'}`}
                        >
                           <Zap size={22} className={isLoading ? (isStructureDiscoveryEnabled ? 'animate-bounce' : 'animate-spin') : 'group-hover:rotate-12 transition-transform'} />
                           <span className="hidden lg:block">BẮT ĐẦU</span>
                        </button>
                     </div>
                  </div>

               </div>
            </Card>
         </div>

         {/* --- RESULTS AREA --- */}
         <div className="w-full overflow-hidden flex flex-col min-w-0 max-w-full">
            <Card className={`${isExpanded ? 'fixed inset-0 z-[100] m-0 rounded-none border-none pb-40 bg-slate-950/95 backdrop-blur-xl' : 'rounded-[2.5rem] min-h-[600px] shadow-2xl'} relative flex flex-col min-w-0`} style={!isExpanded ? { backgroundColor: 'var(--card-bg)', border: '1px solid rgba(6,182,212,0.2)' } : {}}>
               {results.length > 0 ? (
                  <div className="h-full flex flex-col min-h-0 min-w-0 w-full max-w-full box-border overflow-hidden">
                     <div className="p-8 flex items-center justify-between shrink-0" style={{ backgroundColor: 'var(--hover-bg)', borderBottom: '1px solid rgba(6,182,212,0.2)' }}>
                        <div className="flex items-center gap-6">
                           <div className="flex flex-col">
                              <Typography variant="h3" className="mb-1 text-2xl font-black uppercase" style={{ color: 'var(--text-primary)' }}>Kết quả</Typography>
                              <div className="flex items-center gap-2">
                                 <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{results.length} URL đã trích xuất</span>
                              </div>
                           </div>
                           
                           {isSiloAnalyzing && (
                              <div className="flex items-center gap-4 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                                 <MagicIcon size={14} className="text-cyan-400 animate-spin" />
                                 <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                                    Đang phân tích Silo: {siloProgress.current}/{siloProgress.total}
                                 </span>
                                 <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-cyan-500 transition-all duration-500"
                                        style={{ width: `${(siloProgress.current / siloProgress.total) * 100}%` }}
                                    />
                                 </div>
                              </div>
                           )}
                        </div>
                        <div className="flex items-center gap-3">

                           <button 
                              onClick={() => setIsExpanded(!isExpanded)}
                              className="h-14 w-14 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                              title={isExpanded ? "Thu nhỏ" : "Phóng to"}
                           >
                              {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                           </button>
                             <Button 
                               variant="outline" 
                               size="sm" 
                               className="px-6 h-14 font-bold uppercase text-[10px] tracking-widest bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/20 text-rose-400" 
                               leftIcon={<Trash2 size={16} />}
                               onClick={handleClearHistory}
                               disabled={results.length === 0}
                             >
                                XÓA LỊCH SỬ
                             </Button>
                             <Button 
                               variant="success" 
                               size="sm" 
                               className="px-10 h-14 font-bold uppercase text-xs tracking-widest" 
                               leftIcon={<Download size={18} />}
                               onClick={handleExport}
                               disabled={results.length === 0}
                             >
                                XUẤT DỮ LIỆU
                             </Button>
                        </div>
                     </div>

                     <div className="flex-1 overflow-x-auto force-scrollbar w-full max-w-full min-w-0 pb-10" style={{ display: 'block' }}>
                        <table className="text-left table-fixed" style={{ minWidth: '5800px', width: 'max-content' }}>
                           <colgroup>
                              <col className="w-24" />
                              <col className="w-[500px]" />
                              {isSiloEnabled && (
                                 <>
                                    <col className="w-48" />
                                    <col className="w-48" />
                                 </>
                              )}
                              <col className="w-32" />
                              <col className="w-48" />
                              <col className="w-[240px]" />
                              <col className="w-[350px]" />
                              <col className="w-24" />
                              <col className="w-24" />
                              <col className="w-[500px]" />
                              <col className="w-[600px]" />
                              <col className="w-[500px]" />
                              <col className="w-32" />
                              <col className="w-32" />
                              <col className="w-32" />
                              <col className="w-32" />
                              <col className="w-[500px]" />
                              <col className="w-48" />
                              <col className="w-64" />
                              <col className="w-32" />
                              <col className="w-40" />
                              <col className="w-32" />
                              <col className="w-32" />
                              <col className="w-32" />
                           </colgroup>
                           <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--card-bg)' }}>
                              <tr className="border-b border-white/5 bg-white/[0.02]">
                                 <th colSpan={isSiloEnabled ? 7 : 5} className="p-6 text-[15px] font-black text-indigo-400 uppercase tracking-[0.3em] border-r border-white/5 text-center">Nhóm 1: Định danh</th>
                                 <th colSpan={10} className="p-6 text-[15px] font-black text-cyan-400 uppercase tracking-[0.3em] border-r border-white/5 text-center">Nhóm 2: Nội dung Metadata</th>
                                 <th colSpan={7} className="p-6 text-[15px] font-black text-amber-400 uppercase tracking-[0.3em] text-center">Nhóm 3: Kỹ thuật & Kiểm soát</th>
                              </tr>
                              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-24 text-center">STT</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-[500px]">Target (URL)</th>
                                 {isSiloEnabled && (
                                    <>
                                       <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-48 text-center">Mục đích</th>
                                       <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-48 text-center">Độ phủ</th>
                                    </>
                                 )}
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-32 text-center">Phân cấp</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-48 text-center">Loại</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-[240px] text-center border-r border-white/5">Ngày</th>
                                 
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-[350px]">Keywords</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-24 text-center">Từ Title</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-24 text-center border-r border-white/5">Từ Meta</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-[500px]">Tiêu đề (Title)</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-[600px]">Mô tả (Desc)</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-[500px]">Thẻ H1</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-32 text-center">Hình ảnh</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-32 text-center">Mất Alt</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-32 text-center">Mất Title</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-32 text-center border-r border-white/5">Liên kết</th>
                                 
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-[500px]">Nguồn gốc (Canonical)</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-48">Chỉ mục (Robots)</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-64 text-center">Tác giả</th>

                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-40 text-center underline decoration-cyan-500">Tốc độ (ms)</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-32 text-center border-r border-white/5">Dung lượng (KB)</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-32 text-center">Trạng thái</th>
                                 <th className="p-6 text-[14px] font-black uppercase tracking-widest text-slate-500 w-32 text-center bg-slate-900 border-l border-white/5">Chi tiết</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-white/[0.02]">
                               {results.map((r, i) => (
                                  <tr key={i} className="hover:bg-cyan-600/[0.03] transition-colors group">
                                     <td className="p-5 text-center">
                                        <span className="text-[14px] font-mono text-slate-500">{(i + 1).toString().padStart(2, '0')}</span>
                                     </td>
                                     <td className="p-5">
                                        <div className="flex items-center gap-2">
                                           <div className="p-2 bg-indigo-500/10 rounded-lg shrink-0">
                                             <Globe size={16} className="text-indigo-400" />
                                           </div>
                                           <a href={r.url} target="_blank" rel="noreferrer" className="text-[15px] font-bold text-slate-200 hover:text-cyan-400 transition-colors">
                                              {r.url}
                                           </a>
                                        </div>
                                     </td>
                                     {isSiloEnabled && (
                                        <>
                                           <td className="p-5">
                                              {analysisData[r.url] ? (
                                                 <span className={`text-[14px] font-black px-3 py-1.5 rounded border tracking-widest ${
                                                    (analysisData[r.url].intent === 'Bán hàng' || analysisData[r.url].intent === 'Thương mại') ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' : 
                                                     'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                                }`}>
                                                   {analysisData[r.url].intent || "..."}
                                                </span>
                                              ) : (
                                                 <div className="flex items-center gap-2 animate-pulse">
                                                    <div className="w-2 h-2 rounded-full bg-slate-700" />
                                                    <span className="text-[13px] text-slate-700 italic">Chờ...</span>
                                                 </div>
                                              )}
                                           </td>
                                           <td className="p-5 text-center">
                                              {analysisData[r.url] ? (
                                                 <span className={`text-[14px] font-black px-3 py-1.5 rounded border ${
                                                    (analysisData[r.url].coverage === 'Cao') ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                                 }`}>
                                                    {analysisData[r.url].coverage}
                                                 </span>
                                              ) : <span className="text-[13px] text-slate-700">--</span>}
                                           </td>
                                        </>
                                     )}
                                      <td className="p-5 text-center" 
                                          title={(r.urlDepth || 0) <= 3 
                                             ? "Trang có phân cấp nông, thuận lợi để Googlebot crawl và người dùng tìm thấy nội dung nhanh nhất." 
                                             : (r.urlDepth || 0) === 4 
                                             ? "Trang nằm ở cấp độ trung bình, nên tối ưu liên kết nội bộ để tăng khả năng tiếp cận." 
                                             : "Cấu trúc URL quá sâu (nhiều lớp folder), gây khó khăn cho việc lập chỉ mục và trải nghiệm người dùng."}
                                      >
                                         <span className={`px-4 py-1.5 rounded border text-[12px] font-black uppercase tracking-widest cursor-help ${
                                            (r.urlDepth || 0) <= 3 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                            (r.urlDepth || 0) === 4 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                            'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                         }`}>
                                            {(r.urlDepth || 0) <= 3 ? 'Tốt' : (r.urlDepth || 0) === 4 ? 'Cảnh báo' : 'Sâu'}
                                         </span>
                                      </td>
                                     <td className="p-5 text-center">
                                        <span className="text-[13px] font-black text-slate-400 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 uppercase tracking-tighter">
                                           {r.contentType || 'N/A'}
                                        </span>
                                     </td>
                                     <td className="p-5 text-center border-r border-white/5">
                                         <div className="flex flex-col items-center gap-1.5">
                                            {r.publishDate?.published && r.publishDate.published !== 'N/A' && (
                                              <p className="text-[13px] font-bold font-mono text-slate-300" title="Ngày đăng bài (datePublished)">
                                                 Đăng: {r.publishDate.published}
                                              </p>
                                            )}
                                            {r.publishDate?.modified && r.publishDate.modified !== 'N/A' && (
                                              <p className="text-[13px] font-bold font-mono text-amber-500/80" title="Ngày cập nhật (dateModified)">
                                                 Sửa: {r.publishDate.modified}
                                              </p>
                                            )}
                                            {(!r.publishDate || (r.publishDate.published === 'N/A' && r.publishDate.modified === 'N/A')) && (
                                              <p className="text-[13px] font-bold font-mono text-slate-600">N/A</p>
                                            )}
                                         </div>
                                      </td>

                                      <td className="p-5 align-top">
                                         <div className="flex flex-wrap gap-2 pt-1">
                                            {(r.topKeywords || []).slice(0, 5).map((k: any, idx: number) => (
                                               <div key={idx} className="px-2.5 py-1 bg-indigo-500/5 border border-indigo-500/10 rounded-lg flex items-center gap-2 group/kw hover:bg-indigo-500/10 transition-all">
                                                  <span className="text-[12px] font-bold text-indigo-200 truncate">{k.word}</span>
                                                  <span className="text-[10px] font-black text-indigo-400/50 group-hover/kw:text-cyan-400 transition-colors uppercase">{k.density}</span>
                                               </div>
                                            ))}
                                            {(!r.topKeywords || r.topKeywords.length === 0) && (
                                               <span className="text-[13px] text-slate-700 italic">N/A</span>
                                            )}
                                         </div>
                                      </td>
                                      <td className="p-5 text-center">
                                         <div className="flex flex-col items-center gap-1">
                                            <span className={`text-[16px] font-black ${r.keywordsInTitle > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                                               {r.keywordsInTitle || 0}
                                            </span>
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Từ khóa</span>
                                         </div>
                                      </td>
                                      <td className="p-5 text-center border-r border-white/5">
                                         <div className="flex flex-col items-center gap-1">
                                            <span className={`text-[16px] font-black ${r.keywordsInMeta > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                                               {r.keywordsInMeta || 0}
                                            </span>
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Từ khóa</span>
                                         </div>
                                      </td>
                                     
                                     <td className="p-5">
                                        <Typography variant="body" className="font-bold text-slate-300 text-[16px]">{r.title}</Typography>
                                     </td>
                                     <td className="p-5">
                                        <Typography variant="body" className="text-slate-500 text-[15px] italic truncate max-w-[500px]">{r.description || "N/A"}</Typography>
                                     </td>
                                     <td className="p-5">
                                        <p className="text-[15px] font-bold text-slate-400 truncate max-w-[400px]">{r.h1 || "N/A"}</p>
                                     </td>
                                     
                                     <td className="p-5 text-center">
                                        <span className="text-[16px] font-black text-slate-300">{r.imageStats?.total || 0}</span>
                                     </td>
                                     <td className="p-5 text-center">
                                        <span className="text-[16px] font-black text-rose-400">{r.imageStats?.missingAlt || 0}</span>
                                     </td>
                                     <td className="p-5 text-center">
                                        <span className="text-[16px] font-black text-amber-400">{r.imageStats?.missingTitle || 0}</span>
                                     </td>
                                     <td className="p-5 text-center border-r border-white/5">
                                        <span className="text-[16px] font-black text-slate-300">{r.totalLinks || 0}</span>
                                     </td>
 
                                     <td className="p-5">
                                        <p className="text-[14px] text-slate-600 italic truncate max-w-[400px]">{r.canonical || "N/A"}</p>
                                     </td>
                                     <td className="p-5">
                                        <span className="text-[13px] font-black text-slate-600 uppercase tracking-widest">{r.robots || "index, follow"}</span>
                                     </td>
                                     <td className="p-5">
                                        <span className={`text-[14px] font-bold italic ${r.publisher === 'Missing' ? 'text-slate-700' : 'text-amber-500/70'}`}>{r.publisher}</span>
                                     </td>

                                     <td className="p-5 text-center">
                                        <span className={`text-[16px] font-black ${r.responseTimeMs > 2000 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                           {Math.round(r.responseTimeMs || 0)}
                                        </span>
                                     </td>
                                     <td className="p-5 text-center border-r border-white/5">
                                        <span className={`text-[16px] font-black ${r.pageSizeKB > 1000 ? 'text-amber-500' : 'text-slate-300'}`}>
                                           {r.pageSizeKB?.toLocaleString() || 0}
                                        </span>
                                     </td>
                                     <td className="p-5 text-center">
                                        <span className={`text-[16px] font-black ${getStatusColor(r.statusCode)}`}>
                                           {r.statusCode || 200}
                                        </span>
                                     </td>
                                      <td className="p-5 text-center bg-slate-900/50 border-l border-white/5">
                                        <button 
                                          onClick={() => { setShowDetail(r); setModalTab('overview'); }}
                                          className="p-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg transition-all border border-cyan-500/20 group-hover:scale-110"
                                        >
                                           <Eye size={18} />
                                        </button>
                                     </td>
                                  </tr>
                               ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-20 relative">
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02]">
                        <Typography variant="h1" className="text-9xl font-black tracking-[0.5em] uppercase select-none">SEO NEXUS</Typography>
                     </div>
                     
                     <div className="relative text-center space-y-8 max-w-md">
                        <div className="p-6 bg-cyan-500/5 rounded-[3rem] w-fit mx-auto border border-dashed border-cyan-500/20">
                           <ShieldCheck size={80} className="text-cyan-400/20 animate-pulse" />
                        </div>
                        <div className="space-y-4">
                            <Typography variant="h3" className="text-white font-black uppercase text-2xl tracking-widest mb-0">{isLoading ? 'Hệ thống đang chạy' : 'Hệ thống sẵn sàng'}</Typography>
                            <p className="text-xs font-black text-slate-600 uppercase tracking-[0.4em] leading-loose">
                               {isLoading ? (searchStatus || 'Đang xử lý dữ liệu yêu cầu...') : 'Đang chờ khởi tạo quy trình URL hoặc từ khóa để trích xuất và kiểm tra metadata.'}
                            </p>
                         </div>
                        <div className="pt-8">
                           <div className="px-6 py-2 border border-white/5 rounded-full inline-flex items-center gap-4">
                              <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Protocol</span>
                              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">STABLE-X64</span>
                           </div>
                        </div>
                     </div>
                  </div>
               )}
            </Card>
         </div>
      </div>

      <AnimatePresence>
        {isModalOpen && selectedAnalysis && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-2xl bg-slate-900 border border-cyan-500/30 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)]"
            >
              <div className="p-10 border-b border-white/5 bg-white/[0.02]">
                <div className="flex justify-between items-start gap-10">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                       <MagicIcon size={14} className="text-cyan-400 animate-pulse" />
                       <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">AI Competitor Insight</span>
                    </div>
                    <Typography variant="h3" className="text-2xl font-black text-white leading-tight">{selectedAnalysis.title}</Typography>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono italic overflow-hidden">
                      <Globe size={12} /> {selectedAnalysis.url}
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-4 bg-white/5 hover:bg-rose-500 text-slate-400 hover:text-white rounded-2xl transition-all border border-white/5"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-10 grid grid-cols-2 gap-8 bg-slate-900">
                <div className="space-y-3">
                  <Typography variant="label">MỤC ĐÍCH (INTENT)</Typography>
                  <div className="p-5 bg-white/[0.03] border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-4">
                       <Layout className="text-cyan-500" size={24} />
                       <span className="text-lg font-black text-white uppercase tracking-tight">{selectedAnalysis.intent}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Typography variant="label">ĐỘ PHỦ THƯƠNG HIỆU</Typography>
                  <div className="p-5 bg-white/[0.03] border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-4">
                       <Activity className="text-emerald-500" size={24} />
                       <span className="text-lg font-black text-white uppercase tracking-tight">{selectedAnalysis.coverage}</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 space-y-3">
                  <Typography variant="label">ĐIỂM YẾU CỦA ĐỐI THỦ</Typography>
                  <div className="p-6 bg-rose-500/5 border border-rose-500/20 rounded-2xl border-l-4 border-l-rose-500">
                    <p className="text-sm font-semibold text-rose-200 leading-relaxed italic">
                      "{selectedAnalysis.weakness}"
                    </p>
                  </div>
                </div>

                <div className="col-span-2 space-y-3">
                  <Typography variant="label">CƠ HỘI KHAI THÁC</Typography>
                  <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl border-l-4 border-l-emerald-500">
                    <div className="flex gap-4">
                      <ArrowRight className="text-emerald-500 shrink-0" size={20} />
                      <p className="text-sm font-black text-white uppercase tracking-wide leading-relaxed">
                        {selectedAnalysis.opportunity}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-10 py-8 bg-white/[0.02] border-t border-white/5 flex justify-end">
                <Button 
                   onClick={() => window.open(selectedAnalysis.url, '_blank')}
                   variant="secondary" 
                   className="h-14 px-10 rounded-2xl font-black uppercase text-xs tracking-widest gap-2"
                >
                  Truy cập Website <Maximize2 size={16} />
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDetail && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-10">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowDetail(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-6xl h-[85vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              >
                 {/* Header */}
                 <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                       <div className="p-3 bg-cyan-500/10 rounded-xl">
                          <MagicIcon size={24} className="text-cyan-400" />
                       </div>
                       <div>
                          <Typography variant="h4" className="text-white font-black tracking-tight leading-tight line-clamp-1">{showDetail.title}</Typography>
                          <Typography variant="body" className="text-slate-500 text-xs font-mono">{showDetail.url}</Typography>
                       </div>
                    </div>
                    <button 
                      onClick={() => setShowDetail(null)}
                      className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors"
                    >
                       <X size={24} />
                    </button>
                 </div>

                 <div className="flex-1 flex overflow-hidden">
                    {/* Tabs Sidebar */}
                    <div className="w-56 border-r border-white/5 bg-black/20 p-4 space-y-1">
                       {[
                          { id: 'overview', label: 'Overview', icon: Globe },
                          { id: 'headings', label: 'Headings', icon: Layout },
                          { id: 'links', label: 'Links', icon: Activity },
                          { id: 'images', label: 'Images', icon: Eye },
                          { id: 'schema', label: 'Schema', icon: BrainCircuit },
                          { id: 'social', label: 'Social', icon: Zap }
                       ].map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setModalTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                               modalTab === tab.id ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold' : 'text-slate-400 hover:bg-white/5 opacity-70'
                            }`}
                          >
                             <tab.icon size={18} />
                             <span className="text-sm tracking-wide uppercase">{tab.label}</span>
                          </button>
                       ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-auto p-8 custom-scrollbar-indigo bg-white/[0.01]">
                       {modalTab === 'overview' && (
                          <div className="space-y-8 max-w-4xl">
                             <div className="grid grid-cols-2 gap-6">
                                <Card className="p-6 border-cyan-500/10 bg-cyan-500/[0.02]">
                                   <Typography variant="body" className="uppercase text-[10px] font-black tracking-[0.2em] text-cyan-500 mb-4">Meta Title</Typography>
                                   <p className="text-lg font-bold text-slate-200 leading-snug">{showDetail.title}</p>
                                   <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                                      <span className="text-slate-500">Length: {showDetail.titleLength} chars</span>
                                      <span className={showDetail.titleLength > 60 ? 'text-amber-400' : 'text-emerald-400'}>
                                         {showDetail.titleLength <= 60 ? 'Optimal' : 'Too Long'}
                                      </span>
                                   </div>
                                </Card>
                                <Card className="p-6 border-indigo-500/10 bg-indigo-500/[0.02]">
                                   <Typography variant="body" className="uppercase text-[10px] font-black tracking-[0.2em] text-indigo-500 mb-4">Meta Description</Typography>
                                   <p className="text-base font-medium text-slate-400 leading-relaxed italic line-clamp-4">{showDetail.description}</p>
                                   <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                                      <span className="text-slate-500">Length: {showDetail.descriptionLength} chars</span>
                                      <span className={showDetail.descriptionLength > 160 ? 'text-amber-400' : 'text-emerald-400'}>
                                         {showDetail.descriptionLength <= 160 ? 'Optimal' : 'Too Long'}
                                      </span>
                                   </div>
                                </Card>
                             </div>

                             <div className="grid grid-cols-2 gap-6">
                                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center gap-4">
                                   <div className={`p-3 rounded-xl ${showDetail.robots?.includes('noindex') ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                      {showDetail.robots?.includes('noindex') ? <ShieldCheck size={20} className="opacity-50" /> : <ShieldCheck size={20} />}
                                   </div>
                                   <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Robots Tag</p>
                                      <p className={`text-sm font-bold truncate ${showDetail.robots?.includes('noindex') ? 'text-rose-400' : 'text-emerald-400'}`}>
                                         {showDetail.robots || 'index, follow'}
                                      </p>
                                   </div>
                                </div>

                                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center gap-4">
                                   <div className={`p-3 rounded-xl ${showDetail.canonical === showDetail.url ? 'bg-cyan-500/10 text-cyan-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                      <Globe size={20} />
                                   </div>
                                   <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Canonical URL</p>
                                      <p className="text-xs font-mono text-slate-400 truncate leading-relaxed">
                                         {showDetail.canonical}
                                      </p>
                                      {showDetail.canonical !== showDetail.url && (
                                         <p className="text-[9px] text-amber-500 font-black uppercase mt-1">! Khác với URL hiện tại</p>
                                      )}
                                   </div>
                                </div>
                             </div>

                             <div className="grid grid-cols-3 gap-6">
                                {[
                                   { label: 'Language', val: showDetail.language, color: 'amber', icon: Globe },
                                   { label: 'Publisher', val: showDetail.publisher, color: 'indigo', icon: Search },
                                   { label: 'Content Type', val: showDetail.contentType, color: 'blue', icon: Layout }
                                ].map((item, idx) => (
                                   <div key={idx} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center gap-3">
                                      <div className={`p-2 bg-${item.color}-500/10 text-${item.color}-400 rounded-lg`}>
                                         <item.icon size={14} />
                                      </div>
                                      <div className="min-w-0">
                                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{item.label}</p>
                                         <p className={`text-xs font-bold text-${item.color}-400 truncate`}>{item.val}</p>
                                      </div>
                                   </div>
                                ))}
                             </div>

                             {/* NEW: Primary Keyword Density Analysis Section */}
                             <div className="p-8 rounded-3xl border border-indigo-500/20 bg-indigo-500/[0.03] space-y-6">
                                <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-3">
                                      <div className="p-2.5 bg-indigo-500/20 rounded-xl text-indigo-400">
                                         <Target size={20} />
                                      </div>
                                      <div>
                                         <Typography variant="body" className="uppercase text-[10px] font-black tracking-[0.2em] text-indigo-500">Phân tích Mật độ từ khóa chính</Typography>
                                         <Typography variant="h4" className="text-white font-black">Ước tính chủ đề nội dung</Typography>
                                      </div>
                                   </div>
                                   
                                   <div className="text-right">
                                      <Typography variant="body" className="uppercase text-[10px] font-black tracking-[0.2em] text-slate-500 mb-1">Tổng số từ (Clean Content)</Typography>
                                      <Typography variant="h4" className="text-white font-mono font-black">{showDetail.wordCount?.toLocaleString() || 0}</Typography>
                                   </div>
                                </div>

                                <div className="grid grid-cols-12 gap-6 items-center">
                                   <div className="col-span-12 lg:col-span-7">
                                      <div className="p-6 bg-black/20 rounded-2xl border border-white/5">
                                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Từ khóa chính (Hiển thị lọc)</p>
                                         <p className="text-xl font-black text-indigo-300 italic">"{showDetail.primaryKeyword}"</p>
                                         
                                         <div className="mt-4 pt-4 border-t border-white/5">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Cụm từ đếm mật độ (Nguyên bản)</p>
                                            <p className="text-sm font-bold text-slate-400 italic">"{showDetail.densityCrawlPhrase}"</p>
                                         </div>

                                         <p className="mt-3 text-[11px] text-slate-500 leading-relaxed font-medium capitalize">
                                            Phân tích mật độ dựa trên cụm từ nguyên bản từ H1/Title để đảm bảo độ chính xác của ngữ cảnh.
                                         </p>
                                      </div>
                                   </div>
                                   
                                   <div className="col-span-12 lg:col-span-5 flex flex-col items-center justify-center space-y-4">
                                      <div className={`p-6 rounded-2xl border flex flex-col items-center justify-center w-full ${
                                         parseFloat(showDetail.keywordDensity || '0') < 0.5 ? 'border-amber-500/30 bg-amber-500/5' :
                                         parseFloat(showDetail.keywordDensity || '0') <= 2.5 ? 'border-emerald-500/30 bg-emerald-500/5' :
                                         'border-rose-500/30 bg-rose-500/5'
                                      }`}>
                                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Mật độ hiện tại</p>
                                         <p className={`text-4xl font-black font-mono ${
                                            parseFloat(showDetail.keywordDensity || '0') < 0.5 ? 'text-amber-400' :
                                            parseFloat(showDetail.keywordDensity || '0') <= 2.5 ? 'text-emerald-400' :
                                            'text-rose-400'
                                         }`}>{showDetail.keywordDensity || '0.00%'}</p>
                                         
                                         <div className={`mt-3 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                            parseFloat(showDetail.keywordDensity || '0') < 0.5 ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' :
                                            parseFloat(showDetail.keywordDensity || '0') <= 2.5 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                            'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                         }`}>
                                            {parseFloat(showDetail.keywordDensity || '0') < 0.5 ? 'Chưa tối ưu' :
                                             parseFloat(showDetail.keywordDensity || '0') <= 2.5 ? 'Tuyệt vời (Chuẩn SEO)' :
                                             'Cảnh báo (Nhồi nhét)'}
                                         </div>
                                      </div>
                                   </div>
                                </div>
                             </div>

                             <div className="space-y-4">
                                <Typography variant="h4" className="text-white/80 font-black tracking-widest text-[12px] uppercase">Keyword Analysis</Typography>
                                <div className="overflow-hidden rounded-2xl border border-white/5">
                                   <table className="w-full text-left">
                                      <thead className="bg-white/[0.03]">
                                         <tr>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase">Keyword</th>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase text-center">Count</th>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase text-center">Density</th>
                                         </tr>
                                      </thead>
                                      <tbody className="divide-y divide-white/5">
                                         {showDetail.topKeywords?.map((kw: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-white/[0.02]">
                                               <td className="p-4 text-sm font-bold text-slate-300 italic">{kw.word}</td>
                                               <td className="p-4 text-sm text-center font-mono text-slate-500">{kw.count}</td>
                                               <td className="p-4 text-sm text-center">
                                                  <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg font-black text-xs">{kw.density}</span>
                                               </td>
                                            </tr>
                                         ))}
                                      </tbody>
                                   </table>
                                </div>
                             </div>
                          </div>
                       )}

                       {modalTab === 'headings' && (
                          <div className="space-y-6 max-w-3xl">
                             <div className="flex items-center gap-4 mb-8 overflow-x-auto whitespace-nowrap custom-scrollbar-indigo pb-2">
                                {Object.entries(showDetail.headingCounts || {}).map(([tag, count]: [string, any]) => (
                                   <div key={tag} className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 flex flex-col items-center min-w-[70px] shrink-0">
                                      <span className="text-[10px] font-black text-slate-500 uppercase">{tag}</span>
                                      <span className="text-xl font-black text-cyan-400">{count}</span>
                                   </div>
                                ))}
                             </div>

                             <div className="space-y-3">
                                {showDetail.headings?.map((h: any, idx: number) => (
                                   <div 
                                     key={idx} 
                                     className={`p-4 rounded-xl border transition-all hover:translate-x-1 ${
                                        h.tag === 'h1' ? 'bg-indigo-500/10 border-indigo-500/20' : 
                                        h.tag === 'h2' ? 'bg-cyan-500/5 border-cyan-500/10 ml-4' : 
                                        'bg-white/[0.02] border-white/5 ml-8'
                                     }`}
                                   >
                                      <div className="flex items-center gap-3">
                                         <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                                            h.tag === 'h1' ? 'bg-indigo-500 text-white' : 
                                            h.tag === 'h2' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'
                                         }`}>{h.tag}</span>
                                         <span className={`text-sm font-bold ${h.tag === 'h1' ? 'text-indigo-300' : 'text-slate-300'}`}>{h.text}</span>
                                      </div>
                                   </div>
                                ))}
                             </div>
                          </div>
                       )}

                       {modalTab === 'links' && (
                          <div className="space-y-8">
                             <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                   <div className="flex items-center justify-between">
                                      <Typography variant="h4" className="text-emerald-400 font-black text-xs uppercase tracking-widest">Internal Links ({showDetail.collectedLinks?.internal?.length || 0})</Typography>
                                      <button className="text-[10px] text-slate-500 hover:text-white uppercase font-black" onClick={() => {
                                        const text = showDetail.collectedLinks?.internal?.join('\n');
                                        navigator.clipboard.writeText(text);
                                        alert('Copied to clipboard!');
                                      }}>Copy All</button>
                                   </div>
                                   <div className="bg-black/20 rounded-2xl border border-white/5 max-h-[500px] overflow-auto custom-scrollbar-indigo">
                                      {showDetail.collectedLinks?.internal?.map((link: string, idx: number) => (
                                         <div key={idx} className="p-3 border-b border-white/5 flex items-center gap-3 group">
                                            <span className="text-[10px] font-mono text-slate-700">{(idx + 1).toString().padStart(2, '0')}</span>
                                            <a href={link} target="_blank" rel="noreferrer" className="text-xs text-slate-400 truncate hover:text-emerald-400 transition-colors">{link}</a>
                                         </div>
                                      ))}
                                   </div>
                                </div>
                                <div className="space-y-4">
                                   <div className="flex items-center justify-between">
                                      <Typography variant="h4" className="text-rose-400 font-black text-xs uppercase tracking-widest">External Links ({showDetail.collectedLinks?.external?.length || 0})</Typography>
                                      <button className="text-[10px] text-slate-500 hover:text-white uppercase font-black" onClick={() => {
                                        const text = showDetail.collectedLinks?.external?.join('\n');
                                        navigator.clipboard.writeText(text);
                                        alert('Copied to clipboard!');
                                      }}>Copy All</button>
                                   </div>
                                   <div className="bg-black/20 rounded-2xl border border-white/5 max-h-[500px] overflow-auto custom-scrollbar-indigo">
                                      {showDetail.collectedLinks?.external?.map((link: string, idx: number) => (
                                         <div key={idx} className="p-3 border-b border-white/5 flex items-center gap-3 group">
                                            <span className="text-[10px] font-mono text-slate-700">{(idx + 1).toString().padStart(2, '0')}</span>
                                            <a href={link} target="_blank" rel="noreferrer" className="text-xs text-slate-400 truncate hover:text-rose-400 transition-colors uppercase font-mono">{link}</a>
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             </div>
                          </div>
                       )}

                       {modalTab === 'images' && (
                          <div className="space-y-8">
                             <Card className="p-8 border-cyan-500/10 bg-cyan-500/[0.02] flex items-center justify-between">
                                <div>
                                   <Typography variant="h3" className="text-cyan-400 font-black">{showDetail.imageStats?.total || 0}</Typography>
                                   <Typography variant="body" className="text-slate-500 uppercase text-xs font-black tracking-widest">Total Images Found</Typography>
                                </div>
                                <div className="flex gap-10 overflow-x-auto whitespace-nowrap custom-scrollbar-indigo pb-2">
                                   <div className="text-center">
                                      <p className="text-2xl font-black text-rose-500">{showDetail.imageStats?.missingAlt || 0}</p>
                                      <p className="text-[10px] font-black text-slate-500 uppercase">Missing ALT</p>
                                   </div>
                                   <div className="text-center">
                                      <p className="text-2xl font-black text-amber-500">{showDetail.imageStats?.missingTitle || 0}</p>
                                      <p className="text-[10px] font-black text-slate-500 uppercase">Missing Title</p>
                                   </div>
                                </div>
                             </Card>
                             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {showDetail.images?.map((img: any, idx: number) => (
                                   <div key={idx} className="group bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden hover:border-cyan-500/30 transition-all duration-300">
                                      <div className="aspect-[4/3] relative bg-black/40 overflow-hidden">
                                         <img 
                                            src={img.src} 
                                            alt={img.alt} 
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            loading="lazy"
                                            onError={(e) => {
                                               (e.target as HTMLImageElement).src = 'https://placehold.co/400x300/1e1e1e/444444?text=Image+Load+Error';
                                            }}
                                         />
                                         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                            <a href={img.src} target="_blank" rel="noreferrer" className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase text-center rounded-xl border border-white/10 backdrop-blur-sm">View Full</a>
                                         </div>
                                      </div>
                                      <div className="p-4 space-y-3">
                                         <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Alt Text</p>
                                            <p className={`text-[11px] font-bold line-clamp-1 ${img.alt && img.alt !== 'BG Image' ? 'text-slate-300 italic' : img.alt === 'BG Image' ? 'text-indigo-400' : 'text-rose-500'}`}>
                                               {img.alt || 'MISSING ALT TAG'}
                                            </p>
                                         </div>
                                         <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Title Tag</p>
                                            <p className={`text-[11px] font-bold line-clamp-1 ${img.title ? 'text-slate-400' : 'text-amber-500'}`}>
                                               {img.title || 'MISSING TITLE TAG'}
                                            </p>
                                         </div>
                                      </div>
                                   </div>
                                ))}
                             </div>
                          </div>
                       )}

                       {modalTab === 'schema' && (
                          <div className="p-8 text-center text-slate-500">
                            <Typography variant="body">Tính năng Schema đã được gỡ bỏ.</Typography>
                          </div>
                       )}

                       {modalTab === 'social' && (
                          <div className="space-y-12">
                             {/* ROW 1: GOOGLE PREVIEWS */}
                             <div className="grid grid-cols-2 gap-10">
                                <div className="space-y-4">
                                   <div className="flex items-center justify-between">
                                      <Typography variant="h4" className="text-white/50 font-black text-xs uppercase tracking-[0.2em]">Google Desktop</Typography>
                                      <span className="px-2 py-0.5 bg-white/5 rounded text-[9px] text-slate-500 font-bold uppercase tracking-widest border border-white/5">SERP Snippet</span>
                                   </div>
                                   <div className="bg-[#202124] p-8 rounded-2xl shadow-2xl border border-white/10 hover:border-blue-500/20 transition-colors group">
                                      <div className="space-y-2">
                                         <div className="flex items-center gap-2 text-[14px] text-slate-400">
                                            <span>{showDetail.url ? new URL(showDetail.url).hostname : 'website.com'}</span>
                                            <span className="text-[10px] text-slate-600">▼</span>
                                         </div>
                                         <p className="text-[20px] text-[#8ab4f8] font-medium leading-snug group-hover:underline line-clamp-1">
                                            {showDetail.title}
                                         </p>
                                         <p className="text-[14px] text-[#bdc1c6] leading-relaxed line-clamp-2">
                                            <span className="text-[#9aa0a6] mr-1">
                                               {showDetail.publishDate?.published !== 'N/A' ? `${showDetail.publishDate.published} — ` : ''}
                                            </span>
                                            {showDetail.description || "Website description will appear here to provide users context about your content in Google Search..."}
                                         </p>
                                      </div>
                                   </div>
                                </div>

                                <div className="space-y-4">
                                   <div className="flex items-center justify-between">
                                      <Typography variant="h4" className="text-white/50 font-black text-xs uppercase tracking-[0.2em]">Google Mobile</Typography>
                                      <span className="px-2 py-0.5 bg-white/5 rounded text-[9px] text-slate-500 font-bold uppercase tracking-widest border border-white/5">Device Preview</span>
                                   </div>
                                   <div className="flex justify-center">
                                      <div className="w-full max-w-[360px] bg-[#202124] rounded-3xl p-5 shadow-2xl border border-white/10 relative overflow-hidden group">
                                         <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                               <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center p-1 border border-white/5 overflow-hidden">
                                                  <img src={showDetail.favicon || '/favicon.ico'} className="w-full h-full object-contain" alt="" onError={(e) => (e.currentTarget.style.display='none')} />
                                               </div>
                                               <div>
                                                  <p className="text-[12px] text-white font-medium">{showDetail.url ? new URL(showDetail.url).hostname : 'website.com'}</p>
                                                  <p className="text-[11px] text-[#bdc1c6] line-clamp-1">{showDetail.url}</p>
                                               </div>
                                            </div>
                                            <p className="text-[18px] text-[#8ab4f8] font-medium leading-tight group-hover:underline line-clamp-2">
                                               {showDetail.title}
                                            </p>
                                            <p className="text-[14px] text-[#bdc1c6] leading-relaxed line-clamp-3">
                                               {showDetail.description || "On mobile devices, descriptions are often truncated to ensure the best search experience for users on the go."}
                                            </p>
                                         </div>
                                         {/* Mock Home Bar */}
                                         <div className="mt-8 flex justify-center">
                                            <div className="w-24 h-1 bg-white/10 rounded-full" />
                                         </div>
                                      </div>
                                   </div>
                                </div>
                             </div>

                             {/* ROW 2: FACEBOOK & TWITTER */}
                             <div className="grid grid-cols-2 gap-10">
                                <div className="space-y-4">
                                   <Typography variant="h4" className="text-white/50 font-black text-xs uppercase tracking-[0.2em]">Facebook (Open Graph)</Typography>
                                   <div className="bg-[#1c1e21] rounded-xl overflow-hidden shadow-2xl border border-white/10">
                                      <div className="h-60 bg-slate-800 flex items-center justify-center overflow-hidden">
                                         {showDetail.og?.image ? (
                                            <img src={showDetail.og.image} alt="OG" className="w-full h-full object-cover" />
                                         ) : (
                                            <Globe size={48} className="text-white/10" />
                                         )}
                                      </div>
                                      <div className="p-4 bg-[#242526]">
                                         <p className="text-[11px] text-[#b0b3b8] uppercase font-bold tracking-tight mb-1">{showDetail.url ? new URL(showDetail.url).hostname : 'N/A'}</p>
                                         <p className="text-base font-bold text-[#e4e6eb] line-clamp-1">{showDetail.og?.title || showDetail.title}</p>
                                         <p className="text-sm text-[#b0b3b8] line-clamp-2 mt-1">{showDetail.og?.description || showDetail.description}</p>
                                      </div>
                                   </div>
                                </div>

                                <div className="space-y-4">
                                   <Typography variant="h4" className="text-white/50 font-black text-xs uppercase tracking-[0.2em]">Twitter (X Card)</Typography>
                                   <div className="bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col h-fit">
                                      <div className="p-4 flex items-center gap-3">
                                         <div className="w-10 h-10 rounded-full bg-slate-800 shrink-0" />
                                         <div>
                                            <p className="text-sm font-bold text-white leading-tight">OmniSuite Pro</p>
                                            <p className="text-xs text-slate-500">@omnisuite_bot</p>
                                         </div>
                                      </div>
                                      <div className="px-4 pb-4">
                                         <p className="text-sm text-white mb-3 line-clamp-2">{showDetail.twitter?.description || showDetail.og?.description || showDetail.description}</p>
                                         <div className="rounded-2xl border border-white/10 overflow-hidden">
                                            <div className="h-48 bg-slate-800 overflow-hidden">
                                               {showDetail.og?.image ? (
                                                  <img src={showDetail.og.image} alt="Twitter" className="w-full h-full object-cover" />
                                               ) : (
                                                  <div className="w-full h-full flex items-center justify-center"><Zap size={48} className="text-white/5" /></div>
                                               )}
                                            </div>
                                            <div className="p-3 bg-black">
                                               <p className="text-[11px] text-slate-500">{showDetail.url ? new URL(showDetail.url).hostname : 'N/A'}</p>
                                               <p className="text-sm font-bold text-white line-clamp-1">{showDetail.twitter?.title || showDetail.title}</p>
                                            </div>
                                         </div>
                                      </div>
                                   </div>
                                </div>
                             </div>
                          </div>
                       )}

                    </div>
                 </div>
              </motion.div>
           </div>
         )}
      </AnimatePresence>
    </div>
  );
}
