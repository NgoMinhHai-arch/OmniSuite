'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  FileText, 
  Layout, 
  Download,
  Copy,
  Settings,
  Loader2,
  Check,
  ChevronDown,
  RefreshCw,
  Cpu,
  Upload,
  X,
  File,
  FolderOpen
} from 'lucide-react';
import { MagicIcon } from '@/shared/ui/Icons';
import Typography from '@/shared/ui/Typography';
import { getLlmCredentialsFromSettings } from '@/shared/lib/client-llm-credentials';

const SETTINGS_KEY = 'omnisuite_settings';

const providers = [
  { id: 'Gemini', name: 'Gemini', icon: Cpu },
  { id: 'OpenAI', name: 'OpenAI', icon: Cpu },
  { id: 'Claude', name: 'Claude', icon: Cpu },
  { id: 'Groq', name: 'Groq', icon: Cpu },
  { id: 'DeepSeek', name: 'DeepSeek', icon: Cpu },
  { id: 'OpenRouter', name: 'OpenRouter', icon: Cpu },
  { id: 'Ollama', name: 'Ollama', icon: Cpu },
];

export default function ContentPreview() {
  const [keyword, setKeyword] = useState('');
  const [urls, setUrls] = useState<string[]>(['', '', '']);
  const [rawData, setRawData] = useState('');
  const [framework, setFramework] = useState('Tự do');
  const [outline, setOutline] = useState('');
  const [fullArticle, setFullArticle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelName, setModelName] = useState('');
  const [copiedOutline, setCopiedOutline] = useState(false);
  const [copiedArticle, setCopiedArticle] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Writing progress
  const [writingProgress, setWritingProgress] = useState<{
    isWriting: boolean;
    currentIndex: number;
    totalSections: number;
    currentSection: string;
    completedSections: { title: string; content: string }[];
  }>({
    isWriting: false,
    currentIndex: 0,
    totalSections: 0,
    currentSection: '',
    completedSections: []
  });

  const [selectedProvider, setSelectedProvider] = useState('Gemini');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setSettings(parsed);
      
      const connected: string[] = [];
      if (parsed.gemini_api_key) connected.push('Gemini');
      if (parsed.openai_api_key) connected.push('OpenAI');
      if (parsed.claude_api_key) connected.push('Claude');
      if (parsed.groq_api_key) connected.push('Groq');
      if (parsed.deepseek_api_key) connected.push('DeepSeek');
      if (parsed.openrouter_api_key) connected.push('OpenRouter');
      if (parsed.ollama_base_url?.trim() || parsed.ollama_api_key?.trim() || parsed.default_provider === 'Ollama') {
        connected.push('Ollama');
      }
      setConnectedProviders(connected);

      const defaultProvider = parsed.default_provider || 'Gemini';
      setSelectedProvider(defaultProvider);
      if (parsed.default_model) setModelName(parsed.default_model);
    }
  }, []);

  useEffect(() => {
    const { apiKey } = getLlmCredentialsFromSettings(selectedProvider, settings);
    if (selectedProvider && (selectedProvider === 'Ollama' || apiKey)) {
      fetchModels(selectedProvider);
    } else {
      setAvailableModels([]);
    }
  }, [selectedProvider, settings]);

  const fetchModels = async (provider: string) => {
    const { apiKey, customBaseUrl } = getLlmCredentialsFromSettings(provider, settings);
    if (provider !== 'Ollama' && !apiKey) return;

    setIsLoadingModels(true);
    try {
      const resp = await fetch('/api/list-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey || 'ollama',
          ...(customBaseUrl ? { customBaseUrl } : {}),
        })
      });
      const data = await resp.json();
      
      if (data.models && data.models.length > 0) {
        setAvailableModels(data.models);
        if (!data.models.includes(modelName)) {
          setModelName(data.models[0]);
        }
      }
    } catch (err) {
      console.error('Fetch models error:', err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const showNotification = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleCopy = async (text: string, type: 'outline' | 'article') => {
    await navigator.clipboard.writeText(text);
    if (type === 'outline') setCopiedOutline(true);
    else setCopiedArticle(true);
    showNotification('Đã sao chép!');
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
    showNotification('Đã tải xuống!');
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter(f => 
      f.type === 'text/plain' || f.type === 'application/pdf' || 
      f.name.endsWith('.doc') || f.name.endsWith('.docx') ||
      f.type === 'text/html' || f.type === 'text/markdown'
    );
    setUploadedFiles(prev => [...prev, ...newFiles]);
    showNotification(`Đã thêm ${newFiles.length} file!`);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  // Parse outline to extract H2 sections
  const parseOutline = (outlineText: string): string[] => {
    const h2Regex = /^#{2}\s+(.+)$/gm;
    const matches = [];
    let match;
    while ((match = h2Regex.exec(outlineText)) !== null) {
      matches.push(match[1].trim());
    }
    return matches;
  };

  const handleStart = async (type: 'outline' | 'article') => {
    if (!keyword.trim()) return;
    setIsLoading(true);
    if (type === 'outline') setOutline(''); else setFullArticle('');
    
    const { apiKey, customBaseUrl } = getLlmCredentialsFromSettings(selectedProvider, settings);
    
    try {
      if (type === 'outline') {
        const response = await fetch('/api/generate-outline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyword,
            masterContext: rawData,
            framework,
            modelName,
            provider: selectedProvider,
            apiKey,
            ...(customBaseUrl ? { customBaseUrl } : {}),
          }),
        });
        const data = await response.json();
        setOutline(data.outline || '# Dàn ý mẫu\n\n1. Mở bài\n2. Thân bài\n3. Kết bài');
        showNotification('Đã tạo dàn ý!');
      } else {
        // Write section by section
        const sections = parseOutline(outline);
        
        if (sections.length === 0) {
          showNotification('Không tìm thấy mục nào trong dàn ý!');
          setIsLoading(false);
          return;
        }

        setWritingProgress({
          isWriting: true,
          currentIndex: 0,
          totalSections: sections.length,
          currentSection: sections[0],
          completedSections: []
        });

        const completed: { title: string; content: string }[] = [];
        let fullArticleText = `# ${keyword}\n\n`;

        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          setWritingProgress(prev => ({
            ...prev,
            currentIndex: i,
            currentSection: section
          }));

          // Call API to write this section
          const response = await fetch('/api/generate-section', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              keyword,
              sectionTitle: section,
              sectionIndex: i,
              totalSections: sections.length,
              masterContext: rawData,
              framework,
              provider: selectedProvider,
              modelName,
              apiKey,
              ...(customBaseUrl ? { customBaseUrl } : {}),
            }),
          });

          if (!response.ok) {
            throw new Error('Lỗi khi viết phần ' + section);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let sectionContent = '';

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              sectionContent += decoder.decode(value, { stream: true });
              setFullArticle(fullArticleText + sectionContent);
            }
          }

          completed.push({ title: section, content: sectionContent });
          fullArticleText += sectionContent + '\n\n';
          
          setWritingProgress(prev => ({
            ...prev,
            completedSections: [...completed]
          }));
        }

        setFullArticle(fullArticleText);
        setWritingProgress(prev => ({ ...prev, isWriting: false }));
        showNotification('Đã viết xong bài!');
      }
    } catch (err) { 
      console.error(err);
      showNotification('Lỗi! Kiểm tra API Key'); 
    } finally { 
      setIsLoading(false);
      setWritingProgress(prev => ({ ...prev, isWriting: false }));
    }
  };

  return (
    <div className="min-h-screen bg-[#050814] font-inter p-8">
      {showToast && (
        <div className="fixed top-6 right-6 z-50 px-6 py-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 font-bold text-sm">
          <Check size={16} /> {toastMessage}
        </div>
      )}

      {/* Preview Banner */}
      <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
        <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
        <p className="text-amber-400 font-bold text-sm uppercase tracking-wider">Preview Mode</p>
        <a href="/dashboard/content" className="ml-auto px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-xs font-bold uppercase tracking-wider transition-all">
          Quay lại bản cũ
        </a>
      </div>

      <div className="flex flex-col gap-10 min-h-[calc(100vh-8rem)]">
        {/* Header */}
        <header className="flex justify-between items-end border-b border-white/5 pb-10">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-6">
              <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <FileText className="text-emerald-400" size={24} />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">
                BỘ ĐIỀU PHỐI NỘI DUNG AI
              </h1>
            </div>
            <div className="flex items-center gap-4 px-2">
              <div className="w-12 h-px bg-white/10" />
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest opacity-60">TỰ ĐỘNG TẠO VÀ TỐI ƯU HÓA BÀI VIẾT</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button className="px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2">
              <FileText size={16} /> TẠO BÀI
            </button>
            <button className="px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-transparent border border-white/10 hover:bg-white/5 text-slate-300 hover:text-white transition-all">
              XUẤT BẢN
            </button>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-10 flex-1">
          {/* Config Panel */}
          <div className="col-span-12 lg:col-span-4">
            <div className="p-8 h-full bg-[#0a0f1e] border border-white/5 rounded-3xl flex flex-col gap-8">
              
              <div className="space-y-5">
                {/* Keyword */}
                <div className="space-y-2">
                  <Typography variant="label">TỪ KHÓA / CHỦ ĐỀ</Typography>
                  <div className="bg-slate-900/50 border border-white/5 p-4 rounded-xl flex items-center gap-3">
                    <Layout size={16} className="text-slate-500" />
                    <input 
                      type="text" 
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="Nhập chủ đề..."
                      className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-slate-600 font-medium text-sm"
                    />
                  </div>
                </div>

                {/* AI Config - Gọn gàng */}
                <div className="space-y-2">
                  <Typography variant="label">AI VIẾT BÀI</Typography>
                  <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <select 
                        value={selectedProvider}
                        onChange={e => { setSelectedProvider(e.target.value); setModelName(''); }}
                        disabled={connectedProviders.length === 0}
                        className="flex-1 bg-slate-800 border border-white/5 rounded-lg p-2.5 text-xs font-bold text-white outline-none cursor-pointer"
                      >
                        {connectedProviders.length === 0 ? (
                          <option value="">Chưa có AI nào được kết nối</option>
                        ) : (
                          connectedProviders.map(p => <option key={p} value={p}>{p}</option>)
                        )}
                      </select>
                      {!connectedProviders.includes(selectedProvider) && (
                        <a href="/dashboard/settings" className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-[10px] font-bold">Cài đặt</a>
                      )}
                    </div>
                    
                    <div className="relative">
                      <select 
                        value={modelName}
                        onChange={e => setModelName(e.target.value)}
                        disabled={!connectedProviders.includes(selectedProvider) || isLoadingModels}
                        className="w-full bg-slate-800 border border-white/5 rounded-lg p-2.5 text-xs font-bold text-white outline-none cursor-pointer disabled:opacity-50"
                      >
                        {!connectedProviders.includes(selectedProvider) ? (
                          <option value="">--</option>
                        ) : isLoadingModels ? (
                          <option value="">Đang tìm model...</option>
                        ) : availableModels.length === 0 ? (
                          <option value="">Không tìm được model</option>
                        ) : (
                          <>
                            <option value="">-- Chọn Model --</option>
                            {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                          </>
                        )}
                      </select>
                      {isLoadingModels && <RefreshCw size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 animate-spin" />}
                    </div>
                  </div>
                </div>

                {/* Framework */}
                <div className="space-y-2">
                  <Typography variant="label">FRAMEWORK</Typography>
                  <div className="relative">
                    <select 
                      value={framework} 
                      onChange={e => setFramework(e.target.value)} 
                      className="w-full bg-slate-800 border border-white/5 rounded-xl p-4 text-xs font-bold text-white outline-none cursor-pointer appearance-none pr-10"
                    >
                      <option>Tự do</option>
                      <option>AIDA</option>
                      <option>PAS</option>
                      <option>Blog Post</option>
                      <option>Kim tự tháp ngược</option>
                      <option>Pillar Post</option>
                      <option>How-to (Từng bước)</option>
                      <option>Listicle (Top N)</option>
                      <option>Review sản phẩm</option>
                      <option>So sánh (X vs Y)</option>
                      <option>FAQ</option>
                      <option>Skyscraper</option>
                      <option>Storytelling</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* URLs */}
                <div className="space-y-2">
                  <Typography variant="label">URL THAM KHẢO</Typography>
                  <div className="space-y-2">
                    {urls.map((url, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-900/30 border border-white/5 p-3 rounded-xl">
                        <Settings size={12} className="text-slate-600 shrink-0" />
                        <input 
                          className="flex-1 bg-transparent text-[11px] text-slate-400 placeholder:text-slate-600 outline-none"
                          placeholder="https://..." 
                          value={url} 
                          onChange={e => { const n = [...urls]; n[i] = e.target.value; setUrls(n); }} 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Raw Data */}
                <div className="space-y-2">
                  <Typography variant="label">GHI CHÚ / DỮ LIỆU</Typography>
                  <textarea 
                    placeholder="Thông tin sản phẩm, dịch vụ..."
                    value={rawData}
                    onChange={e => setRawData(e.target.value)}
                    className="w-full h-24 bg-slate-900/50 border border-white/5 rounded-xl p-4 text-xs text-slate-400 placeholder:text-slate-600 outline-none resize-none"
                  />
                </div>

                {/* Upload Files */}
                <div className="space-y-2">
                  <Typography variant="label">FILE DỮ LIỆU NỘI BỘ</Typography>
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                      ${isDragging 
                        ? 'border-emerald-500 bg-emerald-500/10' 
                        : 'border-slate-700 hover:border-slate-600 bg-slate-900/30'
                      }
                    `}
                  >
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      multiple 
                      accept=".txt,.pdf,.doc,.docx,.html,.md"
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                    />
                    <FolderOpen size={24} className={`mx-auto mb-2 ${isDragging ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <p className="text-xs font-bold text-slate-400">
                      {isDragging ? 'Thả file vào đây' : 'Kéo thả file hoặc click để chọn'}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-1">.txt .pdf .doc .docx .html .md</p>
                  </div>
                  
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {uploadedFiles.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 bg-slate-800/50 border border-white/5 rounded-lg p-2.5">
                          <File size={14} className="text-emerald-400 shrink-0" />
                          <span className="flex-1 text-[11px] text-slate-300 truncate">{file.name}</span>
                          <span className="text-[10px] text-slate-600">{(file.size / 1024).toFixed(1)}KB</span>
                          <button onClick={() => removeFile(i)} className="p-1 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-all">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-auto grid grid-cols-2 gap-3 pt-6 border-t border-white/5">
                <button 
                  onClick={() => handleStart('outline')}
                  disabled={isLoading || !keyword.trim() || !modelName}
                  className="px-4 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading && !writingProgress.isWriting ? <Loader2 size={14} className="animate-spin mx-auto" /> : '1. DÀN Ý'}
                </button>
                {outline ? (
                  <button 
                    onClick={() => handleStart('article')}
                    disabled={isLoading || !keyword.trim() || !modelName}
                    className="px-4 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 border border-emerald-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {writingProgress.isWriting ? (
                      <span className="flex items-center justify-center gap-1">
                        <Loader2 size={14} className="animate-spin" /> VIẾT...
                      </span>
                    ) : '2. VIẾT BÀI'}
                  </button>
                ) : (
                  <div className="px-4 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase bg-slate-900/50 text-slate-600 border border-white/5 flex items-center justify-center">
                    Chờ dàn ý
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results Area */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
            {/* Outline Panel */}
            <div className="bg-[#0a0f1e] border border-white/5 rounded-3xl overflow-hidden flex flex-col h-[35%]">
              <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div>
                  <Typography variant="h3" className="mb-0 text-sm font-black uppercase text-white">DÀN Ý</Typography>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest">Cấu trúc bài viết</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => outline && handleCopy(outline, 'outline')} disabled={!outline} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-all">
                    {copiedOutline ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                  <button onClick={() => outline && handleDownload(outline, `dany-${keyword.slice(0, 15) || 'mau'}.md`)} disabled={!outline} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-all">
                    <Download size={14} />
                  </button>
                </div>
              </div>
              <div className="flex-1 p-5">
                <textarea 
                  value={outline}
                  onChange={e => setOutline(e.target.value)}
                  className="w-full h-full bg-slate-900/30 border-none text-sm text-slate-400 outline-none resize-none placeholder:text-slate-700"
                  placeholder="Dàn ý sẽ xuất hiện tại đây..."
                />
              </div>
            </div>

            {/* Content Panel */}
            <div className="bg-[#0a0f1e] border border-white/5 rounded-3xl overflow-hidden flex flex-col flex-1 min-h-[350px]">
              <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div>
                  <Typography variant="h3" className="mb-0 text-sm font-black uppercase text-white">BÀI VIẾT</Typography>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest">
                    {writingProgress.isWriting 
                      ? `Đang viết phần ${writingProgress.currentIndex + 1}/${writingProgress.totalSections}`
                      : 'Nội dung hoàn chỉnh'
                    }
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => fullArticle && handleCopy(fullArticle, 'article')} disabled={!fullArticle} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-all">
                    {copiedArticle ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                  <button onClick={() => fullArticle && handleDownload(fullArticle, `bai-${keyword.slice(0, 15) || 'mau'}.md`)} disabled={!fullArticle} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-all">
                    <Download size={14} />
                  </button>
                  <button className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow-lg shadow-emerald-600/20 transition-all">
                    <FileText size={12} className="inline mr-1" /> XUẤT BẢN
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              {writingProgress.isWriting && (
                <div className="px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Loader2 size={14} className="text-emerald-400 animate-spin" />
                    <span className="text-xs font-bold text-emerald-400 uppercase">
                      Đang viết: {writingProgress.currentSection}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: writingProgress.totalSections }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-1 flex-1 rounded-full transition-all ${
                          i < writingProgress.currentIndex 
                            ? 'bg-emerald-500' 
                            : i === writingProgress.currentIndex 
                              ? 'bg-emerald-400 animate-pulse' 
                              : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex-1 bg-slate-900/30 p-8 overflow-auto">
                {fullArticle ? (
                  <article className="prose prose-invert max-w-none text-sm leading-relaxed space-y-6">
                    <ReactMarkdown
                      components={{
                        h1: ({children}) => <h1 className="text-2xl font-black text-white mb-6 mt-8 first:mt-0">{children}</h1>,
                        h2: ({children}) => <h2 className="text-xl font-bold text-emerald-400 mb-4 mt-8 border-b border-white/10 pb-3">{children}</h2>,
                        h3: ({children}) => <h3 className="text-base font-semibold text-white/90 mb-3 mt-6">{children}</h3>,
                        p: ({children}) => <p className="text-slate-300 mb-4">{children}</p>,
                        strong: ({children}) => <strong className="text-emerald-300 font-semibold">{children}</strong>,
                        ul: ({children}) => <ul className="list-disc list-inside text-slate-300 mb-4 space-y-1 pl-2">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal list-inside text-slate-300 mb-4 space-y-1 pl-2">{children}</ol>,
                        li: ({children}) => <li className="text-slate-300">{children}</li>,
                        blockquote: ({children}) => <blockquote className="border-l-4 border-emerald-500 pl-4 py-2 my-4 text-slate-400 italic bg-white/5 rounded-r-lg">{children}</blockquote>,
                      }}
                    >
                      {fullArticle}
                    </ReactMarkdown>
                  </article>
                ) : writingProgress.isWriting ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Loader2 size={48} className="text-emerald-400 animate-spin mb-4" />
                    <p className="text-emerald-400/60 text-sm font-bold uppercase tracking-wider">
                      Đang xử lý...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full opacity-10">
                    <MagicIcon size={48} className="mb-3" />
                    <Typography variant="h1" className="text-4xl font-black uppercase tracking-widest">GENESIS</Typography>
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
