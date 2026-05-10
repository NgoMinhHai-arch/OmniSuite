'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  FileText, 
  Layout, 
  Download,
  Copy,
  Trash2,
  Trash,
  CheckCircle2,
  Activity,
  Globe,
  Maximize2,
  ChevronRight,
  Share2,
  Save,
  Settings,
  Loader2,
  Check,
  ChevronDown,
  RefreshCw,
  Search,
  Cpu,
  Upload,
  X,
  File,
  FolderOpen,
  Zap,
  Edit3,
  Eye,
  Eraser,
  Bold,
  Italic,
  List,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon
} from 'lucide-react';
import { MagicIcon, GaugeIcon, TargetIcon } from '@/shared/ui/Icons';
import { analyzeContentSeo, SeoAnalysisResult } from '@/shared/utils/seo-analyzer';
import { trackToolUsage, addHistory, trackAPICall, trackExport } from '@/shared/utils/metrics';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import Input from '@/shared/ui/Input';
import Typography from '@/shared/ui/Typography';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '@/shared/lib/context/TaskContext';
import type { BulkContentJobStatus, ContentPlatformPreset } from '@/shared/contracts/content-engine';
import { getLlmCredentialsFromSettings } from '@/shared/lib/client-llm-credentials';

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

export default function ContentEngine() {
  const [topic, setTopic] = useState('');
  const [keyword, setKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [urls, setUrls] = useState<string[]>(['', '', '']);
  const [rawData, setRawData] = useState('');
  const [framework, setFramework] = useState('Tự do');
  const [outline, setOutline] = useState('');
  const [tavilyContext, setTavilyContext] = useState('');
  const [fullArticle, setFullArticle] = useState('');
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [hoveredRows, setHoveredRows] = useState(0);
  const [hoveredCols, setHoveredCols] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [modelName, setModelName] = useState('');
  const [copiedOutline, setCopiedOutline] = useState(false);
  const [copiedArticle, setCopiedArticle] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorImageInputRef = useRef<HTMLInputElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(false);

  const [showSeoDrawer, setShowSeoDrawer] = useState(false);
  const [seoResults, setSeoResults] = useState<SeoAnalysisResult | null>(null);
  const [isEditingArticle, setIsEditingArticle] = useState(false);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [seoSource, setSeoSource] = useState<'main' | 'draft'>('main');

  const [writingProgress, setWritingProgress] = useState<{
    isWriting: boolean;
    currentIndex: number;
    totalSections: number;
    currentSection: string;
  }>({
    isWriting: false,
    currentIndex: 0,
    totalSections: 0,
    currentSection: ''
  });

  const [selectedProvider, setSelectedProvider] = useState('Gemini');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelSearch, setModelSearch] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [openrouterCatalog, setOpenrouterCatalog] = useState<OpenRouterModelMeta[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [outputMode, setOutputMode] = useState<'single' | 'bulk'>('single');
  const [platformPreset, setPlatformPreset] = useState<ContentPlatformPreset>('googleSeoLongForm');
  const [bulkKeywords, setBulkKeywords] = useState('');
  const [bulkJob, setBulkJob] = useState<BulkContentJobStatus | null>(null);
  const [researchSources, setResearchSources] = useState<Array<{ title: string; url: string; snippet: string }>>([]);

  const { startTask, getTask } = useTasks();

  // --- RE-ATTACH TO BACKGROUND TASK ---
  useEffect(() => {
    const activeTask = getTask('content_generation');
    if (activeTask && activeTask.status === 'running') {
      setIsLoading(true);
      if (activeTask.metadata?.fullArticle) setFullArticle(activeTask.metadata.fullArticle);
      if (activeTask.metadata?.writingProgress) setWritingProgress(activeTask.metadata.writingProgress);
      
      const interval = setInterval(() => {
        const t = getTask('content_generation');
        if (t) {
          if (t.metadata?.fullArticle) setFullArticle(t.metadata.fullArticle);
          if (t.metadata?.writingProgress) setWritingProgress(t.metadata.writingProgress);
          if (t.status !== 'running') {
            setIsLoading(false);
            clearInterval(interval);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [getTask]);

  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, string>;
      setSettings(parsed);
      
      const connected: string[] = [];
      if (parsed.gemini_api_key) connected.push('Gemini');
      if (parsed.openai_api_key) connected.push('OpenAI');
      if (parsed.claude_api_key) connected.push('Claude');
      if (parsed.groq_api_key) connected.push('Groq');
      if (parsed.openrouter_api_key) connected.push('OpenRouter');
      if (parsed.deepseek_api_key) connected.push('DeepSeek');
      if (parsed.ollama_base_url?.trim() || parsed.ollama_api_key?.trim() || parsed.default_provider === 'Ollama') {
        connected.push('Ollama');
      }

      setConnectedProviders(connected);

      const defaultProvider = parsed.default_provider || 'Gemini';
      // Ensure provider shown in UI is actually connected; otherwise fallback.
      const resolvedProvider = connected.includes(defaultProvider)
        ? defaultProvider
        : (connected[0] || defaultProvider);
      setSelectedProvider(resolvedProvider);

      // Keep default model only for its matching provider to avoid stale disabled state.
      if (parsed.default_model && resolvedProvider === defaultProvider) {
        setModelName(parsed.default_model);
      } else {
        setModelName('');
      }
    }
  }, []);

  const PERSIST_KEY = 'omnisuite_content_persist';

  useEffect(() => {
    const saved = sessionStorage.getItem(PERSIST_KEY);
    if (saved) {
      try {
        const { topic: tp, keyword: k, secondaryKeywords: sk, urls: u, rawData: r, framework: f, outline: o, tavilyContext: t, fullArticle: a } = JSON.parse(saved);
        if (tp) setTopic(tp);
        if (k) setKeyword(k);
        if (sk) setSecondaryKeywords(sk);
        if (u) setUrls(u);
        if (r) setRawData(r);
        if (f) setFramework(f);
        if (o) setOutline(o);
        if (t) setTavilyContext(t);
        if (a) setFullArticle(a);
      } catch {}
    }
  }, []);

  useEffect(() => {
    const state = { topic, keyword, secondaryKeywords, urls, rawData, framework, outline, tavilyContext, fullArticle };
    sessionStorage.setItem(PERSIST_KEY, JSON.stringify(state));
  }, [topic, keyword, secondaryKeywords, urls, rawData, framework, outline, tavilyContext, fullArticle]);

  useEffect(() => {
    const { apiKey } = getLlmCredentialsFromSettings(selectedProvider, settings);
    if (selectedProvider && (selectedProvider === 'Ollama' || apiKey)) {
      fetchModels(selectedProvider);
    } else {
      setAvailableModels([]);
    }
    setIsModelDropdownOpen(false);
    setModelSearch('');
  }, [selectedProvider, settings]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!modelDropdownRef.current) return;
      if (!modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

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
      
      if (!resp.ok) {
        throw new Error(data.error || "Không thể tải danh sách model");
      }

      if (data.models && data.models.length > 0) {
        setAvailableModels(data.models);
        setOpenrouterCatalog(Array.isArray(data.openrouterCatalog) ? data.openrouterCatalog : []);
        if (!data.models.includes(modelName)) {
          setModelName(data.models[0]);
        }
      } else {
        setOpenrouterCatalog([]);
      }
    } catch (err) {
      console.error('Fetch models error:', err);
      setOpenrouterCatalog([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), type === 'error' ? 6000 : 2000);
  };

  /** Browser chỉ báo "Failed to fetch" khi không có TCP/tới được Next/API hoặc Next không proxy được sang Python engine. */
  const explainFetchFailure = (err: unknown): Error => {
    if (err instanceof TypeError) {
      const m = err.message || '';
      if (
        m === 'Failed to fetch' ||
        /failed to fetch|networkerror|load failed/i.test(m)
      ) {
        return new Error(
          'Không kết nối được máy chủ (Failed to fetch). Kiểm tra: (1) Next.js đang chạy, (2) Python Content Engine đã bật trên cổng trong PYTHON_ENGINE_URL (mặc định http://127.0.0.1:8082), (3) tường lửa/proxy không chặn localhost.'
        );
      }
    }
    if (err instanceof Error) return err;
    return new Error('Lỗi mạng không xác định.');
  };

  async function fetchJsonOrThrow(input: RequestInfo | URL, init?: RequestInit) {
    let resp: Response;
    try {
      resp = await fetch(input, init);
    } catch (e) {
      throw explainFetchFailure(e);
    }
    let data: Record<string, unknown>;
    try {
      data = (await resp.json()) as Record<string, unknown>;
    } catch {
      const txt = await resp.text().catch(() => '');
      throw new Error(
        resp.ok
          ? `Phản hồi không phải JSON: ${txt.slice(0, 160)}`
          : `HTTP ${resp.status}: ${txt.slice(0, 240)}`
      );
    }
    return { resp, data };
  }

  const handleCopy = async (text: string, type: 'outline' | 'article') => {
    await navigator.clipboard.writeText(text);
    if (type === 'outline') {
      setCopiedOutline(true);
      addHistory('Viết bài AI', 'Sao chép dàn ý', `Đã sao chép dàn ý bài viết vào Clipboard`, 'info');
    } else {
      setCopiedArticle(true);
      addHistory('Viết bài AI', 'Sao chép nội dung', `Đã sao chép nội dung bài viết vào Clipboard`, 'info');
    }
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
    trackExport();
    addHistory('Viết bài AI', 'Tải xuống bài viết', `Đã tải về file: ${filename}`);
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

  const parseOutline = (outlineText: string): string[] => {
    // Regex linh hoạt hơn: Chấp nhận ## hoặc ###, bỏ qua các ký tự định dạng như **
    const h2Regex = /^#{2,3}\s*([^*#\n]+.*)$/gm;
    const matches = [];
    let match;
    while ((match = h2Regex.exec(outlineText)) !== null) {
      const title = match[1].replace(/\*\*|\*/g, '').trim();
      if (title && !title.toLowerCase().includes('dàn ý')) {
        matches.push(title);
      }
    }
    return matches;
  };

  const pollBulkJob = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        let resp: Response;
        try {
          resp = await fetch(`/api/content-jobs/${jobId}`);
        } catch (netErr) {
          throw explainFetchFailure(netErr);
        }
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Không thể đọc trạng thái job');
        setBulkJob(data);
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
          clearInterval(interval);
          setIsLoading(false);
          if (data.status === 'completed') {
            const first = data.results?.[0];
            if (first?.outline) setOutline(first.outline);
            if (first?.article) setFullArticle(first.article);
            if (first?.research?.sources) setResearchSources(first.research.sources);
            showNotification(`Bulk hoàn tất: ${data.results?.length || 0} bài`, 'success');
          } else if (data.status === 'failed') {
            showNotification(data.error || 'Bulk job thất bại', 'error');
          } else {
            showNotification('Đã hủy bulk job', 'error');
          }
        }
      } catch (err: unknown) {
        clearInterval(interval);
        setIsLoading(false);
        const message = err instanceof Error ? err.message : 'Lỗi polling bulk job';
        showNotification(message, 'error');
      }
    }, 2200);
  };

  const handleStart = async (type: 'outline' | 'article') => {
    if (outputMode !== 'bulk' && !keyword.trim()) return;
    setIsLoading(true);
    cancelRef.current = false;
    if (type === 'outline') setOutline(''); else { setFullArticle(''); setIsEditingArticle(false); }
    
    const { apiKey: llmKey, customBaseUrl } = getLlmCredentialsFromSettings(selectedProvider, settings);
    
    if (!llmKey && selectedProvider !== 'Ollama') {
      showNotification('Chưa cấu hình API key. Mở Cấu hình hệ thống để thêm key hoặc Ollama.', 'error');
      setIsLoading(false);
      return;
    }

    try {
      let currentOutline = outline;
      let currentTavilyContext = tavilyContext;
      if (outputMode === 'bulk' && type === 'article') {
        const kws = (bulkKeywords || keyword)
          .split(/\n|,/)
          .map(v => v.trim())
          .filter(Boolean);
        if (kws.length === 0) throw new Error('Hãy nhập tối thiểu 1 từ khóa cho bulk.');
        const { resp, data } = await fetchJsonOrThrow('/api/content-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'bulk',
            provider: selectedProvider,
            modelName,
            apiKey: llmKey,
            ...(customBaseUrl ? { customBaseUrl } : {}),
            tavilyApiKey: settings.tavily_api_key,
            variants: kws.map((kw) => ({
              keyword: kw,
              topic: topic || kw,
              secondaryKeywords,
              framework,
              platformPreset,
            })),
          }),
        });
        if (!resp.ok || data.error) throw new Error(String(data.error || 'Không thể tạo bulk job'));
        setBulkJob(data as unknown as BulkContentJobStatus);
        setWritingProgress({ isWriting: false, currentIndex: 0, totalSections: kws.length, currentSection: 'Bulk queue running' });
        addHistory('Viết bài AI', 'Tạo bulk job', `Số từ khóa: ${kws.length}`, 'info');
        pollBulkJob(String(data.id ?? ''));
        return;
      }

      // TOP-LEVEL FAILSAFE: If generating article but no outline, generate outline first!
      if (type === 'article' && !outline.trim()) {
        showNotification('Đang tự động chuẩn bị dàn ý...');
        addHistory('Viết bài AI', 'Chuẩn bị dàn ý', `Tự động chuẩn bị dàn ý cho: ${keyword}`, 'info');
        const { resp: prepResp, data: prepData } = await fetchJsonOrThrow('/api/generate-outline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            topic,
            keyword, 
            secondaryKeywords,
            masterContext: rawData, 
            framework, 
            modelName, 
            provider: selectedProvider, 
            apiKey: llmKey,
            ...(customBaseUrl ? { customBaseUrl } : {}),
            tavilyApiKey: settings.tavily_api_key,
            platformPreset,
          }),
        });
        if (!prepResp.ok || prepData.error) {
          addHistory('Viết bài AI', 'Tạo dàn ý tự động', String(prepData.error || 'Thất bại'), 'failed');
          throw new Error(String(prepData.error || 'Lỗi tạo dàn ý tự động'));
        }
        
        currentOutline = String(prepData.outline ?? '');
        currentTavilyContext = String(prepData.tavilyContext ?? '');
        setOutline(currentOutline);
        const rs = prepData.research as { sources?: Array<{ title: string; url: string; snippet: string }> } | undefined;
        if (rs?.sources) setResearchSources(rs.sources);
        if (prepData.tavilyContext) setTavilyContext(currentTavilyContext);
        trackAPICall(selectedProvider);
        addHistory('Viết bài AI', 'Tạo dàn ý thành công', `Đã chuẩn bị dàn ý cho: ${keyword}`);
      }

      if (type === 'outline') {
        addHistory('Viết bài AI', 'Yêu cầu tạo dàn ý', `Từ khóa: ${keyword}`, 'info');
        const { resp: outlineResp, data: outlineData } = await fetchJsonOrThrow('/api/generate-outline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            topic,
            keyword, 
            secondaryKeywords,
            masterContext: rawData, 
            framework, 
            modelName, 
            provider: selectedProvider, 
            apiKey: llmKey,
            ...(customBaseUrl ? { customBaseUrl } : {}),
            tavilyApiKey: settings.tavily_api_key,
            platformPreset,
          }),
        });
        if (!outlineResp.ok || outlineData.error) {
          throw new Error(String(outlineData.error || `Lỗi máy chủ (${outlineResp.status})`));
        }
        const outlineText = String(outlineData.outline ?? '');
        if (!outlineText || outlineText.trim().length < 10) {
          addHistory('Viết bài AI', 'Tạo dàn ý', 'AI trả về nội dung rỗng', 'failed');
          throw new Error('AI không trả về dàn ý hợp lệ. Hãy thử lại hoặc đổi Model.');
        }
        setOutline(outlineText);
        const outlineResearch = outlineData.research as { sources?: Array<{ title: string; url: string; snippet: string }> } | undefined;
        if (outlineResearch?.sources) setResearchSources(outlineResearch.sources);
        if (outlineData.tavilyContext) setTavilyContext(String(outlineData.tavilyContext));
        setIsLoading(false);
        trackToolUsage('content');
        trackAPICall(selectedProvider);
        addHistory('Viết bài AI', 'Tạo dàn ý hoàn tất', `Dàn ý cho: ${keyword}`);
        showNotification('Đã tạo dàn ý!');
      } else {
        addHistory('Viết bài AI', 'Bắt đầu viết bài', `Từ khóa: ${keyword}`, 'info');
        const sections = parseOutline(currentOutline);
        
        if (sections.length === 0) {
          showNotification('Dàn ý chưa sẵn sàng. Hãy thử tạo lại dàn ý hoặc kiểm tra từ khóa!', 'error');
          setIsLoading(false);
          return;
        }

        setWritingProgress({
          isWriting: true,
          currentIndex: 0,
          totalSections: sections.length,
          currentSection: sections[0]
        });

        startTask('content_generation', async (update) => {
          let fullArticleText = `# ${keyword}\n\n`;
          let currentProg = { isWriting: true, currentIndex: 0, totalSections: sections.length, currentSection: sections[0] };
          
          try {
            for (let i = 0; i < sections.length; i++) {
            if (cancelRef.current) {
              showNotification('Đã dừng viết bài.', 'error');
              break;
            }
            const section = sections[i];
            currentProg = { ...currentProg, currentIndex: i, currentSection: section };
            setWritingProgress(currentProg);
            update({ metadata: { fullArticle: fullArticleText, writingProgress: currentProg } });

            let response: Response;
            try {
              response = await fetch('/api/generate-section', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                topic,
                keyword, 
                secondaryKeywords,
                sectionTitle: section, 
                sectionIndex: i, 
                totalSections: sections.length,
                masterContext: rawData, 
                framework, 
                provider: selectedProvider, 
                modelName, 
                apiKey: llmKey,
                ...(customBaseUrl ? { customBaseUrl } : {}),
                tavilyApiKey: settings.tavily_api_key,
                tavilyContext: currentTavilyContext,
                platformPreset,
              }),
            });
            } catch (netErr) {
              throw explainFetchFailure(netErr);
            }
            trackAPICall(selectedProvider);

            if (!response.ok) {
              const errData = await response.json().catch(() => ({}));
              throw new Error(errData.error || `Lỗi máy chủ (${response.status}) khi viết phần: ${section}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let sectionContent = '';
            if (reader) {
              while (true) {
                if (cancelRef.current) break;
                const { done, value } = await reader.read();
                if (done) break;
                sectionContent += decoder.decode(value, { stream: true });
                setFullArticle(fullArticleText + sectionContent);
                update({ metadata: { fullArticle: fullArticleText + sectionContent, writingProgress: currentProg } });
              }
            }
            fullArticleText += sectionContent + '\n\n';
            if (
              selectedProvider === 'OpenRouter' &&
              i < sections.length - 1 &&
              !cancelRef.current
            ) {
              const isFreeModel = modelName.toLowerCase().includes(':free');
              const gapMs = isFreeModel ? 1200 : 500;
              await new Promise((resolve) => setTimeout(resolve, gapMs));
            }
          }

          setWritingProgress({ ...currentProg, isWriting: false });
          setFullArticle(fullArticleText);
          setIsLoading(false); // <--- UNLOCK UI HERE
          update({ metadata: { fullArticle: fullArticleText, writingProgress: { ...currentProg, isWriting: false } } });
          if (!cancelRef.current) {
            trackToolUsage('content');
            addHistory('Viết bài AI', 'Viết bài thành công', `Hoàn thành bài viết: ${keyword}`);
            showNotification('Đã viết xong bài!');
          }
          
        } catch (taskErr: unknown) {
          console.error("Task Error:", taskErr);
          const msg = taskErr instanceof Error ? taskErr.message : 'Lỗi không xác định khi viết bài.';
          addHistory('Viết bài AI', 'Lỗi viết bài', msg, 'failed');
          showNotification(msg, 'error');
          setWritingProgress(prev => ({ ...prev, isWriting: false }));
          setIsLoading(false); // <--- UNLOCK UI ON ERROR TOO
          // Vẫn lưu bài đã viết được đến thời điểm lỗi
          setFullArticle(fullArticleText);
          update({ metadata: { fullArticle: fullArticleText, writingProgress: { ...currentProg, isWriting: false } } });
        }
        });
      }
    } catch (err: unknown) { 
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định. Kiểm tra API Key và Model.';
      showNotification(msg === 'Failed to fetch' ? explainFetchFailure(err).message : msg, 'error'); 
      setWritingProgress(prev => ({ ...prev, isWriting: false }));
      setIsLoading(false);
    }
    // Remove finally because startTask is async and we handle states inside it.
  };

  const selectedOpenRouterMeta =
    selectedProvider === 'OpenRouter'
      ? openrouterCatalog.find((item) => item.id === modelName || `openrouter/${item.id}` === modelName)
      : null;
  const filteredModels = availableModels.filter((model) =>
    model.toLowerCase().includes(modelSearch.trim().toLowerCase())
  );

  const handleRunSeoAnalysis = (source: 'main' | 'draft' = 'main') => {
    // Luôn cho phép mở để người dùng xem giao diện
    setSeoSource(source);
    const content = source === 'main' ? fullArticle : outline;
    const results = analyzeContentSeo(content || "", keyword || "", secondaryKeywords || "");
    setSeoResults(results);
    setShowSeoDrawer(true);
    addHistory('Viết bài AI', 'Phân tích SEO', `Mẫu: ${source === 'main' ? 'Bài chính' : 'Dàn ý'} - Điểm: ${results.score}`, 'info');

    // UX FIX: Nếu chưa có nội dung bài viết chính, tự động bật chế độ "SỬA" cho tiện
    if (source === 'main' && !fullArticle) {
      setIsEditingArticle(true);
    }
    // Tương tự cho bài nháp
    if (source === 'draft' && !outline) {
      setIsEditingDraft(true);
    }
  };

  const insertMarkdown = (prefix: string, suffix: string = '', placeholder: string = '') => {
    if (!editorRef.current) return;
    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);

    const insertion = selectedText || placeholder;
    const newValue = before + prefix + insertion + suffix + after;
    
    setFullArticle(newValue);
    
    // Reset focus and selection
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + insertion.length + suffix.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  const handleEditorImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showNotification('Ảnh quá lớn (tối đa 5MB)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      insertMarkdown('![', `](${base64})`, file.name.split('.')[0]);
      addHistory('Viết bài AI', 'Chèn ảnh', `Đã chèn ảnh: ${file.name}`);
      showNotification('Đã chèn ảnh!');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleToolbarAction = (action: string) => {
    switch (action) {
      case 'h1': insertMarkdown('# ', '', 'Tiêu đề H1'); break;
      case 'h2': insertMarkdown('## ', '', 'Tiêu đề H2'); break;
      case 'h3': insertMarkdown('### ', '', 'Tiêu đề H3'); break;
      case 'h4': insertMarkdown('#### ', '', 'Tiêu đề H4'); break;
      case 'bold': insertMarkdown('**', '**', 'văn bản đậm'); break;
      case 'italic': insertMarkdown('*', '*', 'văn bản nghiêng'); break;
      case 'list': insertMarkdown('- ', '', 'mục danh sách'); break;
      case 'link': insertMarkdown('[', '](https://)', 'tiêu đề link'); break;
      case 'image': editorImageInputRef.current?.click(); break;
      case 'table': setShowTableDialog(true); break;
      default: break;
    }
  };

  // REAL-TIME DEBOUNCED SEO ANALYSIS
  useEffect(() => {
    if (!showSeoDrawer) return;

    const timer = setTimeout(() => {
      const content = seoSource === 'main' ? fullArticle : outline;
      const results = analyzeContentSeo(content || "", keyword || "", secondaryKeywords || "");
      setSeoResults(results);
    }, 800); // 800ms debounce

    return () => clearTimeout(timer);
  }, [fullArticle, outline, keyword, showSeoDrawer, seoSource]);

  return (
    <div className="flex flex-col gap-10 min-h-screen font-inter pb-20">
      {showToast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 font-bold text-sm max-w-md ${
          toastType === 'error' 
            ? 'bg-red-600 text-white shadow-red-600/30' 
            : 'bg-emerald-600 text-white shadow-emerald-600/30'
        }`}>
          {toastType === 'error' ? <X size={16} /> : <Check size={16} />}
          <span className="leading-snug">{toastMessage}</span>
        </div>
      )}

      <header className="flex justify-between items-end pb-10" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-6">
            <div className="p-3.5 rounded-2xl border shadow-[0_0_15px_rgba(16,185,129,0.2)]" style={{ backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' }}>
              <FileText className="text-emerald-500" size={24} />
            </div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none" style={{ color: 'var(--text-primary)' }}>
              BỘ ĐIỀU PHỐI NỘI DUNG AI
            </h1>
          </div>
          <div className="flex items-center gap-4 px-2">
            <div className="w-12 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest opacity-80">TỰ ĐỘNG TẠO VÀ TỐI ƯU HÓA BÀI VIẾT</p>
          </div>
        </div>
        <div className="flex items-center p-1 rounded-2xl" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setShowSeoDrawer(false)}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center gap-3 transition-all ${!showSeoDrawer ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-emerald-500/60 hover:text-emerald-500'}`}
          >
            <Settings size={14} /> 1. THIẾT LẬP & TẠO BÀI
          </button>
          <button 
            onClick={() => handleRunSeoAnalysis('main')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center gap-3 transition-all ${showSeoDrawer ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-emerald-500/60 hover:text-emerald-500'}`}
          >
            <TargetIcon size={14} /> 2. PHÂN TÍCH SEO
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-10 flex-1 relative min-h-0">
        <AnimatePresence mode="wait">
          {!showSeoDrawer && (
            <motion.div 
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="col-span-12 lg:col-span-4 min-w-0"
            >
          <Card className="p-8 h-full rounded-3xl flex flex-col gap-8 !overflow-visible" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-1 h-4 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                <Typography variant="h3" className="mb-0 text-lg font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>Thiết lập Bài viết</Typography>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <Typography variant="label" style={{ color: 'var(--text-secondary)' }}>CHỦ ĐỀ BÀI VIẾT</Typography>
                  <div className="border p-4 rounded-xl flex items-center gap-3" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'rgba(16,185,129,0.2)' }}>
                    <Layout size={18} className="text-emerald-500" />
                    <input 
                      type="text" 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Nhập chủ đề chính (vd: Máy chạy bộ)..."
                      className="bg-transparent border-none outline-none flex-1 font-medium text-sm"
                      style={{ color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                <div className="space-y-4 p-4 rounded-2xl border" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'rgba(16,185,129,0.2)' }}>
                  <Typography variant="label" style={{ color: '#10b981' }}>TÙY CHỌN TỪ KHÓA SEO</Typography>
                  
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest pl-1" style={{ color: 'var(--text-muted)' }}>Từ khóa chính (Focus)</label>
                    <div className="relative">
                      <input 
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="Từ khóa quan trọng nhất..."
                        className="w-full border rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-emerald-500 transition-all"
                        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                      />
                      <TargetIcon className="absolute right-3 top-2.5" size={14} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest pl-1" style={{ color: 'var(--text-muted)' }}>Từ khóa phụ (3-5 từ, cách nhau bằng dấu phẩy)</label>
                    <textarea 
                      value={secondaryKeywords}
                      onChange={(e) => setSecondaryKeywords(e.target.value)}
                      placeholder="vd: chạy bộ tại nhà, tập gym, giảm cân..."
                      className="w-full border rounded-xl px-4 py-2.5 text-[11px] font-medium outline-none focus:border-emerald-500 transition-all min-h-[60px] resize-none"
                      style={{ backgroundColor: 'var(--card-bg)', borderColor: 'rgba(16,185,129,0.2)', color: '#10b981' }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Typography variant="label" style={{ color: 'var(--text-secondary)' }}>AI VIẾT BÀI</Typography>
                  <div className="border rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'rgba(16,185,129,0.2)' }}>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <select 
                          value={selectedProvider}
                          onChange={e => { setSelectedProvider(e.target.value); setModelName(''); }}
                          disabled={connectedProviders.length === 0}
                          className="w-full border rounded-lg p-3 text-xs font-bold outline-none cursor-pointer"
                          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                        >
                          {connectedProviders.length === 0 ? (
                            <option value="">Chưa có AI kết nối</option>
                          ) : (
                            connectedProviders.map(p => <option key={p} value={p}>{p}</option>)
                          )}
                        </select>
                      </div>
                      {!connectedProviders.includes(selectedProvider) && (
                        <a href="/dashboard/settings" className="px-3 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-[10px] font-bold">Cài đặt</a>
                      )}
                    </div>
                    <div className="relative z-[80] min-w-0" ref={modelDropdownRef}>
                      <button
                        type="button"
                        disabled={!connectedProviders.includes(selectedProvider) || isLoadingModels}
                        onClick={() => setIsModelDropdownOpen((prev) => !prev)}
                        className="w-full min-w-0 border rounded-lg p-3 text-xs font-bold outline-none disabled:opacity-50 text-left flex items-center justify-between gap-2 shrink-0"
                        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: '#10b981' }}
                      >
                        <span className="truncate min-w-0">
                          {!connectedProviders.includes(selectedProvider)
                            ? '--'
                            : isLoadingModels
                              ? 'Đang tìm model...'
                              : modelName || '-- Chọn Model --'}
                        </span>
                        <ChevronDown size={12} className={`transition-transform shrink-0 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isLoadingModels && <RefreshCw size={12} className="absolute right-8 top-1/2 -translate-y-1/2 animate-spin" style={{ color: 'var(--text-secondary)' }} />}

                      {isModelDropdownOpen && connectedProviders.includes(selectedProvider) && !isLoadingModels && (
                        <div
                          className="absolute left-0 right-0 top-full z-[90] mt-2 min-w-full rounded-xl border shadow-[0_18px_48px_rgba(0,0,0,0.45)] ring-1 ring-emerald-500/15"
                          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
                        >
                          <div className="p-2.5 border-b" style={{ borderColor: 'var(--border-color)' }}>
                            <div className="relative">
                              <input
                                autoFocus
                                type="text"
                                value={modelSearch}
                                onChange={(e) => setModelSearch(e.target.value)}
                                placeholder="Tìm model..."
                                className="w-full min-w-0 border rounded-lg py-2.5 pl-8 pr-3 text-[11px] font-semibold outline-none focus:ring-2 focus:ring-emerald-500/30"
                                style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                              />
                              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                            </div>
                          </div>
                          <div
                            className="max-h-[min(60vh,22rem)] overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar-emerald py-1"
                            style={{ scrollbarGutter: 'stable' }}
                          >
                            {availableModels.length === 0 ? (
                              <p className="px-3 py-3 text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Không tìm được</p>
                            ) : filteredModels.length === 0 ? (
                              <p className="px-3 py-3 text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Không có model khớp từ khóa tìm kiếm</p>
                            ) : (
                              filteredModels.map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => {
                                    setModelName(m);
                                    setIsModelDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2.5 text-[11px] font-semibold leading-snug transition hover:bg-emerald-500/10"
                                  style={{
                                    color: m === modelName ? '#10b981' : 'var(--text-secondary)',
                                    backgroundColor: m === modelName ? 'rgba(16,185,129,0.12)' : 'transparent',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {m}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {selectedProvider === 'OpenRouter' && (
                      <div className="space-y-2">
                        <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                          OpenRouter Model Insight
                        </div>
                        {selectedOpenRouterMeta ? (
                          <div className="rounded-xl p-2.5 flex flex-wrap items-center gap-2" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <span
                              className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full"
                              style={{
                                color: selectedOpenRouterMeta.isFree ? '#34d399' : '#f59e0b',
                                backgroundColor: selectedOpenRouterMeta.isFree ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                              }}
                            >
                              {selectedOpenRouterMeta.isFree ? 'FREE' : 'PAID'}
                            </span>
                            <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                              {selectedOpenRouterMeta.category}
                            </span>
                            <span className="text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>
                              {selectedOpenRouterMeta.contextWindow > 0 ? `${Math.round(selectedOpenRouterMeta.contextWindow / 1000)}k ctx` : 'ctx ?'}
                            </span>
                            <span className="text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>
                              ${selectedOpenRouterMeta.inputCostPer1M.toFixed(2)}/1M in
                            </span>
                            <span className="text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>
                              ${selectedOpenRouterMeta.outputCostPer1M.toFixed(2)}/1M out
                            </span>
                          </div>
                        ) : (
                          <div className="rounded-xl p-2.5 text-[10px] font-bold" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--text-muted)' }}>
                            Chọn 1 model để xem Free/Paid + chi phí.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Typography variant="label" style={{ color: 'var(--text-secondary)' }}>FRAMEWORK</Typography>
                  <div className="relative">
                    <select 
                      value={framework} 
                      onChange={e => setFramework(e.target.value)} 
                      className="w-full border rounded-xl p-4 text-xs font-bold outline-none cursor-pointer appearance-none pr-10"
                      style={{ backgroundColor: 'var(--card-bg)', borderColor: 'rgba(16,185,129,0.2)', color: '#10b981' }}
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
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Typography variant="label" style={{ color: 'var(--text-secondary)' }}>OUTPUT MODE</Typography>
                  <div className="relative">
                    <select
                      value={outputMode}
                      onChange={e => setOutputMode(e.target.value as 'single' | 'bulk')}
                      className="w-full border rounded-xl p-4 text-xs font-bold outline-none cursor-pointer appearance-none pr-10"
                      style={{ backgroundColor: 'var(--card-bg)', borderColor: 'rgba(16,185,129,0.2)', color: '#10b981' }}
                    >
                      <option value="single">Single Deep Article</option>
                      <option value="bulk">Bulk Production</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Typography variant="label" style={{ color: 'var(--text-secondary)' }}>NỀN TẢNG / GIỌNG VĂN</Typography>
                  <div className="relative">
                    <select
                      value={platformPreset}
                      onChange={e => setPlatformPreset(e.target.value as ContentPlatformPreset)}
                      className="w-full border rounded-xl p-4 text-xs font-bold outline-none cursor-pointer appearance-none pr-10"
                      style={{ backgroundColor: 'var(--card-bg)', borderColor: 'rgba(16,185,129,0.2)', color: '#10b981' }}
                    >
                      <option value="googleSeoLongForm">Google SEO Long-form</option>
                      <option value="facebookEngagement">Facebook Engagement</option>
                      <option value="socialShort">Social Short-form</option>
                      <option value="adCopy">Ads / Conversion Copy</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
                  </div>
                </div>

                {outputMode === 'bulk' && (
                  <div className="space-y-2">
                    <Typography variant="label" style={{ color: 'var(--text-secondary)' }}>DANH SÁCH TỪ KHÓA BULK</Typography>
                    <textarea
                      value={bulkKeywords}
                      onChange={e => setBulkKeywords(e.target.value)}
                      placeholder="Mỗi dòng 1 từ khóa hoặc phân tách bằng dấu phẩy..."
                      className="w-full h-24 rounded-xl p-4 text-xs outline-none resize-none"
                      style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--text-primary)' }}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Typography variant="label" style={{ color: 'var(--text-secondary)' }}>URL THAM KHẢO</Typography>
                  <div className="space-y-2">
                    {urls.map((url, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <Settings size={12} className="text-emerald-500 shrink-0" />
                        <input 
                          className="flex-1 bg-transparent text-[11px] outline-none"
                          style={{ color: 'var(--text-primary)' }}
                          placeholder="https://..." 
                          value={url} 
                          onChange={e => { const n = [...urls]; n[i] = e.target.value; setUrls(n); }} 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Typography variant="label" style={{ color: 'var(--text-secondary)' }}>GHI CHÚ / DỮ LIỆU</Typography>
                  <textarea 
                    placeholder="Thông tin sản phẩm, dịch vụ..."
                    value={rawData}
                    onChange={e => setRawData(e.target.value)}
                    className="w-full h-24 rounded-xl p-4 text-xs outline-none resize-none"
                    style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="space-y-2">
                  <Typography variant="label" style={{ color: 'var(--text-secondary)' }}>FILE DỮ LIỆU NỘI BỘ</Typography>
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                      isDragging 
                        ? 'border-emerald-500 bg-emerald-500/10' 
                        : ''
                    }`}
                    style={isDragging ? {} : { borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'var(--hover-bg)' }}
                  >
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      multiple 
                      accept=".txt,.pdf,.doc,.docx,.html,.md"
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                    />
                    <FolderOpen size={20} className={`mx-auto mb-2 ${isDragging ? 'text-emerald-400' : 'text-emerald-500'}`} />
                    <p className="text-[11px] font-bold" style={{ color: isDragging ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{isDragging ? 'Thả file vào đây' : 'Kéo thả file hoặc click'}</p>
                    <p className="text-[10px] mt-1 text-emerald-600/70">.txt .pdf .doc .docx</p>
                  </div>
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {uploadedFiles.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg p-2.5" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(16,185,129,0.2)' }}>
                          <File size={14} className="text-emerald-500 shrink-0" />
                          <span className="flex-1 text-[11px] truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</span>
                          <button onClick={() => removeFile(i)} className="p-1 hover:bg-red-500/20 rounded text-red-400 transition-all">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-3 pt-6" style={{ borderTop: '1px solid rgba(16,185,129,0.2)' }}>
              <button 
                onClick={() => handleStart('outline')}
                disabled={isLoading || !keyword.trim() || !modelName || outputMode === 'bulk'}
                className="px-4 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                {outputMode === 'bulk'
                  ? 'BULK KHÔNG CẦN'
                  : isLoading && !writingProgress.isWriting
                    ? <Loader2 size={14} className="animate-spin mx-auto" />
                    : '1. DÀN Ý'}
              </button>
              {outline || outputMode === 'bulk' ? (
                <button 
                  onClick={() => handleStart('article')}
                  disabled={isLoading || !(outputMode === 'bulk' ? bulkKeywords.trim() || keyword.trim() : keyword.trim()) || !modelName || writingProgress.isWriting}
                  className="w-full px-4 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 border border-emerald-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {writingProgress.isWriting ? (
                    <span className="flex items-center justify-center gap-1">
                      <Loader2 size={14} className="animate-spin" /> VIẾT...
                    </span>
                  ) : outputMode === 'bulk' ? 'CHẠY BULK' : '2. VIẾT BÀI'}
                </button>
              ) : (
                <div className="px-4 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center justify-center" style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-muted)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  Chờ dàn ý
                </div>
              )}
            </div>
          </Card>
        </motion.div>
        )}
        </AnimatePresence>

        <div className="col-span-12 lg:col-span-8 transition-all duration-500 flex flex-col gap-8">
          <AnimatePresence>
            {!showSeoDrawer && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 320, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="rounded-3xl overflow-hidden flex flex-col shrink-0" 
                style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <div className="p-5 flex items-center justify-between" style={{ backgroundColor: 'var(--hover-bg)', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
                  <div>
                    <Typography variant="h3" className="mb-0 text-sm font-black uppercase" style={{ color: 'var(--text-primary)' }}>BÀI NHÁP / DÀN Ý</Typography>
                    <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Draft Content / Structure</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center p-1 rounded-xl mr-4" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)' }}>
                      <button 
                        onClick={() => setIsEditingDraft(false)}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase flex items-center gap-2 transition-all ${!isEditingDraft ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-emerald-500/60 hover:text-emerald-500'}`}
                      >
                        <Eye size={12} /> XEM
                      </button>
                      <button 
                        onClick={() => setIsEditingDraft(true)}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase flex items-center gap-2 transition-all ${isEditingDraft ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-emerald-500/60 hover:text-emerald-500'}`}
                      >
                        <Edit3 size={12} /> SỬA
                      </button>
                    </div>
                    <button onClick={() => outline && handleCopy(outline, 'outline')} disabled={!outline} className="p-2 rounded-lg transition-all disabled:opacity-30" style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                      {copiedOutline ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex-1 p-5 overflow-y-auto" style={{ backgroundColor: 'var(--hover-bg)' }}>
                  {isEditingDraft ? (
                    <textarea 
                      value={outline}
                      onChange={e => setOutline(e.target.value)}
                      className="w-full h-full border-none text-sm outline-none resize-none bg-transparent"
                      style={{ color: 'var(--text-primary)' }}
                      placeholder="Dán bài copy hoặc dàn ý tại đây..."
                    />
                  ) : (
                    <article className="prose max-w-none text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      <ReactMarkdown
                        components={{
                          h1: ({children}) => <h1 className="text-xl font-black mb-4" style={{ color: 'var(--text-primary)' }}>{children}</h1>,
                          h2: ({children}) => <h2 className="text-lg font-bold mb-3" style={{ color: '#10b981' }}>{children}</h2>,
                          p: ({children}) => <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>{children}</p>,
                        }}
                      >
                        {outline || "Chưa có nội dung..."}
                      </ReactMarkdown>
                    </article>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {(researchSources.length > 0 || bulkJob) && (
            <div className="rounded-3xl overflow-hidden p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(16,185,129,0.2)' }}>
              {bulkJob && (
                <div className="mb-4 p-3 rounded-xl" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    BULK JOB: {bulkJob.status} ({bulkJob.progress.completed}/{bulkJob.progress.total})
                  </p>
                  {bulkJob.progress.currentKeyword && (
                    <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      Đang xử lý: {bulkJob.progress.currentKeyword}
                    </p>
                  )}
                </div>
              )}
              {researchSources.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2 text-emerald-500">Nguồn research</p>
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {researchSources.slice(0, 5).map((source, idx) => (
                      <a
                        key={`${source.url}-${idx}`}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block p-2 rounded-lg hover:opacity-80 transition-all"
                        style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid rgba(16,185,129,0.15)' }}
                      >
                        <p className="text-[11px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{source.title}</p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{source.url}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-3xl overflow-hidden flex flex-col transition-all duration-500" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid rgba(16,185,129,0.2)', height: showSeoDrawer ? '852px' : '500px' }}>
            <div className="p-5 flex items-center justify-between shrink-0" style={{ backgroundColor: 'var(--hover-bg)', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
              <div>
                <Typography variant="h3" className="mb-0 text-sm font-black uppercase" style={{ color: 'var(--text-primary)' }}>BÀI VIẾT</Typography>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center p-1 rounded-xl mr-4" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)' }}>
                  <button 
                    onClick={() => setIsEditingArticle(false)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase flex items-center gap-2 transition-all ${!isEditingArticle ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-emerald-500/60 hover:text-emerald-500'}`}
                  >
                    <Eye size={12} /> XEM
                  </button>
                  <button 
                    onClick={() => setIsEditingArticle(true)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase flex items-center gap-2 transition-all ${isEditingArticle ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-emerald-500/60 hover:text-emerald-500'}`}
                  >
                    <Edit3 size={12} /> SỬA
                  </button>
                </div>
                {isEditingArticle && (
                  <button 
                    onClick={() => { if(confirm('Xóa trắng nội dung bài viết?')) setFullArticle(''); }}
                    className="p-2 mr-2 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-all"
                    title="Xóa trắng"
                  >
                    <Eraser size={14} />
                  </button>
                )}
                <button onClick={() => { cancelRef.current = true; }} 
                    disabled={!writingProgress.isWriting}
                    className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-lg shadow-red-600/20 transition-all disabled:opacity-50 disabled:bg-gray-600 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  <X size={12} /> DỪNG VIẾT
                </button>
                <button onClick={() => fullArticle && handleCopy(fullArticle, 'article')} disabled={!fullArticle} className="p-2 rounded-lg transition-all disabled:opacity-30" style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                  {copiedArticle ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
                <button onClick={() => fullArticle && handleDownload(fullArticle, `bai-${keyword.slice(0, 15) || 'mau'}.md`)} disabled={!fullArticle} className="p-2 rounded-lg transition-all disabled:opacity-30" style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                  <Download size={14} />
                </button>
              </div>
            </div>

            {writingProgress.isWriting && (
              <div className="px-5 py-3 shrink-0" style={{ backgroundColor: 'rgba(16,185,129,0.1)', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="flex items-center gap-3 mb-2">
                  <Loader2 size={14} className="text-emerald-500 animate-spin" />
                  <span className="text-xs font-bold text-emerald-500 uppercase">
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
                            : ''
                      }`}
                      style={i >= writingProgress.currentIndex && i !== writingProgress.currentIndex ? { backgroundColor: 'var(--border-color)' } : {}}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--hover-bg)' }}>
              {isEditingArticle && (
                <div className="px-6 py-2 flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar" style={{ borderBottom: '1px solid rgba(16,185,129,0.1)', backgroundColor: 'rgba(16,185,129,0.02)' }}>
                  <div className="flex items-center gap-1 pr-4 border-r border-emerald-500/10">
                    <button onClick={() => handleToolbarAction('h1')} className="p-2 hover:bg-emerald-500/10 rounded-lg text-emerald-500 transition-all text-[10px] font-black w-8 h-8 flex items-center justify-center">H1</button>
                    <button onClick={() => handleToolbarAction('h2')} className="p-2 hover:bg-emerald-500/10 rounded-lg text-emerald-500 transition-all text-[10px] font-black w-8 h-8 flex items-center justify-center">H2</button>
                    <button onClick={() => handleToolbarAction('h3')} className="p-2 hover:bg-emerald-500/10 rounded-lg text-emerald-500 transition-all text-[10px] font-black w-8 h-8 flex items-center justify-center">H3</button>
                    <button onClick={() => handleToolbarAction('h4')} className="p-2 hover:bg-emerald-500/10 rounded-lg text-emerald-500 transition-all text-[10px] font-black w-8 h-8 flex items-center justify-center">H4</button>
                  </div>
                  <div className="flex items-center gap-1 px-4 border-r border-emerald-500/10">
                    <button onClick={() => handleToolbarAction('bold')} className="p-2 hover:bg-emerald-500/10 rounded-lg text-emerald-500 transition-all" title="In đậm"><Bold size={14} /></button>
                    <button onClick={() => handleToolbarAction('italic')} className="p-2 hover:bg-emerald-500/10 rounded-lg text-emerald-500 transition-all" title="In nghiêng"><Italic size={14} /></button>
                    <button onClick={() => handleToolbarAction('list')} className="p-2 hover:bg-emerald-500/10 rounded-lg text-emerald-500 transition-all" title="Danh sách"><List size={14} /></button>
                  </div>
                  <div className="flex items-center gap-1 pl-4">
                    <button onClick={() => handleToolbarAction('link')} className="p-2 hover:bg-emerald-500/10 rounded-lg text-emerald-500 transition-all" title="Chèn Link"><LinkIcon size={14} /></button>
                    <button onClick={() => handleToolbarAction('image')} className="p-2 hover:bg-emerald-500/10 rounded-lg text-emerald-500 transition-all" title="Chèn Ảnh"><ImageIcon size={14} /></button>
                    <button onClick={() => handleToolbarAction('table')} className="p-2 hover:bg-emerald-500/10 rounded-lg text-emerald-500 transition-all" title="Chèn Bảng"><TableIcon size={14} /></button>
                  </div>
                </div>
              )}
              
              <div className="flex-1 p-6 overflow-y-auto">
                {isEditingArticle ? (
                  <textarea
                    ref={editorRef}
                    value={fullArticle}
                    onChange={(e) => setFullArticle(e.target.value)}
                    placeholder="# Nhập hoặc dán bài viết của bạn tại đây để chấm điểm SEO..."
                    className="w-full h-full bg-transparent border-none outline-none resize-none text-sm leading-relaxed"
                    style={{ color: 'var(--text-primary)', fontFamily: 'inherit' }}
                  />
                ) : fullArticle ? (
                <article className="prose max-w-none text-sm leading-relaxed space-y-6 pb-4" style={{ color: 'var(--text-primary)' }}>
                  <ReactMarkdown
                    components={{
                      h1: ({children}) => <h1 className="text-2xl font-black mb-6 mt-8 first:mt-0" style={{ color: 'var(--text-primary)' }}>{children}</h1>,
                      h2: ({children}) => <h2 className="text-xl font-bold mb-4 mt-8 pb-3" style={{ color: '#10b981', borderBottom: '1px solid var(--border-color)' }}>{children}</h2>,
                      h3: ({children}) => <h3 className="text-base font-semibold mb-3 mt-6" style={{ color: 'var(--text-primary)' }}>{children}</h3>,
                      p: ({children}) => <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>{children}</p>,
                      strong: ({children}) => <strong className="font-semibold" style={{ color: '#10b981' }}>{children}</strong>,
                      ul: ({children}) => <ul className="list-disc list-inside mb-4 space-y-1 pl-2" style={{ color: 'var(--text-secondary)' }}>{children}</ul>,
                      ol: ({children}) => <ol className="list-decimal list-inside mb-4 space-y-1 pl-2" style={{ color: 'var(--text-secondary)' }}>{children}</ol>,
                      li: ({children}) => <li style={{ color: 'var(--text-secondary)' }}>{children}</li>,
                      blockquote: ({children}) => <blockquote className="border-l-4 pl-4 py-2 my-4 italic rounded-r-lg" style={{ borderColor: '#10b981', color: 'var(--text-muted)', backgroundColor: 'var(--hover-bg)' }}>{children}</blockquote>,
                    }}
                  >
                    {fullArticle}
                  </ReactMarkdown>
                </article>
              ) : writingProgress.isWriting ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 size={48} className="text-emerald-500 animate-spin mb-4" />
                  <p className="text-emerald-500/60 text-sm font-bold uppercase tracking-wider">
                    Đang xử lý...
                  </p>
                </div>
              ) : (
                <div 
                  onClick={() => setIsEditingArticle(true)}
                  className="flex flex-col items-center justify-center h-full cursor-pointer hover:bg-emerald-500/5 transition-all group"
                >
                  <MagicIcon size={48} className="mb-3 opacity-20 group-hover:opacity-40 transition-all" style={{ color: 'var(--text-muted)' }} />
                  <Typography variant="h1" className="text-4xl font-black uppercase tracking-widest opacity-20 group-hover:opacity-40 transition-all" style={{ color: 'var(--text-muted)' }}>GENESIS</Typography>
                  <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-all" style={{ color: 'var(--text-muted)' }}>Nhấn vào đây hoặc nút &quot;SỬA&quot; để bắt đầu</p>
                </div>
              )}
                </div>
              </div>
            </div>
          </div>

        {/* INTEGRATED SEO PANEL (YOAST STYLE) */}
        <AnimatePresence>
          {showSeoDrawer && seoResults && (
            <motion.div 
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="col-span-12 lg:col-span-4"
            >
              <Card className="p-0 h-full rounded-3xl overflow-hidden flex flex-col border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.05)]" style={{ backgroundColor: 'var(--card-bg)' }}>
                <div className="p-6 border-b flex items-center justify-between" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <TargetIcon size={16} className="text-emerald-500" />
                    </div>
                    <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>Phân tích SEO</h2>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setShowSeoDrawer(false)}
                      className="p-2 hover:bg-emerald-500/10 text-emerald-500 rounded-xl transition-all border border-transparent hover:border-emerald-500/20"
                      title="Quay lại thiết lập"
                    >
                      <Settings size={16} />
                    </button>
                    <button 
                      onClick={() => setShowSeoDrawer(false)}
                      className="p-2 hover:bg-red-500/10 text-red-400 rounded-xl transition-all"
                      title="Đóng phân tích"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Focus Keyword Input & Source Toggle */}
                  <div className="space-y-4 p-4 rounded-2xl border bg-emerald-500/5 border-emerald-500/20">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black uppercase text-emerald-500 tracking-widest">Phân tích cho:</label>
                      <div className="flex p-0.5 rounded-lg bg-slate-900/80 border border-emerald-500/10">
                        <button 
                          onClick={() => setSeoSource('draft')}
                          className={`px-2 py-1 rounded-md text-[8px] font-bold transition-all ${seoSource === 'draft' ? 'bg-emerald-500 text-white shadow-md' : ''}`}
                          style={seoSource === 'draft' ? {} : { color: 'var(--text-muted)' }}
                        >
                          BÀI NHÁP
                        </button>
                        <button 
                          onClick={() => setSeoSource('main')}
                          className={`px-2 py-1 rounded-md text-[8px] font-bold transition-all ${seoSource === 'main' ? 'bg-emerald-500 text-white shadow-md' : ''}`}
                          style={seoSource === 'main' ? {} : { color: 'var(--text-muted)' }}
                        >
                          BÀI CHÍNH
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-emerald-500/60 tracking-widest pl-1">Từ khóa mục tiêu</label>
                      <div className="relative">
                        <input 
                          type="text"
                          value={keyword}
                          onChange={(e) => setKeyword(e.target.value)}
                          placeholder="Nhập từ khóa chính..."
                          className="w-full border rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-emerald-500 transition-all"
                          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'rgba(16,185,129,0.2)', color: '#10b981' }}
                        />
                        <TargetIcon className="absolute right-3 top-2.5 text-emerald-500/30" size={14} />
                      </div>
                    </div>
                  </div>

                  {/* Score Gauge */}
                  <div className="flex flex-col items-center justify-center p-6 rounded-3xl relative overflow-hidden" style={{ backgroundColor: 'var(--hover-bg)' }}>
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90">
                        <circle 
                          cx="56" cy="56" r="50" 
                          fill="none" stroke="currentColor" strokeWidth="6"
                          className="text-gray-200/5"
                        />
                        <motion.circle 
                          cx="56" cy="56" r="50" 
                          fill="none" stroke="currentColor" strokeWidth="6"
                          strokeDasharray={314}
                          initial={{ strokeDashoffset: 314 }}
                          animate={{ strokeDashoffset: 314 - (314 * seoResults.score) / 100 }}
                          className="text-emerald-500"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>{seoResults.score}</span>
                        <span className="text-[8px] font-bold text-emerald-500">ĐIỂM</span>
                      </div>
                    </div>
                  </div>

                  {/* Categories Breakdown */}
                  {seoResults.categories.map((cat, idx) => (
                    <div key={idx} className="space-y-4">
                      <div className="flex items-center justify-between group">
                        <div className="flex items-center gap-2">
                          <div className={`w-1 h-3 rounded-full ${cat.score >= cat.maxScore * 0.8 ? 'bg-emerald-500' : cat.score >= cat.maxScore * 0.5 ? 'bg-amber-500' : 'bg-red-500'}`} />
                          <h3 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>{cat.name}</h3>
                        </div>
                        <span className="text-[10px] font-black text-emerald-500">{cat.score}/{cat.maxScore}đ</span>
                      </div>
                      
                      <div className="space-y-2">
                        {cat.checks.map((check, cidx) => {
                          const status = check.passed ? "good" : check.priority === "high" ? "bad" : "warn";
                          const share = Math.max(1, Math.round(cat.maxScore / Math.max(cat.checks.length, 1)));
                          return (
                          <div 
                            key={`${cat.name}-${cidx}`} 
                            className={`p-3 rounded-xl border flex gap-3 items-start transition-all hover:translate-x-1 ${
                              status === 'good' ? 'border-emerald-500/10 bg-emerald-500/5' : 
                              status === 'warn' ? 'border-amber-500/10 bg-amber-500/5' : 
                              'border-red-500/10 bg-red-500/5'
                            }`}
                          >
                            <div className={`mt-1 shrink-0 w-1.5 h-1.5 rounded-full ${
                              status === 'good' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                              status === 'warn' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                              'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                            }`} />
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <p className="text-[10px] font-bold" style={{ color: 'var(--text-primary)' }}>{check.name}</p>
                                <span className={`text-[8px] font-black ${check.passed ? 'text-emerald-500' : 'text-red-500/30'}`}>{check.passed ? `+${share}đ` : "—"}</span>
                              </div>
                              <p className="text-[9px] leading-tight opacity-70" style={{ color: 'var(--text-muted)' }}>{check.message}</p>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div className="space-y-3 p-4 rounded-2xl border" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'rgba(16,185,129,0.2)' }}>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Checklist sửa nhanh</h3>
                    {seoResults.quickFixes?.slice(0, 4).map((tip, idx) => (
                      <p key={`tip-${idx}`} className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>- {tip}</p>
                    ))}
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-red-400/80 mt-3">Critical issues</h4>
                    {seoResults.criticalIssues?.slice(0, 3).map((issue, idx) => (
                      <p key={`issue-${idx}`} className="text-[10px]" style={{ color: 'var(--text-muted)' }}>- {issue}</p>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SEO RESULTS DRAWER - REMOVED (NOW INTEGRATED ABOVE) */}
      {/* HIDDEN INPUT FOR EDITOR IMAGES */}
      <input 
        type="file" 
        ref={editorImageInputRef} 
        onChange={handleEditorImageUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* TABLE GENERATOR DIALOG */}
      <AnimatePresence>
        {showTableDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTableDialog(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm rounded-3xl p-8 overflow-hidden"
              style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10">
                    <TableIcon size={18} className="text-emerald-500" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500">Tạo bảng mới</h3>
                </div>
                <button onClick={() => setShowTableDialog(false)} className="transition-all" style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
              </div>

              <div className="space-y-6">
                {/* VISUAL GRID SELECTOR (WORD STYLE) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[9px] font-black uppercase text-emerald-500/60 tracking-widest">Kéo để vẽ bảng</label>
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      {hoveredRows > 0 ? `${hoveredRows} x ${hoveredCols}` : `${tableRows} x ${tableCols}`}
                    </span>
                  </div>
                  
                  <div 
                    className="grid grid-cols-10 gap-1 p-2 rounded-2xl border"
                    style={{ backgroundColor: 'var(--card-bg)', borderColor: 'rgba(16,185,129,0.1)' }}
                    onMouseLeave={() => { setHoveredRows(0); setHoveredCols(0); }}
                  >
                    {Array.from({ length: 10 }).map((_, r) => (
                      Array.from({ length: 10 }).map((_, c) => {
                        const isHovered = (r + 1) <= hoveredRows && (c + 1) <= hoveredCols;
                        const isSelected = (r + 1) <= tableRows && (c + 1) <= tableCols && hoveredRows === 0;
                        
                        return (
                          <div 
                            key={`${r}-${c}`}
                            onMouseEnter={() => { setHoveredRows(r + 1); setHoveredCols(c + 1); }}
                            onClick={() => {
                              const rows = r + 1;
                              const cols = c + 1;
                              setTableRows(rows);
                              setTableCols(cols);
                              
                              // Trigger insertion immediately on click
                              const colWidth = 15;
                              const pad = (s: string) => ` ${s} `.padEnd(colWidth);
                              const sep = () => ''.padEnd(colWidth, '-');
                              let tableStr = '\n\n';
                              tableStr += '|' + Array(cols).fill('Tiêu đề').map(pad).join('|') + '|\n';
                              tableStr += '|' + Array(cols).fill('').map(sep).join('|') + '|\n';
                              const rowStr = '|' + Array(cols).fill('Nhập...').map(pad).join('|') + '|\n';
                              tableStr += Array(rows).fill(rowStr).join('');
                              tableStr += '\n';
                              insertMarkdown(tableStr);
                              addHistory('Viết bài AI', 'Tạo bảng', `Đã chèn bảng ${rows}x${cols} vào nội dung`);
                              setShowTableDialog(false);
                              setHoveredRows(0);
                              setHoveredCols(0);
                            }}
                            className={`aspect-square rounded-sm cursor-pointer transition-all duration-150 ${
                              isHovered 
                                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] scale-110 z-10' 
                                : isSelected 
                                  ? 'bg-emerald-500/40' 
                                  : 'bg-emerald-500/5 hover:bg-emerald-500/20'
                            }`}
                          />
                        );
                      })
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-emerald-500/60 tracking-widest pl-1">Số hàng</label>
                    <input 
                      type="number"
                      min={1} max={20}
                      value={tableRows}
                      onChange={e => setTableRows(parseInt(e.target.value) || 1)}
                      className="w-full border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 transition-all"
                      style={{ backgroundColor: 'var(--card-bg)', borderColor: 'rgba(16,185,129,0.2)', color: '#10b981' }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-emerald-500/60 tracking-widest pl-1">Số cột</label>
                    <input 
                      type="number"
                      min={1} max={10}
                      value={tableCols}
                      onChange={e => setTableCols(parseInt(e.target.value) || 1)}
                      className="w-full border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 transition-all"
                      style={{ backgroundColor: 'var(--card-bg)', borderColor: 'rgba(16,185,129,0.2)', color: '#10b981' }}
                    />
                  </div>
                </div>

                <button 
                  onClick={() => {
                    const colWidth = 15;
                    const pad = (s: string) => ` ${s} `.padEnd(colWidth);
                    const sep = () => ''.padEnd(colWidth, '-');

                    let tableStr = '\n\n';
                    // Header
                    tableStr += '|' + Array(tableCols).fill('Tiêu đề').map(pad).join('|') + '|\n';
                    // Separator
                    tableStr += '|' + Array(tableCols).fill('').map(sep).join('|') + '|\n';
                    // Rows
                    const rowStr = '|' + Array(tableCols).fill('Nhập...').map(pad).join('|') + '|\n';
                    tableStr += Array(tableRows).fill(rowStr).join('');
                    tableStr += '\n';

                    insertMarkdown(tableStr);
                    setShowTableDialog(false);
                  }}
                  className="w-full py-4 rounded-2xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Chèn bảng vào bài viết
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
