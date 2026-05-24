'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTasks } from '@/shared/lib/context/TaskContext';
import { 
  Search, 
  MapPin, 
  Download, 
  Settings, 
  Trash2, 
  Maximize2, 
  Minimize2, 
  Phone, 
  Mail, 
  Globe, 
  Star, 
  ExternalLink, 
  Map, 
  Zap,
  Activity,
  CheckCircle2
} from 'lucide-react';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import Input from '@/shared/ui/Input';
import Typography from '@/shared/ui/Typography';
import { motion, AnimatePresence } from 'framer-motion';

export default function MapsPage() {
  const categoryMap: { [key: string]: string } = {
    'RESTAURANT': 'Nhà hàng',
    'VIETNAMESE RESTAURANT': 'Nhà hàng Việt Nam',
    'SEAFOOD RESTAURANT': 'Nhà hàng hải sản',
    'SPA': 'Spa',
    'BEAUTY SALON': 'Thẩm mỹ viện',
    'HAIR SALON': 'Tiệm tóc',
    'COFFEE SHOP': 'Quán cà phê',
    'CAFE': 'Quán cà phê',
    'HOTEL': 'Khách sạn',
    'CLOTHING STORE': 'Cửa hàng quần áo',
    'CLINIC': 'Phòng khám',
    'GYM': 'Phòng Gym',
    'SCHOOL': 'Trường học',
    'HOSPITAL': 'Bệnh viện',
    'PHARMACY': 'Tiệm thuốc',
    'DENTIST': 'Nha khoa',
    'PET SHOP': 'Cửa hàng thú cưng',
    'REAL ESTATE AGENCY': 'Bất động sản',
    'CAR REPAIR': 'Sửa chữa ô tô',
    'MARKET': 'Chợ',
    'SUPERMARKET': 'Siêu thị',
    'BAR': 'Quán Bar',
    'NIGHT CLUB': 'Hộp đêm',
    'PARK': 'Công viên',
    'ITALIAN RESTAURANT': 'Nhà hàng Ý',
    'KOREAN RESTAURANT': 'Nhà hàng Hàn Quốc',
    'CHINESE RESTAURANT': 'Nhà hàng Trung Quốc',
    'JAPANESE RESTAURANT': 'Nhà hàng Nhật Bản',
    'FRENCH RESTAURANT': 'Nhà hàng Pháp',
    'WESTERN RESTAURANT': 'Nhà hàng Tây',
    'CONVENIENCE STORE': 'Cửa hàng tiện lợi',
    'ELECTRONICS STORE': 'Cửa hàng điện máy',
    'FURNITURE STORE': 'Cửa hàng nội thất',
    'JEWELRY STORE': 'Cửa hàng trang sức',
    'SHRINE': 'Đền/Chùa',
    'TEMPLE': 'Chùa',
    'CHURCH': 'Nhà thờ',
    'MUSEUM': 'Bảo tàng',
    'CINEMA': 'Rạp chiếu phim',
    'BARBER SHOP': 'Tiệm cắt tóc',
    'GAS STATION': 'Cây xăng',
    'DRUGSTORE': 'Hiệu thuốc',
    'GROCERY STORE': 'Tiệm tạp hóa',
    'BAKERY': 'Tiệm bánh',
    'BOOK STORE': 'Tiệm sách',
    'FLORIST': 'Cửa hàng hoa',
    'GIFT SHOP': 'Cửa hàng quà tặng',
    'PARKING': 'Bãi đỗ xe',
    'LAUNDRY': 'Tiệm giặt ủi',
    'LIBRARY': 'Thư viện',
    'BANK': 'Ngân hàng',
    'ATM': 'Cây ATM',
    'PIZZA RESTAURANT': 'Nhà hàng Pizza',
    'STEAKHOUSE': 'Nhà hàng Bít tết',
    'SUSHI RESTAURANT': 'Nhà hàng Sushi',
    'FAST FOOD RESTAURANT': 'Cửa hàng thức ăn nhanh',
    'COFFEE ROASTERY': 'Xưởng rang cà phê'
  };

  const translateCategory = (cat: string) => {
    if (!cat) return '—';
    const upper = cat.trim().toUpperCase();
    return categoryMap[upper] || cat;
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    // Bước 1: Xóa sạch mọi ký tự lạ (icon, dấu mũi tên...) chỉ giữ lại số, dấu +, và khoảng trắng
    let p = phone.replace(/[^\d+ ]/g, '').trim();
    
    // Bước 2: Tìm và thay thế +84 (bất kể vị trí nào vì đôi khi có icon đứng trước)
    if (p.includes('+84')) {
      p = p.replace('+84', '0').replace('0 ', '0');
    }
    return p;
  };

  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [maxResults, setMaxResults] = useState(20);
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'playwright' | 'api'>('playwright');
  const [deepScan, setDeepScan] = useState(false);
  const [status, setStatus] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'serpapi'>('serpapi');

  const { startTask, getTask } = useTasks();

  // --- RE-ATTACH TO BACKGROUND TASK ---
  useEffect(() => {
    const activeTask = getTask('maps_scraping');
    if (activeTask && activeTask.status === 'running') {
      setIsLoading(true);
      setResults(activeTask.results || []);
      if (activeTask.progress) setStatus(activeTask.progress);
      
      const interval = setInterval(() => {
        const t = getTask('maps_scraping');
        if (t) {
          setResults([...t.results]);
          setStatus(t.progress);
          if (t.status !== 'running') {
            setIsLoading(false);
            clearInterval(interval);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [getTask]);

  // Link với Cấu hình Hệ thống (localStorage)
  useEffect(() => {
    const saved = localStorage.getItem('omnisuite_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (provider === 'serpapi' && parsed.serpapi_key) {
          setApiKey(parsed.serpapi_key);
        }
      } catch (e) {
        console.error('Lỗi đọc cấu hình:', e);
      }
    }
  }, [provider]);

  const PERSIST_KEY = 'omnisuite_maps_persist';

  // --- PERSISTENCE: LOAD ---
  useEffect(() => {
    const saved = sessionStorage.getItem(PERSIST_KEY);
    if (saved) {
      try {
        const { results: r, keyword: k, location: l } = JSON.parse(saved);
        if (r) setResults(r);
        if (k) setKeyword(k);
        if (l) setLocation(l);
      } catch (e) { console.error("Lỗi khôi phục Maps:", e); }
    }
  }, []);

  // --- PERSISTENCE: SAVE ---
  useEffect(() => {
    if (results.length > 0 || keyword || location) {
      const state = { results, keyword, location };
      localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
    }
  }, [results, keyword, location]);

  const handleStart = async () => {
     if (!keyword.trim()) return;
     setIsLoading(true);
     setResults([]);
     
     startTask('maps_scraping', async (update) => {
       let allResults: any[] = [];
       try {
          const response = await fetch('/api/maps/scrape', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
               keyword: `${keyword} ${location}`, 
               maxResults, 
               mode, 
               deepScan, 
               apiKey: apiKey.trim(), 
               provider 
             }),
          });
          
          if (!response.body) return;
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          
          while (true) {
             const { value, done } = await reader.read();
             if (done) break;
             
             buffer += decoder.decode(value, { stream: true });
             const lines = buffer.split('\n');
             buffer = lines.pop() || '';
             
             for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                
                try {
                   const rawData = JSON.parse(trimmed.substring(6));
                   if (rawData.type === 'log') {
                      update({ progress: rawData.message });
                      setStatus(rawData.message);
                   } else if (rawData.type === 'row') {
                      allResults = [...allResults, rawData.data];
                      setResults([...allResults]);
                      update({ results: allResults });
                   } else if (rawData.type === 'done') {
                      update({ progress: 'Hoàn thành!' });
                      setStatus('Hoàn thành!');
                   }
                } catch (e) {
                   console.error("Lỗi parse dữ liệu Maps:", e);
                }
             }
          }
       } catch (err) {
          console.error(err);
          throw err;
       } finally {
          setIsLoading(false);
       }
     });
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/maps/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, keyword }),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Maps_${keyword || 'results'}_${new Date().getTime()}.xlsx`;
      a.click();
    } catch (err) { alert('Lỗi xuất file'); }
  };

  return (
    <div className="flex flex-col gap-10 min-h-screen font-inter tool-maps-container">
      {/* Dynamic Header */}
      <header className="flex justify-between items-end pb-10" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-6">
             <div className="p-3.5 rounded-2xl border shadow-[0_0_15px_rgba(217,70,239,0.2)]" style={{ backgroundColor: 'rgba(217,70,239,0.1)', borderColor: 'rgba(217,70,239,0.3)' }}>
                <MapPin className="text-fuchsia-500" size={24} />
             </div>
             <h1 className="text-2xl font-black tracking-tighter uppercase leading-none" style={{ color: 'var(--text-primary)' }}>
                BỘ QUÉT BẢN ĐỒ
             </h1>
          </div>
          <div className="flex items-center gap-4 px-2">
             <div className="w-12 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
             <p className="text-[10px] font-black text-fuchsia-500 uppercase tracking-widest opacity-80">THU THẬP KHÁCH HÀNG TIỀM NĂNG THEO VỊ TRÍ</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-10 flex-1">
         {/* Config Panel */}
         <div className="col-span-12 lg:col-span-4">
            <Card className="p-8 h-fit sticky top-24 rounded-3xl flex flex-col gap-10" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(217,70,239,0.2)' }}>
               <div className="space-y-8">
                  <div className="flex items-center gap-3">
                     <div className="w-1 h-4 bg-fuchsia-500 rounded-full shadow-[0_0_10px_rgba(217,70,239,0.5)]" />
                     <Typography variant="h3" className="mb-0 text-lg font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>Thiết lập Quét</Typography>
                  </div>
                  
                  <div className="space-y-8">
                     <Input 
                        label="Từ khóa tìm kiếm" 
                        placeholder="Ví dụ: Salon tóc, Spa..." 
                        value={keyword} 
                        onChange={e => setKeyword(e.target.value)} 
                        onEnter={handleStart}
                        icon={Search}
                     />

                     <Input 
                        label="Địa điểm / Khu vực" 
                        placeholder="Ví dụ: Quận 1, Nha Trang..." 
                        value={location} 
                        onChange={e => setLocation(e.target.value)} 
                        onEnter={handleStart}
                        icon={MapPin}
                     />

                     <div>
                        <Input 
                           label="Số lượng Leads" 
                           type="number"
                           placeholder="Ví dụ: 50, 100, 500..." 
                           value={maxResults} 
                           onChange={e => setMaxResults(parseInt(e.target.value) || 0)} 
                           onEnter={handleStart}
                           icon={Zap}
                        />
                        {mode === 'api' && (
                           <div className="mt-4 p-4 rounded-2xl" style={{ backgroundColor: 'rgba(217,70,239,0.05)', border: '1px solid rgba(217,70,239,0.2)' }}>
                              <p className="text-[10px] text-fuchsia-500 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-2 italic">
                                 <Zap size={10} className="fill-fuchsia-500" /> Lời khuyên API:
                              </p>
                              <p className="text-[10px] font-semibold leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                 Chế độ API hoạt động ổn định và tối ưu nhất ở mức <span className="text-fuchsia-500">10 - 100 leads</span> cho một lần quét để có kết quả chính xác nhất.
                              </p>
                           </div>
                        )}
                     </div>

                     <div className="flex gap-3">
                        <button 
                           onClick={() => setMode('playwright')}
                           className={`flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border ${
                              mode === 'playwright' ? 'bg-indigo-600 border-indigo-400 text-white' : ''
                           }`}
                           style={mode === 'playwright' ? {} : { backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                        >
                           ROBOT
                        </button>
                        <button 
                           onClick={() => setMode('api')}
                           className={`flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border ${
                              mode === 'api' ? 'bg-indigo-600 border-indigo-400 text-white' : ''
                           }`}
                           style={mode === 'api' ? {} : { backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                        >
                           API KEY
                        </button>
                     </div>

                      {/* API Key Settings - chỉ hiện khi chọn API KEY mode */}
                      {mode === 'api' && (
                         <div className="space-y-3 mt-3">
                            <div className="flex gap-2">
                               <button
                                  onClick={() => setProvider('serpapi')}
                                  className={`flex-1 py-2.5 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all border ${
                                     provider === 'serpapi' ? 'bg-sky-600/30 border-sky-400/50 text-sky-300' : ''
                                  }`}
                                  style={provider === 'serpapi' ? {} : { backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                               >
                                  SerpAPI
                               </button>
                            </div>
                            {apiKey ? (
                               <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                        <Zap size={14} className="text-emerald-400 fill-emerald-400" />
                                     </div>
                                     <div>
                                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">API ĐÃ SẴN SÀNG</p>
                                        <p className="text-[9px] font-bold uppercase mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]" style={{ color: 'var(--text-muted)' }}>
                                           Khóa: {apiKey.slice(0, 8)}••••••••
                                        </p>
                                     </div>
                                  </div>
                                  <button 
                                     onClick={() => setApiKey('')}
                                     className="px-3 py-1.5 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all"
                                     style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                                  >
                                     Xóa Key
                                  </button>
                               </div>
                            ) : (
                               <Input
                                  label="API Key"
                                  placeholder='Nhập SerpAPI Key...'
                                  value={apiKey}
                                  onChange={e => setApiKey(e.target.value)}
                                  icon={Zap}
                               />
                            )}
                         </div>
                      )}

                     {/* Deep Scan Email Toggle */}
                     <div
                        onClick={() => setDeepScan(v => !v)}
                        className={`flex items-center justify-between p-5 rounded-2xl border cursor-pointer transition-all duration-300 select-none ${
                           deepScan
                              ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                              : ''
                        }`}
                        style={deepScan ? {} : { backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)' }}
                     >
                        <div className="flex items-center gap-4">
                           <Mail size={18} style={{ color: deepScan ? '#34d399' : 'var(--text-muted)' }} />
                           <div>
                              <p className="text-xs font-black uppercase tracking-widest" style={{ color: deepScan ? '#6ee7b7' : 'var(--text-secondary)' }}>
                                 Deep Scan Email
                              </p>
                              <p className="text-[9px] font-semibold mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                 {deepScan ? '⚠️ Chậm hơn · Truy cập Website/Facebook' : 'Tìm email từ website doanh nghiệp'}
                              </p>
                           </div>
                        </div>
                        {/* Toggle pill */}
                        <div className="relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0" style={{ backgroundColor: deepScan ? '#10b981' : 'var(--hover-bg)' }}>
                           <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${deepScan ? 'left-6' : 'left-1'}`} />
                        </div>
                     </div>
                  </div>
               </div>

               <div className="mt-auto pt-10" style={{ borderTop: '1px solid rgba(217,70,239,0.2)' }}>
                  <Button 
                     className="w-full h-20 text-xl font-bold tracking-widest uppercase rounded-3xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-600/20 border border-fuchsia-500/50" 
                     onClick={handleStart}
                     isLoading={isLoading}
                     variant="primary"
                     leftIcon={<MapPin size={28} />}
                  >
                     BẮT ĐẦU QUÉT
                  </Button>
               </div>
            </Card>
         </div>

         {/* Results Area */}
         <div className="col-span-12 lg:col-span-8">
            <Card className="h-full rounded-3xl overflow-hidden relative flex flex-col min-h-[600px]" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(217,70,239,0.2)' }}>
               {results.length > 0 ? (
                  <>
                     <div className="p-10 flex items-center justify-between" style={{ backgroundColor: 'var(--hover-bg)', borderBottom: '1px solid rgba(217,70,239,0.2)' }}>
                        <div className="flex flex-col gap-1">
                           <Typography variant="h3" className="mb-0 text-3xl font-bold uppercase" style={{ color: 'var(--text-primary)' }}>VỊ TRÍ ĐÃ TÌM THẤY</Typography>
                           <div className="flex items-center gap-2">
                              <p className="text-[10px] font-semibold text-fuchsia-500 uppercase tracking-widest leading-none">THU THẬP DỮ LIỆU TỰ ĐỘNG</p>
                              {status && (
                                 <>
                                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
                                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest animate-pulse">{status}</p>
                                 </>
                              )}
                           </div>
                        </div>
                        <Button variant="success" size="sm" className="px-10 h-14 font-bold uppercase text-xs tracking-widest" onClick={handleExport} leftIcon={<Download size={20} />}>XUẤT DỮ LIỆU</Button>
                     </div>
                     <div className="flex-1 overflow-auto custom-scrollbar-indigo">
                        <table className="w-full text-left min-w-[1400px]">
                           <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--card-bg)' }}>
                              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                 <th className="px-4 py-5 text-[9px] font-black uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Doanh nghiệp</th>
                                 <th className="px-4 py-5 text-[9px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">Loại hình</th>
                                 <th className="px-4 py-5 text-[9px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">SĐT</th>
                                 {deepScan && <th className="px-4 py-5 text-[9px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">Email</th>}
                                 <th className="px-4 py-5 text-[9px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">Website</th>
                                 <th className="px-4 py-5 text-[9px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">Địa chỉ</th>
                                 <th className="px-4 py-5 text-[9px] font-black text-slate-600 uppercase tracking-widest text-center whitespace-nowrap">Quảng cáo</th>
                                 {mode === 'api' && (
                                    <>
                                       <th className="px-4 py-5 text-[9px] font-black text-amber-600/60 uppercase tracking-widest text-center whitespace-nowrap">Rating</th>
                                       <th className="px-4 py-5 text-[9px] font-black text-amber-600/60 uppercase tracking-widest text-center whitespace-nowrap">Đánh giá</th>
                                    </>
                                 )}
                                 <th className="px-4 py-5"></th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-white/[0.02]">
                              {results.map((r, i) => (
                                 <tr key={i} className={`hover:bg-violet-600/[0.03] transition-colors group ${r.is_ad ? 'border-l-2 border-l-orange-500/40' : ''}`}>
                                    {/* Tên doanh nghiệp */}
                                    <td className="px-4 py-5 max-w-[220px]">
                                       <Typography variant="body" className="font-bold text-slate-200 text-sm leading-tight line-clamp-2">{r.name}</Typography>
                                    </td>
                                    {/* Loại hình */}
                                    <td className="px-4 py-5">
                                       <span className="text-[10px] text-violet-400 font-black uppercase tracking-wider whitespace-nowrap">{translateCategory(r.category)}</span>
                                    </td>
                                    {/* SĐT */}
                                    <td className="px-4 py-5">
                                       {r.phone
                                          ? <div className="text-xs text-indigo-400 font-bold flex items-center gap-1.5 whitespace-nowrap"><Phone size={11} /> {formatPhone(r.phone)}</div>
                                          : <span className="text-slate-700 text-xs">—</span>
                                       }
                                    </td>
                                    {/* Email - chỉ hiện khi bật Deep Scan */}
                                    {deepScan && (
                                       <td className="px-4 py-5 max-w-[180px]">
                                          {r.email
                                             ? <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 truncate"><Mail size={11} className="flex-shrink-0" /> {r.email}</div>
                                             : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                                          }
                                       </td>
                                    )}
                                    {/* Website */}
                                    <td className="px-4 py-5 max-w-[150px]">
                                       {r.url_web
                                          ? <a href={r.url_web} target="_blank" className="text-[10px] text-sky-400 font-bold truncate flex items-center gap-1 hover:text-sky-300 transition-colors" title={r.url_web}><Globe size={11} className="flex-shrink-0" />{r.url_web.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</a>
                                          : <span className="text-slate-700 text-xs">—</span>
                                       }
                                    </td>
                                    {/* Địa chỉ */}
                                    <td className="px-4 py-5 min-w-[220px]">
                                       <p className="text-[11px] text-slate-400 leading-relaxed">{r.address || '—'}</p>
                                    </td>
                                    {/* Quảng cáo */}
                                    <td className="px-4 py-5 text-center">
                                        {r.is_ad
                                           ? <span className="px-2.5 py-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[9px] font-black rounded-full uppercase tracking-wider whitespace-nowrap">Có quảng cáo</span>
                                           : <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[9px] font-black rounded-full uppercase tracking-wider whitespace-nowrap">Không phát hiện</span>
                                        }
                                    </td>
                                    {/* Rating & Reviews - chỉ hiển thị khi mode API */}
                                    {mode === 'api' && (
                                       <>
                                          <td className="px-4 py-5 text-center">
                                             {r.rating && r.rating !== '0'
                                                ? <div className="flex items-center justify-center gap-1"><Star size={11} className="text-amber-500 fill-amber-500" /><span className="text-xs font-black text-amber-400">{r.rating}</span></div>
                                                : <span className="text-slate-700 text-xs">—</span>
                                             }
                                          </td>
                                          <td className="px-4 py-5 text-center">
                                             {r.reviews && r.reviews !== '0'
                                                ? <span className="text-[10px] font-black text-slate-500">{Number(r.reviews).toLocaleString()}</span>
                                                : <span className="text-slate-700 text-xs">—</span>
                                             }
                                          </td>
                                       </>
                                    )}
                                    {/* Link */}
                                    <td className="px-4 py-5 text-right">
                                       <a href={r.url_map} target="_blank" className="p-2.5 hover:bg-violet-600 hover:text-white rounded-xl transition-all inline-block border" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}><ExternalLink size={14} /></a>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </>
               ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-20 relative">
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02]">
                        <Typography variant="h1" className="text-9xl font-black tracking-[0.5em] uppercase select-none">LEAD NEXUS</Typography>
                     </div>
                     
                     <div className="relative text-center space-y-8 max-w-md">
                        <div className="p-6 bg-violet-500/5 rounded-[3rem] w-fit mx-auto border border-dashed border-violet-500/20">
                           <Map size={80} className="text-violet-400/20 animate-pulse" />
                        </div>
                        <div className="space-y-4">
                           <Typography variant="h3" className="font-black uppercase text-2xl tracking-widest mb-0" style={{ color: 'var(--text-primary)' }}>Sẵn sàng quét</Typography>
                           <p className="text-xs font-black uppercase tracking-[0.4em] leading-loose" style={{ color: 'var(--text-muted)' }}>Vui lòng nhập từ khóa và địa điểm để bắt đầu quét bản đồ.</p>
                        </div>
                     </div>
                  </div>
               )}
            </Card>
         </div>
      </div>
    </div>
  );
}
