'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Image as ImageIcon, 
  Search, 
  Download, 
  Filter, 
  LayoutGrid, 
  Zap, 
  FileDown, 
  Cpu, 
  ChevronDown, 
  X, 
  RefreshCw, 
  CheckCircle2, 
  Trash2, 
  ExternalLink, 
  Maximize2,
  Trash,
  ChevronRight,
  ImagePlus,
  MapPin,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { MagicIcon } from '@/shared/ui/Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { trackToolUsage } from '@/shared/utils/metrics';
import { PLACE_TYPES } from '@/shared/types/place';

// Shared UI Components
import Button from '@/shared/ui/Button';
import Input from '@/shared/ui/Input';
import Card from '@/shared/ui/Card';
import Typography from '@/shared/ui/Typography';

const SETTINGS_KEY = 'omnisuite_settings';

type FilterStrength = 'default' | 'precise' | 'advanced';

type FilterStrengthCursorTip = { x: number; y: number; lines: string[] };

function parseFilterStrength(value: unknown): FilterStrength {
  if (value === 'precise' || value === 'advanced' || value === 'default') return value;
  return 'default';
}

interface ImageData {
  url: string;
  thumbnail: string;
  selected: boolean;
  topic?: string;
}

export default function ImagesDashboard() {
  // ... rest of state
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [placeTypeLabel, setPlaceTypeLabel] = useState('');
  const [aiFilterEnabled, setAiFilterEnabled] = useState(true);
  const [aiModel, setAiModel] = useState('system');
  const [selectedProvider, setSelectedProvider] = useState('system');
  const [allAvailableModels, setAllAvailableModels] = useState<{provider: string, label: string, models: string[], status?: 'loading'|'error'|'ready', error?: string}[]>([
    { provider: 'system', label: 'Hệ thống (Mặc định)', models: ['system'], status: 'ready' }
  ]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [activeAiProviders, setActiveAiProviders] = useState<{ id: string, label: string, key: string, desc: string }[]>([]);
  const [browserProvider, setBrowserProvider] = useState<string>('system');
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const [isPlaceTypeOpen, setIsPlaceTypeOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [premiumProvider, setPremiumProvider] = useState('serpapi');
  const [excludeTerms, setExcludeTerms] = useState('');
  const [limit, setLimit] = useState(24);
  const [filterStrength, setFilterStrength] = useState<FilterStrength>('default');
  const [filterStrengthCursorTip, setFilterStrengthCursorTip] = useState<FilterStrengthCursorTip | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImageData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [seoName, setSeoName] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [convertToWebp, setConvertToWebp] = useState(true);
  const [usePremiumApi, setUsePremiumApi] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const IMAGES_CACHE_KEY = 'omnisuite_images_session';

  // Restore Session Cache
  useEffect(() => {
    const saved = sessionStorage.getItem(IMAGES_CACHE_KEY);
    if (saved) {
      try {
        const cache = JSON.parse(saved);
        if (cache.results?.length > 0 || cache.keyword || cache.location || cache.placeTypeLabel) {
          setKeyword(cache.keyword || '');
          setLocation(cache.location || '');
          setPlaceTypeLabel(cache.placeTypeLabel || '');
          setExcludeTerms(cache.excludeTerms || '');
          setResults(cache.results || []);
          setLimit(cache.limit || 24);
          if (cache.filterStrength != null) setFilterStrength(parseFilterStrength(cache.filterStrength));
          if (cache.premiumProvider) setPremiumProvider(cache.premiumProvider);
          if (cache.usePremiumApi) setUsePremiumApi(cache.usePremiumApi);
        }
      } catch (e) {}
    }
    
    // Cleanup on unmount (Turning B off when C is clicked)
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Save Session Cache
  useEffect(() => {
    if (results.length > 0 || keyword || location || placeTypeLabel || excludeTerms) {
      sessionStorage.setItem(IMAGES_CACHE_KEY, JSON.stringify({
        keyword, location, placeTypeLabel, excludeTerms, results, limit, filterStrength, premiumProvider, usePremiumApi
      }));
    }
  }, [keyword, location, placeTypeLabel, excludeTerms, results, limit, filterStrength, premiumProvider, usePremiumApi]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filterStrengthHoverLines = useCallback((hoveredId: FilterStrength): string[] => {
    switch (hoveredId) {
      case 'default':
        return ['Nhanh • Chất lượng tốt'];
      case 'precise':
        return ['Lâu hơn • Chất lượng cao'];
      case 'advanced': {
        const lines = ['Lâu nhất • Chính xác nhất'];
        if (filterStrength === 'advanced') {
          lines.push('Mất thêm vài giây vì pool ảnh lớn hơn và ngưỡng lọc cao hơn.');
        }
        return lines;
      }
      default:
        return [];
    }
  }, [filterStrength]);

  const showFilterStrengthTip = (hoveredId: FilterStrength, e: React.MouseEvent) => {
    setFilterStrengthCursorTip({
      x: e.clientX,
      y: e.clientY,
      lines: filterStrengthHoverLines(hoveredId),
    });
  };

  const moveFilterStrengthTip = (e: React.MouseEvent) => {
    setFilterStrengthCursorTip((prev) =>
      prev ? { ...prev, x: e.clientX, y: e.clientY } : null
    );
  };

  const hideFilterStrengthTip = () => setFilterStrengthCursorTip(null);

  const getApiKey = (keyName: string) => {
    if (typeof window === 'undefined') return '';
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return '';
    try {
      const settings = JSON.parse(saved);
      const val = settings[keyName] || '';
      return typeof val === 'string' ? val.trim() : '';
    } catch (e) { return ''; }
  };

  const refreshProviders = () => {
    const providers = [
      { id: 'openai', label: 'OpenAI', key: getApiKey('openai_api_key'), desc: 'Dùng AI của OpenAI' },
      { id: 'gemini', label: 'Google Gemini', key: getApiKey('gemini_api_key'), desc: 'Dùng AI của Google' },
      { id: 'anthropic', label: 'Anthropic Claude', key: getApiKey('claude_api_key'), desc: 'Dùng AI của Anthropic' },
      { id: 'groq', label: 'Groq (Llama)', key: getApiKey('groq_api_key'), desc: 'Dùng AI của Groq (Siêu nhanh)' },
    ].filter(p => p.key);
    setActiveAiProviders(providers);
    return providers;
  };

  const fetchAllModels = async (forceProviders?: { id: string, label: string, key: string, desc: string }[]) => {
    const providersToUse = forceProviders || activeAiProviders;
    setIsFetchingModels(true);
    const initialList: {provider: string, label: string, models: string[], status?: 'loading'|'error'|'ready', error?: string}[] = [
      { provider: 'system', label: 'Hệ thống (Mặc định)', models: ['system'], status: 'ready' }
    ];
    providersToUse.forEach(p => { initialList.push({ provider: p.id, label: p.label, models: [], status: 'loading' }); });
    setAllAvailableModels(initialList);

    await Promise.all(providersToUse.map(async (p) => {
      try {
        const resp = await fetch('/api/list-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            provider: p.id === 'openai' ? 'OpenAI' : p.id === 'gemini' ? 'Gemini' : p.id === 'groq' ? 'Groq' : 'Claude', 
            apiKey: p.key 
          })
        });
        const data = await resp.json();
        setAllAvailableModels(prev => {
          const updated = prev.map(item => {
            if (item.provider === p.id) {
              if (resp.ok && data.models && data.models.length > 0) {
                return { ...item, models: data.models, status: 'ready' as const };
              } else {
                return { ...item, models: [], status: 'error' as const, error: data.error || 'Lỗi API' };
              }
            }
            return item;
          });
          return updated;
        });
      } catch (e) {
        setAllAvailableModels(prev => prev.map(item => item.provider === p.id ? { ...item, status: 'error' as const, error: 'Không thể kết nối' } : item));
      }
    }));
    setIsFetchingModels(false);
  };

  // Manage Local AI Pipeline Health
  const [pipelineStatus, setPipelineStatus] = useState<'ready'|'loading'|'error'|'stopped'>('stopped');
  
  const checkPipelineHealth = async (isWarmup = false) => {
    try {
      const method = isWarmup ? 'POST' : 'GET';
      const res = await fetch('/api/images/health', { method });
      const data = await res.json();
      setPipelineStatus(data.status);
      
      // Update the allAvailableModels list to show the real status
      setAllAvailableModels(prev => prev.map(item => {
        if (item.provider === 'system') {
          let uiStatus: 'ready'|'loading'|'error' = 'error';
          if (data.status === 'ready') uiStatus = 'ready';
          else if (data.status === 'loading') uiStatus = 'loading';
          else if (data.status === 'stopped') uiStatus = 'ready' as any; // Show as ready/available even if currently stopped
          
          return { ...item, status: uiStatus };
        }
        return item;
      }));
      return data.status;
    } catch (e) {
      setPipelineStatus('error');
      return 'error';
    }
  };

  // Trigger warmup when Model Center opens
  useEffect(() => { 
    if (isModelOpen) { 
      const cp = refreshProviders(); 
      fetchAllModels(cp); 
      checkPipelineHealth(true); // Proactive warmup
    } 
  }, [isModelOpen]);

  // Periodic polling if loading
  useEffect(() => {
    let interval: any;
    if (isModelOpen && pipelineStatus !== 'ready') {
      interval = setInterval(() => {
        checkPipelineHealth(false);
      }, 3000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isModelOpen, pipelineStatus]);

  useEffect(() => { 
    const cp = refreshProviders(); 
    fetchAllModels(cp); 
    checkPipelineHealth(); // Initial check
  }, []);

  const handleScrape = async () => {
    if (!keyword && !location && !placeTypeLabel) return;
    
    // Cancel previous to avoid conflict
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setIsLimitOpen(false);
    setIsPlaceTypeOpen(false);
    setIsModelOpen(false);
    hideFilterStrengthTip();

    setLoading(true); setError(null); setProgressMsg(null);
    try {
      const topics = keyword.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);
      let allResults: ImageData[] = [];
      let remainingLimit = limit;
      
      const serpApiKey = getApiKey('serpapi_key');

      for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        
        // Check for abort before each topic
        if (abortControllerRef.current.signal.aborted) break;

        setProgressMsg(topics.length > 1 ? `Quét chủ đề ${i + 1}/${topics.length}: ${topic}...` : `Đang tìm ảnh: ${topic}...`);
        
        // Calculate limit for this topic to ensure total doesn't exceed user's limit
        const remainingTopics = topics.length - i;
        const perTopicLimit = Math.max(2, Math.ceil(remainingLimit / remainingTopics));
        
        const res = await fetch('/api/images/scrape', {
          method: 'POST',
          body: JSON.stringify({ 
            keyword: topic, 
            limit: perTopicLimit, 
            location, 
            placeTypeLabel, 
            exclude: excludeTerms,
            usePremium: usePremiumApi,
            serpApiKey,
            aiFilterEnabled, 
            aiModel: aiModel === 'system' ? '' : aiModel, 
            aiProvider: selectedProvider,
            aiApiKey: selectedProvider === 'system' ? '' : getApiKey(`${selectedProvider}_api_key`),
            filterStrength
          }),
          signal: abortControllerRef.current.signal
        });
        
        const data = await res.json();
        if (data.success) { 
          const topicResults = data.data.map((item: any) => ({ ...item, selected: false, topic }));
          allResults = [...allResults, ...topicResults];
          
          // Update remaining limit to ensure we don't exceed user's requested total
          remainingLimit = Math.max(0, limit - allResults.length);
          
          // Stop early if we've reached the desired limit
          if (allResults.length >= limit) {
            break;
          }
        } else {
          // BÁO LỖI NGAY: Nếu lỗi từ Backend (VD: CLIP die)
          const errorMsg = data.error || 'Lỗi không xác định từ hệ thống.';
          setError(errorMsg);
          if (aiFilterEnabled) {
            setLoading(false);
            return; // Dừng quét toàn bộ nếu AI đang bật mà lỗi
          }
        }
      }

      // Final check - ensure we don't exceed the user's requested limit
      const finalResults = allResults.slice(0, limit);
      if (finalResults.length > 0) { 
        setResults(finalResults); 
        trackToolUsage('images'); 
      } else {
        // Chỉ hiện 'Không tìm thấy' nếu KHÔNG có lỗi kết nối trước đó
        setResults([]);
      }
    } catch (err: any) { setError('Lỗi kết nối máy chủ.'); } finally { setLoading(false); setProgressMsg(null); }
  };

  const toggleSelect = (index: number) => setResults(prev => prev.map((r, i) => i === index ? { ...r, selected: !r.selected } : r));
  const selectAll = () => setResults(results.map(r => ({ ...r, selected: true })));
  const deselectAll = () => setResults(results.map(r => ({ ...r, selected: false })));
  const handleClearAll = () => { setResults([]); sessionStorage.removeItem(IMAGES_CACHE_KEY); };

  const handleDownloadSingle = async (item: ImageData) => {
    try {
      const res = await fetch(item.url);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Omni_${Date.now()}.jpg`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { window.open(item.url, '_blank'); }
  };

  const handleDownloadBulk = async () => {
    const selectedItems = results.filter(r => r.selected);
    if (selectedItems.length === 0) return;
    setIsDownloading(true);
    try {
      const res = await fetch('/api/images/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems, convertToWebp, seoName: seoName || keyword || 'image' })
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `OmniMedia_${Date.now()}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (err) { setError('Lỗi tải ZIP.'); } finally { setIsDownloading(false); }
  };

  const selectedCount = results.filter(r => r.selected).length;

  return (
    <div className="flex flex-col min-h-screen selection:bg-indigo-500/30 font-inter" style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="p-8 lg:p-12 pb-6">
      <header className="flex justify-between items-end pb-10" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-6">
             <div className="p-3.5 rounded-2xl shadow-[0_0_30px_rgba(244,63,94,0.3)]" style={{ background: 'linear-gradient(to bottom right, #f43f5e, #ec4899)' }}>
                <ImageIcon className="text-white" size={24} />
             </div>
             <h1 className="text-2xl font-black tracking-tighter uppercase leading-none" style={{ color: 'var(--text-primary)' }}>
                KHỞI TẠO HÌNH ẢNH
             </h1>
          </div>
          <div className="flex flex-col gap-3 px-2">
             <div className="flex items-center gap-4">
                <div className="w-12 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest opacity-80">TÌM KIẾM VÀ LỌC HÌNH ẢNH AI THÔNG MINH</p>
             </div>
             <div className="flex flex-wrap items-center gap-x-4 gap-y-1 ml-16">
                <span className="text-[10px] font-bold text-indigo-400/80 flex items-center gap-1.5 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20"><MagicIcon size={10} /> Lọc AI</span>
                <span className="text-[10px] font-bold text-emerald-400/80 flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20"><LayoutGrid size={10} /> 10 Chủ đề</span>
                <span className="text-[10px] font-bold text-amber-400/80 flex items-center gap-1.5 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20"><Zap size={10} /> Nguồn Premium</span>
                <span className="text-[10px] font-bold text-fuchsia-400/80 flex items-center gap-1.5 bg-fuchsia-500/10 px-2 py-0.5 rounded-md border border-fuchsia-500/20"><FileDown size={10} /> Tối ưu WebP</span>
             </div>
          </div>
        </div>

      </header>
    </div>

      {/* Control Panel */}
      <div className="px-8 lg:px-12 mb-10 relative z-50">
        <Card className="relative !overflow-visible">
          <div className="flex flex-col space-y-8" aria-busy={loading}>
            {/* Row 1–2: locked while scrape runs */}
            <div
              className={`space-y-8 transition-opacity duration-200 ${loading ? 'pointer-events-none select-none opacity-[0.68]' : ''}`}
            >
            {/* Row 1: Search Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-2">
              <div className="space-y-2">
                <Typography variant="label" style={{ color: '#f43f5e' }}>Bạn tìm gì?</Typography>
                <div className="border rounded-2xl flex items-center gap-3 px-4" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'rgba(244,63,94,0.2)' }}>
                  <Search size={18} style={{ color: '#f43f5e' }} />
                  <input 
                    type="text"
                    placeholder="Nhập chủ đề (cách nhau bằng dấu phẩy)..."
                    value={keyword}
                    disabled={loading}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && handleScrape()}
                    className="flex-1 bg-transparent py-4 outline-none text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Typography variant="label" style={{ color: '#f43f5e' }}>Địa điểm</Typography>
                <div className="border rounded-2xl flex items-center gap-3 px-4" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'rgba(244,63,94,0.2)' }}>
                  <MapPin size={18} style={{ color: '#f43f5e' }} />
                  <input 
                    type="text"
                    placeholder="Hà Nội, Quận 1..."
                    value={location}
                    disabled={loading}
                    onChange={(e) => setLocation(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && handleScrape()}
                    className="flex-1 bg-transparent py-4 outline-none text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Typography variant="label" className="px-1" style={{ color: '#f43f5e' }}><LayoutGrid size={14} className="text-rose-500" /> Loại nơi chốn</Typography>
                <div className="relative">
                   <div className="border rounded-2xl flex items-center gap-3 px-4" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'rgba(244,63,94,0.2)' }}>
                    <LayoutGrid size={18} style={{ color: '#f43f5e' }} />
                    <input 
                      type="text"
                      placeholder="Chọn loại hình..."
                      value={placeTypeLabel}
                      disabled={loading}
                      onChange={(e) => { setPlaceTypeLabel(e.target.value); if (!loading) setIsPlaceTypeOpen(true); }}
                      className="flex-1 bg-transparent py-4 outline-none text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
                      style={{ color: 'var(--text-primary)' }}
                    />
                   </div>
                  <AnimatePresence>
                    {isPlaceTypeOpen && !loading && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 right-0 mt-2 z-[100] border rounded-2xl shadow-2xl max-h-[250px] overflow-y-auto custom-scrollbar" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                         <div className="sticky top-0 p-2 flex justify-end border-b" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                           <button onClick={() => setIsPlaceTypeOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg" style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
                         </div>
                         {PLACE_TYPES.filter(pt => pt.label.toLowerCase().includes(placeTypeLabel.toLowerCase())).map(pt => (
                           <button key={pt.value} onClick={() => { setPlaceTypeLabel(pt.label); setIsPlaceTypeOpen(false); }} className="w-full p-4 text-left text-sm hover:bg-white/5 border-b last:border-0 font-bold" style={{ borderColor: 'var(--border-color)' }}>{pt.label}</button>
                         ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Row 2: Advanced Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 border-t pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <div className="space-y-2">
                <Typography variant="label" style={{ color: '#f43f5e' }}>Loại trừ từ khóa</Typography>
                <div className="border rounded-2xl flex items-center gap-3 px-4" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'rgba(244,63,94,0.2)' }}>
                  <Trash2 size={18} style={{ color: '#f43f5e' }} />
                  <input 
                    type="text"
                    placeholder="VD: Logo, Mờ..."
                    value={excludeTerms}
                    disabled={loading}
                    onChange={(e) => setExcludeTerms(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && handleScrape()}
                    className="flex-1 bg-transparent py-4 outline-none text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Typography variant="label" className="px-1" style={{ color: '#f43f5e' }}><LayoutGrid size={14} style={{ color: '#f43f5e' }} /> Giới hạn</Typography>
                <div className="relative">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => !loading && setIsLimitOpen(!isLimitOpen)}
                    className="w-full rounded-2xl py-4 px-6 text-sm flex items-center justify-between font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--text-primary)' }}
                  >
                    <span>{limit} ảnh</span>
                    <ChevronDown size={18} className={`transition-transform ${isLimitOpen ? 'rotate-180 text-rose-500' : 'text-rose-500/50'}`} />
                  </button>
                  <AnimatePresence>
                    {isLimitOpen && !loading && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 right-0 mt-2 z-[100] border rounded-2xl shadow-2xl max-h-[min(20rem,calc(100vh-12rem))] overflow-y-auto scroll-pb-3 pb-1 custom-scrollbar" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                        {[12, 24, 48, 60, 100].map(v => ( <button key={v} onClick={() => { setLimit(v); setIsLimitOpen(false); }} className="w-full p-4 text-left text-sm hover:bg-white/5 border-b last:border-0 font-bold transition-all" style={{ borderColor: 'var(--border-color)' }}>{v} ảnh</button> ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="space-y-3">
                <Typography variant="label" style={{ color: '#f43f5e' }}>ĐỘ MẠNH CỦA BỘ LỌC AI</Typography>
                <div className="p-4 rounded-3xl" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(244,63,94,0.2)' }}>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {([
                      { id: 'default' as const, title: 'Mặc định' },
                      { id: 'precise' as const, title: 'Chính xác' },
                      { id: 'advanced' as const, title: 'Nâng cao' },
                    ]).map((opt) => {
                      const active = filterStrength === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={loading}
                          onClick={() => !loading && setFilterStrength(opt.id)}
                          onMouseEnter={(e) => !loading && showFilterStrengthTip(opt.id, e)}
                          onMouseMove={(e) => !loading && moveFilterStrengthTip(e)}
                          onMouseLeave={hideFilterStrengthTip}
                          className={`flex-1 rounded-2xl px-3 py-3 text-center sm:text-left transition-all border outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'bg-rose-500/15 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.12)]' : 'border-transparent hover:bg-white/5'}`}
                          style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest">{opt.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            </div>

            {/* Row 3: Action Actions — AI & Premium locked during scrape; nút tìm vẫn hiển thị trạng thái loading */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-end justify-between gap-6 pt-4">
              {/* Left: AI Analysis Pill */}
              <div className={`flex-[1.5] flex flex-col space-y-2 min-w-0 transition-opacity duration-200 ${loading ? 'pointer-events-none select-none opacity-[0.68]' : ''}`}>
                <Typography variant="label" className="px-1" style={{ color: '#f43f5e' }}>
                   <MagicIcon size={14} className={aiFilterEnabled ? "text-rose-500 animate-pulse" : "text-rose-500/50"} />
                  Trí tuệ AI
                </Typography>
                <div className={`flex items-center border rounded-full h-[64px] relative transition-all duration-500 ${aiFilterEnabled ? 'ring-4' : ''}`} style={{ backgroundColor: 'var(--hover-bg)', borderColor: aiFilterEnabled ? 'rgba(244,63,94,0.3)' : 'var(--border-color)', boxShadow: aiFilterEnabled ? '0 0 20px rgba(244,63,94,0.1)' : 'none' }}>
                  <div className="px-6 flex items-center gap-4 border-r h-full" style={{ borderColor: 'var(--border-color)' }}>
                    <button type="button" disabled={loading} onClick={() => !loading && setAiFilterEnabled(!aiFilterEnabled)} className={`w-12 h-6 rounded-full relative flex items-center px-1 transition-colors shrink-0 disabled:cursor-not-allowed disabled:opacity-70 ${aiFilterEnabled ? 'bg-rose-500' : ''}`} style={!aiFilterEnabled ? { backgroundColor: 'var(--border-color)' } : {}}>
                      <motion.div animate={{ x: aiFilterEnabled ? 24 : 0 }} className="w-4 h-4 bg-white rounded-full shadow-lg" />
                    </button>
                    <span className="text-[10px] font-bold hidden md:block" style={{ color: aiFilterEnabled ? '#f43f5e' : 'var(--text-muted)' }}>{aiFilterEnabled ? 'BẬT' : 'TẮT'}</span>
                  </div>
                  
                  <div className={`flex-1 flex items-center px-6 cursor-pointer hover:bg-white/5 transition-all rounded-r-full h-full relative min-w-0 ${!aiFilterEnabled || loading ? 'opacity-30 pointer-events-none' : ''}`} onClick={() => !loading && aiFilterEnabled && setIsModelOpen(!isModelOpen)}>
                    <div className="flex items-center gap-3 w-full min-w-0">
                      <Cpu size={16} className="text-indigo-400 shrink-0" />
                      <div className="flex flex-col items-start translate-y-[1px] min-w-0">
                         <span className="text-[8px] uppercase tracking-widest opacity-40 mb-0.5">Bộ xử lý</span>
                         <span className="text-[13px] font-bold text-slate-100 truncate w-full">{aiModel === 'system' ? 'Tối ưu hệ thống' : aiModel}</span>
                      </div>
                      <ChevronDown size={14} className={`ml-auto shrink-0 transition-transform ${isModelOpen ? 'rotate-180 text-fuchsia-400' : ''}`} />
                    </div>

                    <AnimatePresence>
                      {isModelOpen && !loading && (
                        <>
                          <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            onClick={() => setIsModelOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[190]"
                          />
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                            animate={{ opacity: 1, scale: 1, y: 0 }} 
                            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] z-[200] flex flex-col overflow-hidden w-[90vw] max-w-[700px] h-[600px] font-inter"
                            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
                          >
                            <div className="p-10 border-b flex items-center justify-between" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)' }}>
                         <div className="flex flex-col gap-1">
                            <Typography variant="h3" className="mb-0 text-3xl font-bold uppercase text-white">TÀI NGUYÊN ĐÃ TÌM THẤY</Typography>
                            <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest leading-none">HÀNG LƯỚI HÌNH ẢNH AI</p>
                         </div>
                         <Button variant="success" size="sm" className="px-10 h-14 font-bold uppercase text-xs tracking-widest" onClick={() => {}} leftIcon={<Download size={20} />}>XUẤT BẢN</Button>
                      </div>
                            
                            <div className="flex flex-1 overflow-hidden">
                              {/* Sidebar */}
                              <div className="w-[35%] border-r p-3 overflow-y-auto custom-scrollbar" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)' }}> 
                                 <Typography variant="label" className="px-4 mb-4 opacity-50 text-[9px] uppercase tracking-[0.2em] font-black">Nhà cung cấp AI</Typography>
                                 {allAvailableModels.map(g => {
                                    const isSystem = g.provider === 'system';
                                    const isSelected = browserProvider === g.provider;
                                    const dotColor = isSystem 
                                      ? (pipelineStatus === 'ready' ? 'bg-emerald-400 shadow-[0_0_12px_#34d399]' : pipelineStatus === 'loading' ? 'bg-amber-400 animate-pulse' : 'bg-rose-500')
                                      : (g.status === 'ready' && g.models.length > 0 ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : g.status === 'loading' ? 'bg-amber-400' : 'bg-slate-700');
                                    
                                    return (
                                      <button 
                                        key={g.provider} 
                                        onClick={() => setBrowserProvider(g.provider)} 
                                        className={`w-full text-left px-4 py-4 rounded-2xl text-[12px] font-bold transition-all flex flex-col mb-1.5 relative overflow-hidden group ${isSelected ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/20' : 'hover:bg-white/5'}`}
                                        style={isSelected ? {} : { color: 'var(--text-muted)' }}
                                      >
                                        <div className="flex items-center justify-between z-10">
                                           <div className="flex items-center gap-3">
                                             <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                                             <span className={isSelected ? "" : ""} style={isSelected ? { color: 'white' } : {}}>{g.label}</span>
                                           </div>
                                           {isSelected && <motion.div layoutId="model-active" className="w-1.5 h-1.5 bg-white rounded-full" />}
                                        </div>
                                        
                                        {isSystem && (
                                          <span className={`text-[9px] mt-1 ml-5 font-black uppercase opacity-60 ${isSelected ? 'text-indigo-200' : ''}`}>
                                            {pipelineStatus === 'ready' ? 'Sẵn sàng' : pipelineStatus === 'loading' ? 'Đang tải CLIP...' : 'Đã dừng'}
                                          </span>
                                        )}
                                        {g.status === 'error' && (
                                          <span className="text-[9px] mt-1 ml-5 font-black uppercase text-rose-400">Lỗi API</span>
                                        )}
                                      </button>
                                    );
                                  })} 
                                </div>

                              {/* Models List */}
                              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar relative" style={{ backgroundColor: 'var(--hover-bg)' }}>
                                {(() => {
                                  const group = allAvailableModels.find(g => g.provider === browserProvider);
                                  
                                  if (!group) return <div className="h-full flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>Vui lòng chọn nhà cung cấp</div>;
                                  
                                  if (group.status === 'loading') {
                                    return (
                                      <div className="h-full flex flex-col items-center justify-center space-y-4">
                                        <Loader2 className="animate-spin text-indigo-500" size={32} />
                                        <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Đang liệt kê models...</p>
                                      </div>
                                    );
                                  }
                                  
                                  if (group.status === 'error') {
                                    return (
                                      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                                        <AlertCircle size={40} className="text-rose-500/50" />
                                        <div>
                                          <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Không thể tải danh sách</p>
                                          <p className="text-[11px] text-rose-400/80 mt-1">{group.error || 'Vui lòng kiểm tra lại API Key trong phần Cấu hình hệ thống.'}</p>
                                        </div>
                                      </div>
                                    );
                                  }

                                  if (group.models.length === 0) {
                                    return (
                                      <div className="h-full flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-[2rem] m-2" style={{ borderColor: 'var(--border-color)' }}>
                                        <Cpu size={32} className="mb-4" style={{ color: 'var(--text-muted)' }} />
                                        <p className="text-[11px] font-black uppercase" style={{ color: 'var(--text-muted)' }}>Nhà cung cấp này phản hồi trống</p>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div className="space-y-4">
                                        <Typography variant="label">CHỌN MÔ HÌNH AI</Typography>
                                        <div className="grid grid-cols-1 gap-3">
                                           {['CLIP - Ngữ nghĩa (Nhanh)', 'DALL-E 3 - Khởi tạo', 'Stability AI'].map((p) => (
                                        <button 
                                          key={p} 
                                          onClick={() => { setAiModel(p); setSelectedProvider(browserProvider); setIsModelOpen(false); }} 
                                          className={`w-full text-left px-5 py-4 rounded-2xl text-[13px] font-bold transition-all relative flex items-center justify-between group border ${aiModel === p && selectedProvider === browserProvider ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' : 'hover:bg-white/5 border-transparent'}`}
                                          style={aiModel === p && selectedProvider === browserProvider ? {} : { color: 'var(--text-secondary)' }}>
                                          <span className="truncate pr-4">{p}</span>
                                          {aiModel === p && selectedProvider === browserProvider ? (
                                            <CheckCircle2 size={16} className="text-fuchsia-500 shrink-0" />
                                          ) : (
                                             <MagicIcon size={14} className="opacity-0 group-hover:opacity-100 text-fuchsia-500/50 transition-all" />
                                          )}
                                        </button> 
                                      ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                            
                            <div className="p-5 border-t flex justify-between items-center px-8" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)' }}> 
                               <div className="flex flex-col">
                                 <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{activeAiProviders.length} API Keys đang hoạt động</span>
                                 <span className="text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>Dữ liệu được cập nhật từ hệ thống</span>
                               </div>
                               <button 
                                onClick={(e) => { e.stopPropagation(); fetchAllModels(); }} 
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-900/10"
                              >
                                <RefreshCw size={14} className={isFetchingModels ? "animate-spin" : ""} /> 
                                {isFetchingModels ? 'Đang quét...' : 'Quét lại API'}
                              </button> 
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Middle: Premium Mode Block */}
              <div className={`flex-1 flex flex-col space-y-2 transition-opacity duration-200 ${loading ? 'pointer-events-none select-none opacity-[0.68]' : ''}`}>
                 <Typography variant="label" className="px-1">
                    <Zap size={14} className={usePremiumApi ? "text-amber-400 animate-pulse" : "text-slate-500"} /> 
                    Premium
                 </Typography>
                 <div className={`flex items-center gap-4 border rounded-full py-2 px-6 h-[64px] transition-all duration-500 ${usePremiumApi ? 'bg-amber-600/5 border-amber-500/30' : ''}`} style={usePremiumApi ? {} : { backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                    <button type="button" disabled={loading} onClick={() => !loading && setUsePremiumApi(!usePremiumApi)} className={`w-12 h-6 rounded-full relative flex items-center px-1 transition-all shrink-0 disabled:cursor-not-allowed disabled:opacity-70 ${usePremiumApi ? 'bg-amber-500' : ''}`} style={usePremiumApi ? {} : { backgroundColor: 'var(--hover-bg)' }}>
                        <motion.div animate={{ x: usePremiumApi ? 24 : 0 }} className="w-4 h-4 bg-white rounded-full shadow-lg" />
                    </button>
                    
                    <AnimatePresence>
                      {usePremiumApi && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex items-center gap-2 border-l border-white/10 pl-4 whitespace-nowrap overflow-hidden">
                           {['serpapi'].map(p => (
                             <button key={p} type="button" disabled={loading} onClick={() => !loading && setPremiumProvider(p)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all disabled:cursor-not-allowed disabled:opacity-70 ${premiumProvider === p ? 'bg-amber-500 text-white shadow-xl scale-105' : 'bg-white/5 text-slate-500 hover:text-white'}`}>
                               {p}
                             </button>
                           ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>
              </div>

              {/* Right: Scan Button */}
              <div className="flex-col space-y-2 hidden lg:flex shrink-0">
                   <Button 
                      className="w-full h-20 text-xl font-bold tracking-widest uppercase rounded-3xl" 
                      onClick={handleScrape}
                      isLoading={loading}
                      disabled={loading}
                      variant="primary"
                      leftIcon={<ImagePlus size={28} />}
                   >
                      BẮT ĐẦU TÌM KIẾM
                   </Button>
              </div>

              {/* Mobile Scan Button */}
              <Button onClick={handleScrape} isLoading={loading} disabled={loading} className="lg:hidden w-full py-4 rounded-2xl shrink-0" leftIcon={<Search />}>
                Tìm kiếm
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Progress & Error */}
      <div className="px-8 lg:px-12">
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl text-indigo-400 text-center font-bold mb-8 flex items-center justify-center gap-4 shadow-xl shadow-indigo-900/10 backdrop-blur-md">
              <Loader2 className="animate-spin" /> {progressMsg || 'Đang cào dữ liệu...'}
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl text-red-400 text-center font-bold mb-8 flex items-center justify-center gap-3 shadow-xl shadow-red-900/10 backdrop-blur-md">
              <AlertCircle size={20} /> {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results Section Header */}
      <div className="px-8 lg:px-12 pb-20 space-y-6">
        {results.length > 0 && (
          <div className="sticky top-4 z-40 glass border border-white/10 p-4 px-6 rounded-3xl shadow-2xl flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-8 font-bold">
              <Typography variant="body" className="font-bold">Đã chọn: <strong className="text-indigo-400 text-2xl">{selectedCount}</strong> / {results.length}</Typography>
              <div className="flex gap-5 border-l border-white/10 pl-8">
                <button onClick={selectAll} className="text-[10px] font-black text-indigo-400 hover:text-white uppercase tracking-widest transition-all">Chọn hết</button>
                <button onClick={deselectAll} className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-all">Bỏ chọn</button>
                <button onClick={handleClearAll} className="text-[10px] font-black text-red-500/70 hover:red-400 uppercase tracking-widest flex items-center gap-2 transition-all"><Trash2 size={14} /> Xóa sạch</button>
              </div>
            </div>
            <div className="flex items-center gap-4">
               <input 
                type="text" 
                value={seoName} 
                onChange={(e) => setSeoName(e.target.value)} 
                placeholder="Tên SEO Zip..." 
                className="border rounded-2xl py-3.5 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all w-[200px]"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }} 
              />
               <Button 
                onClick={handleDownloadBulk} 
                disabled={selectedCount === 0 || isDownloading} 
                variant="success"
                leftIcon={<FileDown />}
                className="px-8"
              >
                TẢI XUỐNG ({selectedCount})
              </Button>
            </div>
          </div>
        )}

        {results.length === 0 && !loading ? (
          <div className="relative text-center space-y-12 max-w-lg mx-auto">
                         <div className="relative group">
                            <div className="absolute inset-0 bg-indigo-500/20 blur-3xl opacity-50 group-hover:opacity-100 transition-all rounded-full" />
                            <div className="p-12 rounded-[4rem] border-4 border-dashed relative z-10 shadow-2xl skew-x-[-2deg]" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                              <ImageIcon size={120} className="text-white opacity-[0.05]" />
                            </div>
                         </div>
                         <div className="space-y-6">
                            <Typography variant="h3" className="font-bold uppercase text-3xl tracking-widest mb-0 leading-none" style={{ color: 'var(--text-primary)' }}>SẴN SÀNG NHIỆM VỤ</Typography>
                            <p className="text-xs font-semibold uppercase tracking-widest leading-loose" style={{ color: 'var(--text-muted)' }}>Đang chờ các thông số hình ảnh để bắt đầu giao thức tìm kiếm.</p>
                         </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {results.map((item, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, scale: 0.9 }} 
                animate={{ opacity: 1, scale: 1 }} 
                transition={{ delay: (idx % 12) * 0.05 }} 
                onClick={() => toggleSelect(idx)} 
                className={`group relative aspect-square rounded-[2rem] overflow-hidden border-2 transition-all cursor-pointer ${item.selected ? 'border-indigo-500 ring-[6px] ring-indigo-500/10' : ''}`}
                style={item.selected ? {} : { borderColor: 'var(--border-color)' }}
              >
                <img src={`/api/images/proxy?url=${encodeURIComponent(item.thumbnail || item.url)}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="img" loading="lazy" />
                <div className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all ${item.selected ? 'bg-indigo-600 text-white shadow-lg' : 'bg-black/40 text-transparent border border-white/10'}`}><CheckCircle2 size={18} /></div>
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex justify-between items-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); handleDownloadSingle(item); }} className="p-2.5 bg-white/10 hover:bg-emerald-500 text-white rounded-xl backdrop-blur-md transition-all active:scale-90"><Download size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setZoomImage(item.url); }} className="p-2.5 bg-white/10 hover:bg-indigo-500 text-white rounded-xl backdrop-blur-md transition-all active:scale-90"><Maximize2 size={14} /></button>
                    </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Image Zoom Modal */}
      <AnimatePresence>
        {zoomImage && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setZoomImage(null)}
              className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[300] flex items-center justify-center p-4 md:p-10"
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.9, y: 20 }} 
                onClick={(e) => e.stopPropagation()}
                className="relative max-w-full max-h-full rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10"
              >
                <img 
                  src={`/api/images/proxy?url=${encodeURIComponent(zoomImage)}`} 
                  alt="Zoom" 
                  className="max-w-full max-h-[90vh] object-contain"
                />
              </motion.div>

              {/* Floating Buttons - Moved outside image container */}
              <div className="fixed top-8 right-8 flex gap-4 z-[310]">
                <button 
                  onClick={(e) => {
                      e.stopPropagation();
                      const a = document.createElement('a');
                      a.href = `/api/images/proxy?url=${encodeURIComponent(zoomImage)}`;
                      a.download = `OmniZoom_${Date.now()}.jpg`;
                      document.body.appendChild(a); a.click(); a.remove();
                  }}
                  className="p-4 hover:bg-emerald-500 rounded-2xl backdrop-blur-md border transition-all active:scale-90 group"
                  style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                  title="Tải xuống"
                >
                  <Download size={24} className="group-hover:scale-110 transition-transform" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setZoomImage(null); }}
                  className="p-4 hover:bg-white/20 rounded-2xl backdrop-blur-md border transition-all active:scale-90"
                  style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                  title="Đóng (Hoặc nhấn ra ngoài)"
                >
                  <X size={24} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {mounted &&
        filterStrengthCursorTip &&
        typeof document !== 'undefined' &&
        createPortal(
          (() => {
            const pad = 10;
            const offset = 18;
            const maxW = 260;
            const lineH = 18;
            const estH = filterStrengthCursorTip.lines.length * lineH + 20;
            let left = filterStrengthCursorTip.x + offset;
            let top = filterStrengthCursorTip.y + offset;
            const vw = typeof window !== 'undefined' ? window.innerWidth : left + maxW;
            const vh = typeof window !== 'undefined' ? window.innerHeight : top + estH;
            left = Math.min(Math.max(pad, left), vw - maxW - pad);
            top = Math.min(Math.max(pad, top), vh - estH - pad);
            return (
              <div
                role="tooltip"
                className="pointer-events-none fixed z-[280] max-w-[260px] rounded-xl border border-rose-500/25 bg-[rgba(18,18,24,0.96)] px-3 py-2 shadow-2xl shadow-black/50 backdrop-blur-md"
                style={{ left, top }}
              >
                {filterStrengthCursorTip.lines.map((line, i) => (
                  <p
                    key={i}
                    className={`text-[10px] font-semibold leading-snug ${i > 0 ? 'mt-1.5 text-white/75' : 'text-white/95'}`}
                  >
                    {line}
                  </p>
                ))}
              </div>
            );
          })(),
          document.body
        )}
    </div>
  );
}
