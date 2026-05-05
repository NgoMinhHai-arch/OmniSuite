'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Layout, 
  Sparkles,
  Download,
  Copy,
  Save,
  Settings,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import Typography from '@/shared/ui/Typography';

export default function ContentEnginePreview() {
  const [keyword, setKeyword] = useState('');
  const [urls, setUrls] = useState<string[]>(['', '', '']);
  const [rawData, setRawData] = useState('');
  const [framework, setFramework] = useState('Tự do');
  const [outline, setOutline] = useState('');
  const [fullArticle, setFullArticle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelName, setModelName] = useState('llama-3.3-70b-versatile');
  const [copiedOutline, setCopiedOutline] = useState(false);
  const [copiedArticle, setCopiedArticle] = useState(false);

  const handleCopy = async (text: string, type: 'outline' | 'article') => {
    await navigator.clipboard.writeText(text);
    if (type === 'outline') setCopiedOutline(true);
    else setCopiedArticle(true);
    setTimeout(() => {
      if (type === 'outline') setCopiedOutline(false);
      else setCopiedArticle(false);
    }, 2000);
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStart = async (type: 'outline' | 'article') => {
    if (!keyword.trim()) return;
    setIsLoading(true);
    if (type === 'outline') setOutline(''); else setFullArticle('');
    
    try {
      const response = await fetch(type === 'outline' ? '/api/generate-outline' : '/api/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, urls, rawData, framework, modelName }),
      });
      const data = await response.json();
      if (type === 'outline') setOutline(data.outline); else setFullArticle(data.article);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <div className="flex flex-col gap-10 min-h-screen font-inter pb-20">
      {/* Header */}
      <header className="flex justify-between items-end border-b border-white/5 pb-10">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-6">
            <div className="p-3.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
              <FileText className="text-indigo-400" size={24} />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">
              BỘ ĐIỀU PHỐI NỘI DUNG AI
            </h1>
          </div>
          <div className="flex items-center gap-4 px-2">
            <div className="w-12 h-px bg-white/10" />
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest opacity-60">TỰ ĐỘNG TẠO VÀ TỐI ƯU HÓA BÀI VIẾT</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button className="px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2">
            <FileText size={16} /> TẠO BÀI
          </button>
          <button className="px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-transparent border border-white/10 hover:bg-white/5 text-slate-300 hover:text-white transition-all flex items-center gap-2">
            XUẤT BẢN
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-10 flex-1">
        {/* Config Panel */}
        <div className="col-span-12 lg:col-span-4">
          <div className="p-8 h-full bg-[#0a0f1e] border border-white/5 rounded-3xl flex flex-col gap-10">
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-1 h-4 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                <Typography variant="h3" className="mb-0 text-lg font-black uppercase tracking-widest text-white">Thiết lập Bài viết</Typography>
              </div>
              
              <div className="space-y-6">
                {/* Keyword Input */}
                <div className="space-y-3">
                  <Typography variant="label">TỪ KHÓA CHÍNH / CHỦ ĐỀ</Typography>
                  <div className="bg-slate-900/50 border border-white/5 p-4 rounded-xl group focus-within:border-indigo-500/30 transition-all flex items-center gap-4">
                    <Layout size={18} className="text-slate-500" />
                    <input 
                      type="text" 
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="Nhập chủ đề bài viết..."
                      className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-slate-600 font-medium"
                    />
                  </div>
                </div>

                {/* Framework & Model */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Typography variant="label">Framework</Typography>
                    <select 
                      value={framework} 
                      onChange={e => setFramework(e.target.value)} 
                      className="w-full bg-slate-900/50 border border-white/5 rounded-xl p-4 text-xs font-bold text-slate-300 outline-none appearance-none cursor-pointer hover:border-white/10 transition-all"
                    >
                      <option>Tự do</option>
                      <option>AIDA</option>
                      <option>PAS</option>
                      <option>Blog Post</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Typography variant="label">Model AI</Typography>
                    <select 
                      value={modelName} 
                      onChange={e => setModelName(e.target.value)} 
                      className="w-full bg-slate-900/50 border border-white/5 rounded-xl p-4 text-xs font-bold text-slate-300 outline-none appearance-none cursor-pointer hover:border-white/10 transition-all"
                    >
                      <option>llama-3.3-70b-versatile</option>
                      <option>llama3-70b-8192</option>
                    </select>
                  </div>
                </div>

                {/* URLs */}
                <div className="space-y-3">
                  <Typography variant="label">URL ĐỐI THỦ (Nguồn tham khảo)</Typography>
                  <div className="space-y-3">
                    {urls.map((url, i) => (
                      <div key={i} className="flex items-center gap-3 bg-slate-900/30 border border-white/5 p-3 rounded-xl hover:border-white/10 transition-all">
                        <Settings size={14} className="text-slate-500" />
                        <input 
                          className="flex-1 bg-transparent text-[11px] text-slate-400 placeholder:text-slate-600 outline-none"
                          placeholder="https://doithu.com/article" 
                          value={url} 
                          onChange={e => {
                            const n = [...urls];
                            n[i] = e.target.value;
                            setUrls(n);
                          }} 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Raw Data */}
                <div className="space-y-2">
                  <Typography variant="label">DỮ LIỆU THÔ / GHI CHÚ</Typography>
                  <textarea 
                    placeholder="Paste thông tin chi tiết về sản phẩm/dịch vụ tại đây..." 
                    value={rawData}
                    onChange={e => setRawData(e.target.value)}
                    className="w-full h-32 bg-slate-900/50 border border-white/5 rounded-xl p-4 text-xs text-slate-400 placeholder:text-slate-600 outline-none resize-none hover:border-white/10 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-auto grid grid-cols-2 gap-4 pt-8 border-t border-white/5">
              <button 
                onClick={() => handleStart('outline')}
                disabled={isLoading || !keyword.trim()}
                className="px-6 py-4 rounded-xl text-[10px] font-black tracking-widest uppercase bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/5 hover:border-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Layout size={16} />} 
                1. DÀN Ý
              </button>
              <button 
                onClick={() => handleStart('article')}
                disabled={isLoading || !keyword.trim()}
                className="px-6 py-4 rounded-xl text-[10px] font-black tracking-widest uppercase bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 border border-indigo-500/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} 
                2. VIẾT BÀI
              </button>
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-10">
          {/* Outline Panel */}
          <div className="bg-[#0a0f1e] border border-white/5 rounded-3xl relative overflow-hidden flex flex-col h-[40%]">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex flex-col gap-1">
                <Typography variant="h3" className="mb-0 text-base font-black uppercase text-white tracking-wider">DÀN Ý BÀI VIẾT</Typography>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none">CẤU TRÚC AI ĐÃ ĐỒNG BỘ</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => outline && handleCopy(outline, 'outline')}
                  disabled={!outline}
                  className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white transition-all disabled:opacity-30"
                  title="Sao chép"
                >
                  <Copy size={16} />
                </button>
                <button 
                  onClick={() => outline && handleDownload(outline, `dany-${keyword.slice(0, 20)}.md`)}
                  disabled={!outline}
                  className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white transition-all disabled:opacity-30"
                  title="Tải xuống"
                >
                  <Download size={16} />
                </button>
                <button className="px-4 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center gap-2">
                  <Save size={14} /> LƯU
                </button>
              </div>
            </div>
            <div className="flex-1 relative z-10">
              <textarea 
                value={outline}
                onChange={e => setOutline(e.target.value)}
                className="w-full h-full bg-slate-900/30 border-none rounded-b-3xl p-6 text-sm text-slate-400 outline-none resize-none custom-scrollbar-indigo"
                placeholder="Dàn ý bài viết sẽ xuất hiện tại đây..."
              />
            </div>
          </div>

          {/* Content Panel */}
          <div className="bg-[#0a0f1e] border border-white/5 rounded-3xl relative overflow-hidden flex flex-col flex-1 min-h-[400px]">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex flex-col gap-1">
                <Typography variant="h3" className="mb-0 text-base font-black uppercase text-white tracking-wider">BÀI VIẾT HOÀN CHỈNH</Typography>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none">NỘI DUNG AI TỐI ƯU SEO</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => fullArticle && handleCopy(fullArticle, 'article')}
                  disabled={!fullArticle}
                  className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white transition-all disabled:opacity-30"
                  title="Sao chép"
                >
                  <Copy size={16} />
                </button>
                <button 
                  onClick={() => fullArticle && handleDownload(fullArticle, `bai-viet-${keyword.slice(0, 20)}.md`)}
                  disabled={!fullArticle}
                  className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white transition-all disabled:opacity-30"
                  title="Tải xuống"
                >
                  <Download size={16} />
                </button>
                <button className="px-4 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20">
                  <FileText size={14} /> XUẤT BẢN
                </button>
              </div>
            </div>
            
            <div className="flex-1 relative z-10 bg-slate-900/30 rounded-b-3xl overflow-hidden">
               <div className="h-full w-full overflow-auto p-8 custom-scrollbar-indigo">
                  {fullArticle ? (
                     <div className="prose prose-invert prose-p:text-slate-400 prose-headings:text-white max-w-none">
                        {fullArticle}
                     </div>
                  ) : (
                     <div className="flex flex-col items-center justify-center h-full opacity-10">
                        <Sparkles size={60} className="mb-4" />
                        <Typography variant="h1" className="text-5xl font-black uppercase tracking-widest">GENESIS</Typography>
                     </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
