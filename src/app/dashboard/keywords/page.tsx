'use client';
/**
 * OMNISUITE AI - ESTIMATION DASHBOARD V2.0
 * THEME: INDIGO NEON
 * FEATURE: CSS Grid alignment, Efficiency Index Badges, Virtual Scroll for 400+ rows
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Key,
  Search, 
  RefreshCw,
  TrendingUp,
  Target,
  Download,
  CheckCircle,
  Copy,
  Filter,
  Zap,
  BarChart3,
  Activity,
  MousePointerClick,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { MagicIcon } from '@/shared/ui/Icons';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import Typography from '@/shared/ui/Typography';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useTasks } from '@/shared/lib/context/TaskContext';
import { shouldExposeOllamaInUi } from '@/shared/lib/ollama';
import { useKeywordModels } from '@/modules/keywords/hooks/useKeywordModels';

// --- TYPES ---
interface BadgeInfo {
  label: string;
  color: string;
  bg: string;
  text: string;
}

interface KeywordResult {
  keyword: string;
  popularity: number;
  difficulty: number;
  cpc: number;
  intent: string;
  efficiency: number;
  badge: BadgeInfo;
  total_results?: number;
  pillar?: string;
  cluster?: string;
  trend?: {
    index: number;
    growth: number;
    history: number[];
    is_estimated?: boolean;
  };
}

interface SiloCluster {
  subpage_name: string;
}

interface SiloPillar {
  pillar_keyword: string;
  clusters: SiloCluster[];
}

interface SiloSeedTree {
  seed_keyword: string;
  pillars: SiloPillar[];
}

interface MindmapClusterNode {
  subpage_name: string;
  keywords: string[];
}

interface MindmapPillarNode {
  pillar_keyword: string;
  clusters: MindmapClusterNode[];
}

interface MindmapSeedNode {
  seed_keyword: string;
  pillars: MindmapPillarNode[];
}

type FilterType = 'ALL' | 'USE' | 'CONSIDER' | 'REFERENCE' | 'HARD' | 'INFO' | 'BUY';

// --- VIRTUAL SCROLL CONFIG ---
const ITEM_HEIGHT = 64;
const VISIBLE_ITEMS = 15;
const BUFFER_ITEMS = 5;
const MINDMAP_KEYWORD_LIMIT = 5;

const normalizeText = (input: string) =>
  (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (input: string): string[] =>
  normalizeText(input)
    .split(' ')
    .filter(token => token.length >= 2);

const calcTokenOverlap = (keyword: string, context: string): number => {
  const kwTokens = new Set(tokenize(keyword));
  const ctxTokens = new Set(tokenize(context));
  if (kwTokens.size === 0 || ctxTokens.size === 0) return 0;

  let hits = 0;
  kwTokens.forEach(token => {
    if (ctxTokens.has(token)) hits += 1;
  });
  return hits / kwTokens.size;
};

const isRuleClearlyRelevant = (keyword: string, seed: string, pillar: string, cluster: string): boolean => {
  const normalizedKeyword = normalizeText(keyword);
  const contexts = [seed, pillar, cluster].map(normalizeText).filter(Boolean);
  if (contexts.some(ctx => ctx && normalizedKeyword.includes(ctx))) return true;

  const overlapScore = calcTokenOverlap(keyword, `${seed} ${pillar} ${cluster}`);
  return overlapScore >= 0.5;
};

const isRuleClearlyIrrelevant = (keyword: string, seed: string, pillar: string, cluster: string): boolean => {
  const overlapScore = calcTokenOverlap(keyword, `${seed} ${pillar} ${cluster}`);
  return overlapScore < 0.15;
};

// --- TOOLTIP COMPONENT ---
const Tooltip = ({ children, content, subContent }: { children: React.ReactNode; content: string; subContent?: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block w-full" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: -5, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[9999] pointer-events-none min-w-[200px]">
            <div className="border border-indigo-500/30 backdrop-blur-xl p-3 rounded-xl shadow-2xl text-xs" style={{ backgroundColor: 'var(--card-bg)' }}>
              <div className="font-black text-indigo-400 uppercase tracking-widest mb-1">{content}</div>
              {subContent && <div className="font-medium leading-relaxed italic border-t pt-1.5 mt-1" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}>{subContent}</div>}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent" style={{ borderTopColor: 'var(--card-bg)' }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- BADGE COMPONENT (NEW LABELS) ---
const EfficiencyBadge = ({ badge, efficiency }: { badge: BadgeInfo; efficiency: number }) => {
  const getBadgeStyles = () => {
    switch (badge.bg) {
      case 'emerald': return 'bg-emerald-500 border-emerald-400 text-white';
      case 'amber': return 'bg-amber-400 border-amber-300 text-black';
      case 'orange': return 'bg-orange-500 border-orange-400 text-white';
      case 'rose': return 'bg-rose-500 border-rose-400 text-white';
      default: return 'bg-slate-500 border-slate-400 text-white';
    }
  };

  const getAdvice = () => {
    if (efficiency >= 6.5) return "Ưu tiên cao - Điểm EI mạnh, phù hợp triển khai trước.";
    if (efficiency >= 5.0) return "Nên xem xét - Có tiềm năng, cần tối ưu theo mục tiêu.";
    if (efficiency >= 3.5) return "Nên tham khảo - Hợp vai trò từ khóa bổ trợ.";
    return "Bỏ qua - Chưa phù hợp để ưu tiên ở thời điểm hiện tại.";
  };

  return (
    <Tooltip content={badge.label} subContent={getAdvice()}>
      <div className={`flex items-center justify-end gap-2 px-3 py-2 rounded-lg border ${getBadgeStyles()} transition-all hover:brightness-110 active:scale-95 cursor-help`}>
        <span className="text-[10px] font-black uppercase tracking-wider">{badge.label}</span>
        <span className="text-[9px] font-mono opacity-80">({efficiency})</span>
      </div>
    </Tooltip>
  );
};

// --- INTENT ICONS (SEMRUSH STYLE) ---
const IntentIcons = ({ intent }: { intent: string }) => {
  if (!intent) return null;

  const getIntentStyle = (type: string) => {
    switch (type.toUpperCase()) {
      case 'I': return { label: 'I', name: 'Thông tin (Info)', bg: 'bg-slate-500', advice: 'Tìm kiến thức. Cần viết bài hướng dẫn, mẹo.' };
      case 'N': return { label: 'N', name: 'Điều hướng (Nav)', bg: 'bg-blue-500', advice: 'Tìm thương hiệu. Muốn đến trang cụ thể.' };
      case 'C': return { label: 'C', name: 'Thương mại (Comm)', bg: 'bg-amber-400', advice: 'So sánh/Review. Đang cân nhắc mua hàng.' };
      case 'T': return { label: 'T', name: 'Giao dịch (Trans)', bg: 'bg-purple-600', advice: 'Mua hàng. Đã sẵn sàng chi tiền.' };
      default: return { label: '?', name: 'Chưa xác định', bg: 'bg-slate-700', advice: '' };
    }
  };

  const style = getIntentStyle(intent);
  return (
    <div className="flex gap-1.5 justify-center">
      <Tooltip content={`${style.name}`} subContent={style.advice}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg border border-white/10 ${style.bg} ${intent === 'C' ? 'text-black' : 'text-white'} cursor-help transition-all hover:scale-125`}>
          {style.label}
        </div>
      </Tooltip>
    </div>
  );
};

// --- DIFFICULTY BAR ---
const DifficultyBar = ({ value }: { value: number }) => {
  const getColor = () => {
    if (value < 35) return 'bg-emerald-500';
    if (value < 70) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <Tooltip content="Độ khó (KD)" subContent="KD được ước lượng dựa trên quy mô thị trường (Tổng kết quả) và mức độ phổ biến, từ ngắn/ngành rộng KD sẽ rất cao.">
      <div className="flex items-center gap-3 cursor-help">
        <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
          <div className={`h-full ${getColor()} rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
        </div>
        <span className="text-sm font-black font-mono w-8 text-right">{value}</span>
      </div>
    </Tooltip>
  );
};

// --- POPULARITY BAR ---
const PopularityBar = ({ value }: { value: number }) => {
  const getAdvice = () => {
    if (value > 80) return "Mỏ vàng lưu lượng - Ưu tiên chiếm Top ngay.";
    if (value > 50) return "Cần đầu tư bài sâu - Tiềm năng tăng trưởng tốt.";
    return "Ngách nhỏ - Build nội dung bổ trợ cho từ khóa chính.";
  };
  return (
    <Tooltip 
      content="Độ phổ biến (Power Law)" 
      subContent="Điểm số này sử dụng quy luật lũy thừa (Zipf's Law) để phản ánh đúng chênh lệch traffic thực tế giữa từ khóa hạt giống và từ khóa đuôi dài."
    >
      <div className="flex items-center gap-3 cursor-help">
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--hover-bg)' }}>
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${value}%` }} />
        </div>
        <span className="text-sm font-black font-mono text-indigo-400 w-8 text-right">{value}</span>
      </div>
    </Tooltip>
  );
};

// --- CPC BAR ---
const CpcBar = ({ value = 0.5 }: { value?: number }) => {
  const safeValue = value ?? 0.5;
  const getAdvice = () => {
    if (safeValue >= 2.5) return "Mỏ vàng thương mại - Từ khóa có tỷ lệ chuyển đổi cực cao (Search Ads & Shopping dày đặc).";
    if (safeValue >= 1.5) return "Tiềm năng ra tiền - Có đối thủ chạy Ads, đáng để đầu tư nội dung bán hàng.";
    return "Thông tin thuần túy - Ít cạnh tranh thương mại, phù hợp xây dựng Traffic và SEO Top bền vững.";
  };
  return (
    <Tooltip 
      content={`Proxy CPC: ${safeValue.toFixed(1)}`} 
      subContent={getAdvice()}
    >
      <div className="flex items-center gap-2 cursor-help justify-center">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${safeValue >= 2.0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'border'}`} style={safeValue >= 2.0 ? {} : { backgroundColor: 'var(--hover-bg)', color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}>
           <span className="text-[10px] font-black italic">$</span>
        </div>
        <div className="flex flex-col">
           <span className={`text-[11px] font-black font-mono leading-none ${safeValue >= 2.0 ? 'text-emerald-400' : ''}`} style={safeValue >= 2.0 ? {} : { color: 'var(--text-muted)' }}>{safeValue.toFixed(1)}</span>
           <div className="w-6 h-0.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: 'var(--hover-bg)' }}>
              <div className={`h-full transition-all ${safeValue >= 2.0 ? 'bg-emerald-500' : ''}`} style={safeValue >= 2.0 ? { width: `${(safeValue / 3) * 100}%` } : { width: `${(safeValue / 3) * 100}%`, backgroundColor: 'var(--text-muted)' }} />
           </div>
        </div>
      </div>
    </Tooltip>
  );
};

// --- TREND SPARKLINE COMPONENT ---
const TrendSparkline = ({ data, growth }: { data: number[]; growth: number }) => {
  if (!data || data.length === 0) return (
    <div className="flex flex-col items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity">
       <span className="text-[8px] font-black uppercase tracking-tighter">NO DATA</span>
    </div>
  );

  // Normalize points for SVG path
  const max = Math.max(...data, 10);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * 60,
    y: 20 - ((val - min) / range) * 16
  }));

  const path = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const isRising = growth > 0;
  const color = isRising ? '#10b981' : (growth < 0 ? '#f43f5e' : '#94a3b8');

  return (
    <Tooltip content={`Xu hướng: ${isRising ? '+' : ''}${growth}%`} subContent="Dữ liệu quan tâm theo thời gian từ Google Trends (12 tháng qua).">
      <div className="flex flex-col gap-1 cursor-help group">
        <div className="h-6 w-[60px] relative">
          <svg width="60" height="20" className="overflow-visible">
            <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={points[points.length-1].x} cy={points[points.length-1].y} r="2" fill={color} />
          </svg>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-[10px] font-black font-mono ${isRising ? 'text-emerald-400' : (growth < 0 ? 'text-rose-400' : 'text-slate-500')}`}>
            {isRising ? '↑' : (growth < 0 ? '↓' : '→')} {Math.abs(growth)}%
          </span>
        </div>
      </div>
    </Tooltip>
  );
};

// --- TREND DETAILS MODAL ---
const TrendDetailsModal = ({ keyword, onClose }: { keyword: KeywordResult; onClose: () => void }) => {
  if (!keyword.trend) return null;
  const data = keyword.trend.history;
  
  // Chart dimensions
  const width = 600;
  const height = 300;
  const padding = 40;
  
  const maxVal = Math.max(...data, 10);
  const minVal = Math.min(...data);
  const range = maxVal - minVal || 1;
  
  const points = data.map((val, i) => ({
    x: padding + (i / (data.length - 1)) * (width - 2 * padding),
    y: (height - padding) - ((val - minVal) / range) * (height - 2 * padding)
  }));
  
  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaPath = `${linePath} L ${points[points.length-1].x},${height - padding} L ${points[0].x},${height - padding} Z`;
  
  const isRising = keyword.trend.growth > 0;
  const chartColor = isRising ? '#10b981' : (keyword.trend.growth < 0 ? '#f43f5e' : '#6366f1');

  // Month labels (mock)
  const months = ["T4/23", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12", "T1/24", "T2", "T3"];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="border border-indigo-500/20 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--card-bg)' }}>
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">CHI TIẾT XU HƯỚNG</div>
                {keyword.trend.is_estimated && (
                   <div className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[8px] font-black text-amber-500 uppercase animate-pulse">Dự báo AI</div>
                )}
              </div>
              <h2 className="text-2xl font-black uppercase" style={{ color: 'var(--text-primary)' }}>{keyword.keyword}</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[color:var(--hover-bg)] rounded-full transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
               <ChevronUp size={24} className="rotate-180" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
             <div className="p-4 border rounded-2xl" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)' }}><div className="text-[9px] font-black uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Chỉ số hiện tại</div><div className="text-2xl font-black text-indigo-400 font-mono">{keyword.trend.index}</div></div>
             <div className="p-4 border rounded-2xl" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)' }}><div className="text-[9px] font-black uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Tăng trưởng (12T)</div><div className={`text-2xl font-black font-mono ${isRising ? 'text-emerald-400' : 'text-rose-400'}`}>{isRising ? '+' : ''}{keyword.trend.growth}%</div></div>
             <div className="p-4 border rounded-2xl" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)' }}><div className="text-[9px] font-black uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Độ hot</div><div className="text-2xl font-black text-amber-400">{keyword.trend.index > 70 ? 'Cực Cao' : (keyword.trend.index > 30 ? 'Trung Bình' : 'Thấp')}</div></div>
          </div>

          <div className="relative border rounded-2xl p-4 overflow-hidden" style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)' }}>
             <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
                <defs>
                   <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColor} stopOpacity="0.3" />
                      <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
                   </linearGradient>
                </defs>
                
                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map(lvl => (
                   <line key={lvl} x1={padding} y1={padding + lvl * (height - 2*padding)} x2={width-padding} y2={padding + lvl * (height - 2*padding)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                ))}

                {/* Area and Line */}
                <path d={areaPath} fill="url(#chartGradient)" />
                <path d={linePath} fill="none" stroke={chartColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                
                {/* Data Points */}
                {points.map((p, i) => (
                   <circle key={i} cx={p.x} cy={p.y} r="4" fill="#0f172a" stroke={chartColor} strokeWidth="2" className="transition-all hover:r-6 cursor-help" />
                ))}

                {/* X Axis Labels */}
                {points.map((p, i) => (
                   <text key={i} x={p.x} y={height - 15} textAnchor="middle" fill="#475569" className="text-[10px] font-bold font-mono">{months[i]}</text>
                ))}
             </svg>
          </div>

          <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-start gap-4">
             <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><TrendingUp size={20} /></div>
             <div>
                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">NHẬN ĐỊNH TREND AI</div>
                <p className="text-sm leading-relaxed font-medium" style={{ color: 'var(--text-secondary)' }}>
                   {keyword.trend.is_estimated 
                     ? `Dựa trên sức nóng hiện tạu (${keyword.popularity}) và độ khó, AI dự báo từ khóa "${keyword.keyword}" sẽ có biến động ${keyword.trend.growth > 0 ? 'tích cực' : 'ổn định'} trong các tháng tới. Đây là mô phỏng tham khảo khi Google chưa cập nhật dữ liệu.`
                     : (isRising 
                         ? `Từ khóa "${keyword.keyword}" đang có xu hướng tăng trưởng tích cực (+${keyword.trend.growth}%). Đây là thời điểm vàng để đẩy mạnh nội dung vì nhu cầu thị trường đang đi lên.`
                         : `Nhu cầu tìm kiếm từ khóa này đang có dấu hiệu bão hòa hoặc suy giảm nhẹ. Hãy tập trung tối ưu hóa các từ khóa vệ tinh hoặc chuyển hướng sang ngách có xu hướng tăng mạnh hơn.`
                       )
                   }
                </p>
             </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const MindmapModal = ({ data, onClose }: { data: MindmapSeedNode[]; onClose: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10010] bg-black/80 backdrop-blur-md p-3 lg:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 18 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 18 }}
        transition={{ duration: 0.2 }}
        className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-indigo-500/20 shadow-2xl"
        style={{ backgroundColor: 'var(--card-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[linear-gradient(90deg,rgba(79,70,229,0.12),rgba(15,23,42,0))] px-5 py-4 lg:px-8 lg:py-5">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-400">Mindmap Silo</div>
            <div className="text-[11px] font-bold text-slate-500">
              {data.length} seed • {data.reduce((sum, seed) => sum + seed.pillars.length, 0)} pillar
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-[color:var(--active-bg)] border-[color:var(--border-color)] bg-[color:var(--hover-bg)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
          >
            Đóng
          </button>
        </div>

        <div className="relative flex-1 overflow-auto p-4 lg:p-8 custom-scrollbar-indigo">
          <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99,102,241,0.16) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="space-y-6">
            {data.map((seedNode, seedIdx) => (
              <div key={`${seedNode.seed_keyword}-${seedIdx}`} className="relative rounded-3xl border border-indigo-500/20 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(7,11,24,0.88))] p-5 shadow-2xl lg:p-8">
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
                <div className="relative min-w-[1320px]">
                  <div className="flex items-start gap-10">
                    <div className="sticky left-0 top-0 z-10 flex w-[240px] shrink-0 items-center gap-5 rounded-[28px] border border-white/10 bg-slate-950/95 px-5 py-6 shadow-[0_0_28px_rgba(15,23,42,0.7)] backdrop-blur-sm">
                      <div
                        className="flex min-h-[88px] flex-1 items-center justify-center rounded-[22px] border px-4 py-3 text-center text-xs font-black uppercase tracking-widest"
                        style={{
                          color: 'var(--text-primary)',
                          borderColor: 'var(--border-color)',
                          backgroundColor: 'var(--hover-bg)',
                        }}
                      >
                        {seedNode.seed_keyword}
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-r from-indigo-400/80 to-transparent" />
                    </div>

                    <div className="relative min-w-[1000px] flex-1 space-y-8 before:absolute before:bottom-8 before:left-0 before:top-8 before:w-px before:bg-gradient-to-b before:from-indigo-400/0 before:via-indigo-400/40 before:to-indigo-400/0">
                      {seedNode.pillars.map((pillar, pIdx) => (
                        <div key={`${pillar.pillar_keyword}-${pIdx}`} className="relative flex items-start gap-6 rounded-[28px] border border-white/6 bg-white/[0.02] px-6 py-5">
                          <div className="pointer-events-none absolute left-0 top-1/2 h-px w-6 -translate-y-1/2 bg-indigo-400/50" />

                          <div className="flex w-[340px] shrink-0 items-center gap-4">
                            <div className="h-px w-8 bg-indigo-400/60" />
                            <div className="flex-1 rounded-2xl border border-indigo-400/80 bg-[linear-gradient(135deg,#4338ca,#5b46ff)] px-5 py-4 text-center shadow-[0_0_24px_rgba(79,70,229,0.42)]">
                              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-indigo-100/80">Pillar</div>
                              <div className="mt-1 text-[11px] font-black uppercase tracking-wider text-white">
                                {pillar.pillar_keyword}
                              </div>
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-3 flex items-center gap-3">
                              <div className="h-px w-6 bg-indigo-400/40" />
                              <div className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-indigo-200">
                                {pillar.clusters.length} cluster
                              </div>
                            </div>

                            <div className="grid grid-flow-col auto-cols-[260px] gap-4">
                              {(pillar.clusters || []).map((cluster, cIdx) => (
                                <div key={`${cluster.subpage_name}-${cIdx}`} className="relative rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(30,41,59,0.72),rgba(15,23,42,0.92))] p-4 shadow-[0_10px_30px_rgba(2,6,23,0.35)]">
                                  <div className="pointer-events-none absolute left-0 top-8 h-px w-4 -translate-x-4 bg-indigo-400/40" />
                                  <div className="mb-3 flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1 truncate rounded-xl border border-indigo-500/20 bg-slate-800/90 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-100" title={cluster.subpage_name}>
                                      {cluster.subpage_name}
                                    </div>
                                    <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[8px] font-black text-slate-400">
                                      {(cluster.keywords || []).length}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    {(cluster.keywords || []).length > 0 ? (
                                      cluster.keywords.map((k, kIdx) => (
                                        <div
                                          key={`${k}-${kIdx}`}
                                          title={k}
                                          className="truncate rounded-lg border px-2.5 py-2 text-[9px] transition-all hover:border-indigo-400/40 hover:bg-indigo-500/10 border-[color:var(--border-color)] bg-[color:var(--hover-bg)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                                        >
                                          {k}
                                        </div>
                                      ))
                                    ) : (
                                      <div className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-2 text-[9px] italic text-slate-500">
                                        Chưa có từ khóa phù hợp
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- VIRTUAL LIST COMPONENT ---
const VirtualKeywordList = ({ results, isSiloMode, isCpcEnabled, onKeywordClick, itemHeight = ITEM_HEIGHT, visibleItems = VISIBLE_ITEMS }: { results: KeywordResult[]; isSiloMode: boolean; isCpcEnabled: boolean; onKeywordClick: (k: KeywordResult) => void; itemHeight?: number; visibleItems?: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = results.length * itemHeight;
  const viewportHeight = visibleItems * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - BUFFER_ITEMS);
  const endIndex = Math.min(results.length, Math.ceil((scrollTop + viewportHeight) / itemHeight) + BUFFER_ITEMS);
  const visibleData = results.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div ref={containerRef} className="overflow-y-auto custom-scrollbar-indigo" style={{ height: viewportHeight, maxHeight: '60vh' }} onScroll={handleScroll}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleData.map((r, i) => {
            const actualIndex = startIndex + i;
            return (
              <div 
                key={actualIndex} 
                onClick={() => onKeywordClick(r)}
                className={`grid ${isCpcEnabled ? 'grid-cols-13' : 'grid-cols-12'} gap-4 px-6 py-4 hover:bg-indigo-500/10 transition-all items-center group border-b border-white/[0.02] cursor-pointer active:scale-[0.99]`} 
                style={{ height: itemHeight }}
              >
                {isSiloMode && (
                  <>
                    <div className="col-span-2 truncate text-[10px] font-black text-indigo-400 uppercase tracking-tighter" title={r.pillar}>{r.pillar || '-'}</div>
                    <div className="col-span-2 truncate text-[10px] font-bold text-slate-500" title={r.cluster}>{r.cluster || '-'}</div>
                  </>
                )}
                <div className={isSiloMode ? "col-span-2" : isCpcEnabled ? "col-span-4" : "col-span-5"}>
                  <div className="font-bold text-[color:var(--text-secondary)] text-sm group-hover:text-[color:var(--text-primary)] transition-colors truncate" title={r.keyword}>{r.keyword}</div>
                </div>
                <div className="col-span-2 flex justify-center">
                    <TrendSparkline data={r.trend?.history || []} growth={r.trend?.growth || 0} />
                </div>
                <div className="col-span-1"><PopularityBar value={r.popularity} /></div>
                <div className="col-span-1"><DifficultyBar value={r.difficulty} /></div>
                {isCpcEnabled && <div className="col-span-1"><CpcBar value={r.cpc} /></div>}
                <div className={isSiloMode ? "col-span-1 flex justify-center" : "col-span-2 flex justify-center"}>
                  <IntentIcons intent={r.intent} />
                </div>
                <div className="col-span-1 flex justify-end"><EfficiencyBadge badge={r.badge} efficiency={r.efficiency} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- PAGINATION COMPONENT ---
const Pagination = ({ currentPage, totalPages, onPageChange, totalItems }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void; totalItems: number }) => {
  const ITEMS_PER_PAGE = 50;
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t bg-[color:var(--tool-surface-subtle)]" style={{ borderColor: 'var(--border-color)' }}>
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Hiển thị {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, totalItems)} - {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} / {totalItems} từ khóa
      </span>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-2 rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed transition-all bg-[color:var(--hover-bg)] border-[color:var(--border-color)] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"><ChevronUp size={16} className="rotate-[-90deg]" /></button>
        <span className="text-sm font-black px-4" style={{ color: 'var(--text-primary)' }}>{currentPage} / {totalPages}</span>
        <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="px-3 py-2 rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed transition-all bg-[color:var(--hover-bg)] border-[color:var(--border-color)] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"><ChevronDown size={16} className="rotate-[-90deg]" /></button>
      </div>
    </div>
  );
};

// --- MAIN PAGE ---
export default function DemoKeywordsPage() {
  const { startTask, getTask } = useTasks();
  const [keywordsInput, setKeywordsInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [currentProcessing, setCurrentProcessing] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSiloMode, setIsSiloMode] = useState(false);
  const [showMindmap, setShowMindmap] = useState(false);
  const [useVirtualScroll, setUseVirtualScroll] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  // Silos visuals Master table toggle (enabled when SILO is active)
  const [showVisualSilo, setShowVisualSilo] = useState(false);
  const [showMasterTable, setShowMasterTable] = useState(false);
  // Deep analysis (SILO) soft feature flag for demo, to avoid blocking core flow
  const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);
  const [deepProgress, setDeepProgress] = useState('');

  const {
    settings,
    provider,
    setProvider,
    availableModels,
    selectedModel,
    setSelectedModel,
    isFetchModelsLoading,
    buildAiApiKeys,
    fetchWithRetry,
  } = useKeywordModels((msg) => setCurrentProcessing(msg));
  const [siloData, setSiloData] = useState<{
    seeds?: SiloSeedTree[];
    seed_keyword?: string;
    pillars?: SiloPillar[];
  } | null>(null);
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [isCpcEnabled, setIsCpcEnabled] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordResult | null>(null);
  const ITEMS_PER_PAGE = 50;

  const STORAGE_KEY = 'omnisuite_keywords_state';

  // --- PERSISTENCE: LOAD ---
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.results) setResults(parsed.results);
        if (parsed.siloData) setSiloData(parsed.siloData);
        if (parsed.keywordsInput) setKeywordsInput(parsed.keywordsInput);
      } catch (e) { console.error("Lỗi khôi phục dữ liệu:", e); }
    }
  }, []);

  // --- PERSISTENCE: SAVE ---
  useEffect(() => {
    if (results.length > 0 || siloData || keywordsInput) {
      const state = { results, siloData, keywordsInput };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [results, siloData, keywordsInput]);

  // --- RE-ATTACH TO BACKGROUND TASK ---
  useEffect(() => {
    const activeTask = getTask('keywords_analysis');
    if (activeTask && activeTask.status === 'running') {
      setIsLoading(true);
      setResults(activeTask.results || []);
      if (activeTask.progress) setCurrentProcessing(activeTask.progress);
      
      // Định kỳ kiểm tra để cập nhật UI
      const interval = setInterval(() => {
        const t = getTask('keywords_analysis');
        if (t) {
          setResults([...t.results]);
          setCurrentProcessing(t.progress);
          if (t.status !== 'running') {
            setIsLoading(false);
            setCurrentProcessing(null);
            clearInterval(interval);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [getTask]);

  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(null), 3000); return () => clearTimeout(timer); } }, [toast]);
  // Prevent body scroll when full screen
  useEffect(() => {
    if (isFullScreen || showMindmap) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isFullScreen, showMindmap]);

  useEffect(() => { setCurrentPage(1); }, [activeFilter]);
  const aiValidateKeywordBatch = async (
    seed: string,
    pillar: string,
    cluster: string,
    candidates: string[]
  ): Promise<Set<string>> => {
    if (candidates.length === 0) return new Set();
    try {
      const response = await fetchWithRetry('/api/silo-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'relevance_check',
          seedKeyword: seed,
          pillarKeyword: pillar,
          clusterName: cluster,
          keywords: candidates,
          provider,
          apiKeys: buildAiApiKeys(),
        })
      });
      if (!response.ok) return new Set(candidates);
      const payload = await response.json();
      const accepted: string[] = Array.isArray(payload?.accepted_keywords) ? payload.accepted_keywords : candidates;
      return new Set(accepted.map((item: string) => item.toLowerCase().trim()));
    } catch {
      return new Set(candidates);
    }
  };

  const filterKeywordsHybrid = async (
    seed: string,
    pillar: string,
    cluster: string,
    keywords: string[]
  ): Promise<string[]> => {
    const keepByRule: string[] = [];
    const suspicious: string[] = [];

    for (const kw of keywords) {
      if (isRuleClearlyRelevant(kw, seed, pillar, cluster)) {
        keepByRule.push(kw);
      } else if (!isRuleClearlyIrrelevant(kw, seed, pillar, cluster)) {
        suspicious.push(kw);
      }
    }

    const acceptedByAI = await aiValidateKeywordBatch(seed, pillar, cluster, suspicious);
    const approved = [
      ...keepByRule,
      ...suspicious.filter(kw => acceptedByAI.has(kw.toLowerCase().trim()))
    ];

    return Array.from(new Set(approved));
  };

  const mindmapData = useMemo<MindmapSeedNode[]>(() => {
    const seedTrees: SiloSeedTree[] = siloData?.seeds?.length
      ? siloData.seeds
      : siloData?.pillars?.length
          ? [{ seed_keyword: siloData.seed_keyword || "Seed", pillars: siloData.pillars }]
          : [];
    if (!seedTrees.length) return [];

    return seedTrees.map((seedNode) => {
      const pillarNodes = seedNode.pillars.map((pillar) => {
        const clusterNodes = (pillar.clusters || []).map((cluster) => {
          const scopedKeywords = results
            .filter(
              (row) =>
                (row.pillar || '').toLowerCase().trim() === pillar.pillar_keyword.toLowerCase().trim() &&
                (row.cluster || '').toLowerCase().trim() === cluster.subpage_name.toLowerCase().trim()
            )
            .sort((a, b) => b.efficiency - a.efficiency)
            .slice(0, MINDMAP_KEYWORD_LIMIT)
            .map((row) => row.keyword);

          return {
            subpage_name: cluster.subpage_name,
            keywords: scopedKeywords
          };
        });

        return {
          pillar_keyword: pillar.pillar_keyword,
          clusters: clusterNodes
        };
      });

      return {
        seed_keyword: seedNode.seed_keyword,
        pillars: pillarNodes
      };
    });
  }, [siloData, results]);

  const handleStart = async () => {
    const list = keywordsInput.split('\n').map(k => k.trim()).filter(k => k !== '');
    if (list.length === 0) return;
    
    setIsLoading(true); 
    setResults([]); 
    setCurrentPage(1);

    startTask('keywords_analysis', async (update) => {
      let allResults: KeywordResult[] = [];
      try {
        for (const seed of list) {
          update({ progress: seed });
          setCurrentProcessing(seed);
          const response = await fetchWithRetry('/api/generate-keywords-demo', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              seedKeyword: seed, provider, model: selectedModel, disableAI: !isAIEnabled,
              enable_cpc: isCpcEnabled,
              apiKeys: buildAiApiKeys(),
            }) 
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.details || errorData.error || `Lỗi máy chủ (${response.status})`);
          }

          if (!response.body) continue;

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
              if (!line.trim()) continue;
              try {
                const rawData = JSON.parse(line);
                const newResult = {
                  keyword: rawData.keyword,
                  popularity: rawData.popularity,
                  difficulty: rawData.difficulty,
                  cpc: rawData.cpc,
                  efficiency: rawData.efficiency,
                  intent: rawData.intent,
                  badge: rawData.badge,
                  total_results: rawData.total_results,
                  trend: rawData.trend
                };
                allResults = [...allResults, newResult];
                setResults([...allResults]);
                update({ results: allResults });
              } catch (e) {}
            }
          }
        }
        showToast("Đã hoàn thành phân tích!");
      } catch (error) { 
        showToast('Lỗi kết nối máy chủ.', 'error'); 
        throw error;
      } finally {
        setIsLoading(false);
        setCurrentProcessing(null);
      }
    });
  };

  const handleSiloStart = async () => {
    const list = keywordsInput.split('\n').map(k => k.trim()).filter(k => k !== '').slice(0, 5);
    if (list.length === 0) return;
    setIsLoading(true); setResults([]); setCurrentPage(1); setSiloData(null);
    
    try {
      const allSeeds: SiloSeedTree[] = [];

      for (const seed of list) {
        // --- BƯỚC 1: LLM SILO PLANNING (5 PILLAR PAGES PER SEED) ---
        setCurrentProcessing(`Quy hoạch SILO: ${seed}`);
        const siloResp = await fetchWithRetry('/api/silo-structure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            seedKeyword: seed, provider, 
            apiKeys: buildAiApiKeys(),
          })
        });
        
        const structure = await siloResp.json();
        if (structure.error) throw new Error(structure.error);

        // Support new multi-pillar format, fallback to old format
        const pillars = structure.pillars || [{
          pillar_keyword: structure.pillar_keyword || seed,
          clusters: structure.clusters || []
        }];

        const normalizedPillars: SiloPillar[] = pillars.map((pillar: any) => ({
          pillar_keyword: pillar.pillar_keyword,
          clusters: (pillar.clusters || []).map((cluster: any) => ({
            subpage_name: cluster.subpage_name
          }))
        }));

        allSeeds.push({ seed_keyword: seed, pillars: normalizedPillars });
        setSiloData({ seeds: [...allSeeds] });

        // --- BƯỚC 2: FOR EACH PILLAR, SCRAPE & ANALYZE ---
        for (const pillar of pillars) {
          const Master_Unique_Keywords = new Map<string, string>();
          const Master_Ranks = new Map<string, number>();

          const scrapeTargets = [
            { name: pillar.pillar_keyword, cluster: 'HOMEPAGE (PILLAR)' },
            ...(pillar.clusters || []).map((c: any) => ({ name: c.subpage_name, cluster: c.subpage_name }))
          ];

          for (const target of scrapeTargets) {
            setCurrentProcessing(`[${pillar.pillar_keyword}] Thu hoạch: ${target.name}`);
            const scrapeResp = await fetchWithRetry('/api/generate-keywords-demo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                seedKeyword: target.name, mode: 'SCRAPE', provider, apiKeys: buildAiApiKeys(),
              })
            });

            if (!scrapeResp.body) continue;
            const reader = scrapeResp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const rawData = JSON.parse(line);
                  const kw = rawData.keyword;
                  if (!kw) continue;
                  const norm = kw.toLowerCase().trim();
                  if (!Master_Unique_Keywords.has(norm)) {
                    Master_Unique_Keywords.set(norm, target.cluster);
                  }
                } catch (e) {
                  console.error("Error parsing stream line:", e);
                }
              }
            }

            const clusterKey = target.cluster;
            const collectedKeywords = Array.from(Master_Unique_Keywords.entries())
              .filter(([, cluster]) => cluster === clusterKey)
              .map(([keyword]) => keyword);

            const filteredKeywords = await filterKeywordsHybrid(
              seed,
              pillar.pillar_keyword,
              clusterKey,
              collectedKeywords
            );

            const allowedSet = new Set(filteredKeywords.map(item => item.toLowerCase().trim()));
            Array.from(Master_Unique_Keywords.keys()).forEach((existingKeyword) => {
              const existingCluster = Master_Unique_Keywords.get(existingKeyword);
              if (
                existingCluster === clusterKey &&
                !allowedSet.has(existingKeyword.toLowerCase().trim())
              ) {
                Master_Unique_Keywords.delete(existingKeyword);
              }
            });
          }

          // --- BƯỚC 3: DATA CALCULATOR (BULK) ---
          const uniqueList = Array.from(Master_Unique_Keywords.keys());
          if (uniqueList.length === 0) continue;
          
          const CHUNK_SIZE = 50;
          for (let i = 0; i < uniqueList.length; i += CHUNK_SIZE) {
            const chunk = uniqueList.slice(i, i + CHUNK_SIZE);
            setCurrentProcessing(`[${pillar.pillar_keyword}] Phân tích: ${i + chunk.length} / ${uniqueList.length}`);
            
            const chunkRanks: Record<string, number> = {};
            chunk.forEach(kw => {
              if (Master_Ranks.has(kw)) chunkRanks[kw] = Master_Ranks.get(kw)!;
            });

            const analyzeResp = await fetchWithRetry('/api/generate-keywords-demo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                keywordList: chunk, mode: 'ANALYZE', provider, model: selectedModel, 
                ranks: chunkRanks,
                enable_cpc: isCpcEnabled,
                apiKeys: buildAiApiKeys(),
              })
            });

            if (!analyzeResp.body) continue;
            const reader = analyzeResp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

                for (const line of lines) {
                  if (!line.trim()) continue;
                  try {
                    const rawData = JSON.parse(line);
                    let assignedCluster = Master_Unique_Keywords.get(rawData.keyword.toLowerCase().trim()) || 'Khác';
                    if (rawData.keyword.toLowerCase().trim() === pillar.pillar_keyword.toLowerCase().trim()) {
                      assignedCluster = 'HOMEPAGE (PILLAR)';
                    }

                    setResults(prev => [...prev, { 
                      keyword: rawData.keyword,
                      popularity: rawData.popularity,
                      difficulty: rawData.difficulty,
                      cpc: rawData.cpc,
                      efficiency: rawData.efficiency,
                      intent: rawData.intent,
                      badge: rawData.badge,
                      total_results: rawData.total_results,
                      trend: rawData.trend,
                      pillar: pillar.pillar_keyword, 
                      cluster: assignedCluster 
                    }]);
                  } catch (e) {}
                }
            }
          }
        }
      }
      showToast("Chiến dịch SILO đã hoàn thành!");
    } catch (error: any) {
      showToast(error.message || 'Lỗi hệ thống.', 'error');
    } finally {
      setIsLoading(false);
      setCurrentProcessing(null);
    }
  };

  // SILO: (patch removed) - re-enabled via dedicated patch when needed

  

  const showToast = (message: string, type: 'success' | 'error' = 'success') => { setToast({ message, type }); };
  const handleCopyKeywords = () => { if (results.length === 0) return; navigator.clipboard.writeText(results.map(r => r.keyword).join('\n')); showToast('Đã sao chép danh sách!'); };
  
  // SILO is currently disabled in UI. This function can be re-enabled later.
  
  const handleExportExcel = async () => {
    if (results.length === 0) return;
    
    showToast('Đang chuẩn bị báo cáo...', 'success');
    
    try {
      // Chuẩn bị data đầy đủ cho backend export
      const exportData = results.map(r => ({
        keyword: r.keyword,
        popularity: r.popularity ?? 0,
        difficulty: r.difficulty ?? 0,
        cpc: r.cpc ?? 0.5,
        efficiency: r.efficiency ?? 0,
        status: r.badge?.label ?? 'Nên tham khảo',
        intent: r.intent ?? '',
        total_results: r.total_results ?? 0,
        pillar: r.pillar ?? '',
        cluster: r.cluster ?? '',
        trend_index: r.trend?.index ?? 0,
        trend_growth: r.trend?.growth ?? 0,
        trend_history: Array.isArray(r.trend?.history) ? r.trend?.history : [],
        trend_is_estimated: r.trend?.is_estimated ?? false
      }));

      const response = await fetch('/api/export-seo-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData?.error || 'Không thể khởi động tiến trình xuất báo cáo.';
        throw new Error(detail);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SEO_Report_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('Đã xuất file Excel!');
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Lỗi xuất Excel.';
      showToast(message, 'error');
    }
  };

  // --- NORMALIZED RESULTS ---
  const normalizedResults = useMemo(() => {
    // Data has been normalized by backend as requested
    return [...results].sort((a, b) => b.efficiency - a.efficiency);
  }, [results]);

  const filteredResults = useMemo(() => {
    if (activeFilter === 'ALL') return normalizedResults;
    return normalizedResults.filter(r => {
      if (activeFilter === 'USE') return r.badge.color === 'green';
      if (activeFilter === 'CONSIDER') return r.badge.color === 'yellow';
      if (activeFilter === 'REFERENCE') return r.badge.color === 'orange';
      if (activeFilter === 'HARD') return r.badge.color === 'red';
      if (activeFilter === 'INFO') return r.intent === 'I';
      if (activeFilter === 'BUY') return r.intent === 'T';
      return true;
    });
  }, [normalizedResults, activeFilter]);

  const uniqueClusters = useMemo(() => {
    const set = new Set(results.map(r => r.cluster).filter(Boolean));
    return Array.from(set) as string[];
  }, [results]);

  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const paginatedResults = useMemo(() => { const start = (currentPage - 1) * ITEMS_PER_PAGE; return filteredResults.slice(start, start + ITEMS_PER_PAGE); }, [filteredResults, currentPage]);

  const stats = useMemo(() => {
    if (results.length === 0) return null;
    return { 
      use: results.filter(r => r.badge.color === 'green').length, 
      consider: results.filter(r => r.badge.color === 'yellow').length, 
      reference: results.filter(r => r.badge.color === 'orange').length, 
      hard: results.filter(r => r.badge.color === 'red').length,
      avgEfficiency: Math.round(results.reduce((a, b) => a + b.efficiency, 0) / results.length) 
    };
  }, [results]);

  return (
    <div className="flex flex-col gap-8 font-inter pb-40 -m-8 lg:-m-12 p-8 lg:p-12 min-h-screen selection:bg-indigo-500/30" style={{ backgroundColor: 'var(--body-bg)' }}>
      <header className="flex justify-between items-center pb-8" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex flex-col gap-3">
           <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--active-bg)', border: '1px solid var(--border-color)' }}>
                 <Key className="text-indigo-500" size={24} />
              </div>
              <h1 className="text-2xl font-black tracking-tight uppercase leading-none" style={{ color: 'var(--text-primary)' }}>
                 PHÂN TÍCH TỪ KHÓA
              </h1>
           </div>
           
           <div className="flex items-center gap-4 pl-1">
              <div className="w-10 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
              <p className="text-[10px] font-black text-indigo-500/60 uppercase tracking-[0.2em] leading-none">
                 TỰ ĐỘNG PHÂN TÍCH VÀ GỢI Ý TỪ KHÓA AI
              </p>
           </div>
        </div>
      </header>

      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}><div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>NÊN SỬ DỤNG</div><div className="text-2xl font-black text-emerald-500">{stats.use}</div></div>
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}><div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>NÊN XEM XÉT</div><div className="text-2xl font-black text-amber-500">{stats.consider}</div></div>
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}><div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>THAM KHẢO</div><div className="text-2xl font-black text-orange-500">{stats.reference}</div></div>
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}><div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>QUÁ KHÓ</div><div className="text-2xl font-black text-rose-500">{stats.hard}</div></div>
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}><div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>HIỆU SUẤT TB</div><div className="text-2xl font-black text-indigo-500">{stats.avgEfficiency}</div></div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-8">
        <div className={`col-span-12 ${isFullScreen ? 'hidden' : 'lg:col-span-4'}`}>
          <div className="sticky top-8 space-y-6">
            <Card className="p-8 rounded-3xl space-y-8 flex flex-col shadow-2xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <div className="flex justify-between items-center p-4 rounded-2xl" style={{ backgroundColor: 'var(--active-bg)', border: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-2">
                    {/* CHẾ ĐỘ AI TOGGLE */}
                    <label className="flex items-center cursor-pointer gap-2 p-1.5 px-3 bg-white/[0.03] border border-white/10 rounded-full hover:bg-white/[0.05] transition-all group">
                       <span className={`text-[9px] font-black uppercase tracking-tighter transition-colors ${isAIEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {isAIEnabled ? 'AI ON' : 'AI OFF'}
                       </span>
                       <div className="relative">
                         <input type="checkbox" checked={isAIEnabled} onChange={() => setIsAIEnabled(!isAIEnabled)} className="sr-only peer" />
                         <div className="w-7 h-3.5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-emerald-500 after:shadow-lg" style={{ backgroundColor: 'var(--hover-bg)' }}></div>
                       </div>
                    </label>

                    {/* CHẾ ĐỘ SILO TOGGLE */}
                    <label className={`flex items-center cursor-pointer gap-2 p-1.5 px-3 bg-white/[0.03] border border-white/10 rounded-full hover:bg-white/[0.05] transition-all ${!isAIEnabled ? 'opacity-20 grayscale pointer-events-none' : 'opacity-100'}`}>
                       <span className={`text-[9px] font-black uppercase tracking-tighter ${isSiloMode ? 'text-indigo-400' : 'text-slate-500'}`}>
                         SILO
                       </span>
                       <div className="relative">
                         <input type="checkbox" checked={isSiloMode} disabled={!isAIEnabled} onChange={() => { setIsSiloMode(!isSiloMode); setKeywordsInput(''); }} className="sr-only peer" />
                         <div className="w-7 h-3.5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-indigo-500 after:shadow-lg" style={{ backgroundColor: 'var(--hover-bg)' }}></div>
                       </div>
                    </label>

                    {/* DATFORSEO API TOGGLE */}
                    <label className="flex items-center cursor-pointer gap-2 p-1.5 px-3 bg-white/[0.03] border border-white/10 rounded-full hover:bg-white/[0.05] transition-all group">
                       <span className={`text-[9px] font-black uppercase tracking-tighter transition-colors ${isCpcEnabled ? 'text-amber-400' : 'text-slate-500'}`}>
                          DFSEO
                       </span>
                       <div className="relative">
                         <input type="checkbox" checked={isCpcEnabled} onChange={() => setIsCpcEnabled(!isCpcEnabled)} className="sr-only peer" />
                         <div className="w-7 h-3.5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-amber-500 after:shadow-lg" style={{ backgroundColor: 'var(--hover-bg)' }}></div>
                       </div>
                    </label>
                 </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                     <div className="relative group">
                        <select 
                          value={provider}
                          onChange={(e) => { setProvider(e.target.value); setSelectedModel(''); }}
                          className="w-full relative z-10 border p-4 pl-6 pr-10 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] outline-none appearance-none cursor-pointer transition-all shadow-xl backdrop-blur-md"
                          style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'rgba(99,102,241,0.2)', color: '#6366f1' }}
                        >
                          {[
                             { id: 'google', name: 'GOOGLE AI', key: settings.gemini_api_key },
                             { id: 'openai', name: 'OPENAI', key: settings.openai_api_key },
                             { id: 'groq', name: 'GROQ', key: settings.groq_api_key },
                             { id: 'claude', name: 'CLAUDE', key: settings.claude_api_key },
                             { id: 'deepseek', name: 'DEEPSEEK', key: settings.deepseek_api_key },
                             { id: 'openrouter', name: 'OPENROUTER', key: settings.openrouter_api_key },
                             { id: 'ollama', name: 'OLLAMA', key: shouldExposeOllamaInUi(settings) ? (settings.ollama_base_url?.trim() || settings.ollama_api_key?.trim() || 'local') : '' },
                          ].filter(p => p.key).length > 0 ? (
                            [
                              { id: 'google', name: 'GOOGLE AI', key: settings.gemini_api_key },
                              { id: 'openai', name: 'OPENAI', key: settings.openai_api_key },
                              { id: 'groq', name: 'GROQ', key: settings.groq_api_key },
                              { id: 'claude', name: 'CLAUDE', key: settings.claude_api_key },
                              { id: 'deepseek', name: 'DEEPSEEK', key: settings.deepseek_api_key },
                              { id: 'openrouter', name: 'OPENROUTER', key: settings.openrouter_api_key },
                              { id: 'ollama', name: 'OLLAMA', key: shouldExposeOllamaInUi(settings) ? (settings.ollama_base_url?.trim() || settings.ollama_api_key?.trim() || 'local') : '' },
                            ].filter(p => p.key).map(p => (
                              <option key={p.id} value={p.id} style={{ backgroundColor: 'var(--card-bg)', color: '#6366f1' }}>{p.name}</option>
                            ))
                          ) : (
                            <option value="" style={{ backgroundColor: 'var(--card-bg)', color: '#6366f1' }}>CHƯA KẾT NỐI AI</option>
                          )}
                        </select>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-500 group-hover:text-indigo-400 transition-colors">
                           <ChevronDown size={12} />
                        </div>
                     </div>
                     
                     <div className="relative group">
                        <select 
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full relative z-10 border p-4 pl-6 pr-10 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] outline-none appearance-none cursor-pointer transition-all shadow-xl backdrop-blur-md"
                          style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'rgba(99,102,241,0.3)', color: '#6366f1' }}
                        >
                          {isFetchModelsLoading ? (
                            <option style={{ backgroundColor: 'var(--card-bg)', color: '#6366f1' }}>DÒ TÌM...</option>
                          ) : availableModels.length > 0 ? (
                            availableModels.filter(Boolean).map((m, idx) => (
                              <option key={`${m}-${idx}`} value={m} style={{ backgroundColor: 'var(--card-bg)', color: '#6366f1' }}>{m}</option>
                            ))
                          ) : (
                            <option style={{ backgroundColor: 'var(--card-bg)', color: '#6366f1' }} value="">-- MODEL --</option>
                          )}
                        </select>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-indigo-500/50 group-hover:text-indigo-400 transition-colors">
                          {isFetchModelsLoading ? <RefreshCw size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                        </div>
                     </div>
                  </div>
                  
                  <div className="relative group overflow-hidden rounded-2xl">
                    <Search className="absolute top-5 left-5 text-slate-700 z-20" size={18} />
                    {isSiloMode ? (
                      <textarea 
                        value={keywordsInput} 
                        onChange={(e) => setKeywordsInput(e.target.value)} 
                        placeholder="Nhập tối đa 5 từ khóa hạt giống (Enter để xuống dòng)" 
                        className="w-full h-[120px] border p-5 pl-14 rounded-2xl placeholder:text-slate-400 font-bold outline-none transition-all resize-none custom-scrollbar-indigo shadow-inner"
                        style={{ backgroundColor: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.3)', color: 'var(--text-primary)' }} 
                      />
                    ) : (
                      <input 
                        type="text"
                        value={keywordsInput} 
                        onChange={(e) => setKeywordsInput(e.target.value)} 
                        placeholder="Ví dụ: thức ăn cho chó..." 
                        className="w-full h-[60px] border p-5 pl-14 rounded-2xl placeholder:text-slate-400 font-bold outline-none transition-all shadow-inner"
                        style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'rgba(99,102,241,0.2)', color: 'var(--text-primary)' }} 
                      />
                    )}
                  </div>
              </div>

              {currentProcessing && (<div className="flex items-center gap-3 text-indigo-400 text-[10px] font-black uppercase tracking-widest"><RefreshCw size={14} className="animate-spin" /><span>{currentProcessing}</span></div>)}
              
              <Button 
                onClick={isSiloMode ? handleSiloStart : handleStart} 
                isLoading={isLoading} 
                variant={isSiloMode ? "secondary" : "primary"} 
                className={`w-full py-6 font-black uppercase tracking-[0.3em] text-[11px] rounded-xl h-[56px] active:scale-95 transition-all ${isSiloMode ? 'bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 text-white shadow-orange-600/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'}`} 
                leftIcon={isSiloMode ? <MagicIcon size={18} /> : <TrendingUp size={18} />}
              >
                {isSiloMode ? 'Tạo Cấu Trúc SILO' : 'CÀO TỪ KHÓA'}
              </Button>
              {/* SILO feature temporarily disabled - re-enable by uncommenting this button */}
            </Card>
          </div>
        </div>

        <div className={`col-span-12 ${isFullScreen ? 'fixed inset-0 z-[9999] m-0 overflow-y-auto custom-scrollbar-indigo' : 'lg:col-span-8'}`} style={isFullScreen ? { backgroundColor: 'var(--body-bg)' } : {}}>
          <Card className={`${isFullScreen ? 'min-h-screen rounded-none border-none pb-40' : 'rounded-3xl min-h-[600px] shadow-2xl'} relative flex flex-col`} style={!isFullScreen ? { backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' } : {}}>
            <div className={`sticky top-0 z-40 backdrop-blur-2xl ${isFullScreen ? 'p-4 lg:p-8' : ''}`} style={{ backgroundColor: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)' }}>
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="space-y-1"><Typography variant="h3" className="mb-0 text-lg font-black uppercase tracking-widest leading-none" style={{ color: 'var(--text-primary)' }}>KẾT QUẢ PHÂN TÍCH</Typography><div className="h-1 w-10 bg-indigo-500 rounded-full" /></div>
                  {results.length > 0 && (<div className="px-3 py-1.5 rounded-lg flex items-center gap-2" style={{ backgroundColor: 'var(--active-bg)', border: '1px solid var(--border-color)' }}><span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>TỔNG:</span><span className="text-lg font-black font-mono" style={{ color: 'var(--text-primary)' }}>{results.length}</span></div>)}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setIsFullScreen(!isFullScreen)} className={`px-4 h-10 ${isFullScreen ? 'bg-indigo-600 text-white' : ''} hover:opacity-80 text-[10px] uppercase font-black`} style={!isFullScreen ? { backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' } : {}} leftIcon={isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}>
                    {isFullScreen ? 'THU NHỎ' : 'PHÓNG TO'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setShowMindmap(!showMindmap)} className={`px-4 h-10 ${showMindmap ? 'bg-orange-600 text-white' : ''} hover:opacity-80 text-[10px] uppercase font-black`} style={!showMindmap ? { backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' } : {}} leftIcon={<MagicIcon size={14} />}>XEM MINDMAP</Button>
                  <Button variant="secondary" size="sm" onClick={handleCopyKeywords} className="px-4 h-10 hover:opacity-80 text-[10px] uppercase font-black" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }} leftIcon={<Copy size={14} />}>COPY</Button>
                  <Button variant="secondary" size="sm" onClick={handleExportExcel} className="px-4 h-10 hover:opacity-80 text-[10px] uppercase font-black" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }} leftIcon={<Download size={14} />}>EXCEL</Button>
                </div>
              </div>

              {/* Filters Hidden by Request */}
              {false && (
                <div className="px-6 pb-4 flex gap-2 overflow-x-auto no-scrollbar">
                  {[{ id: 'ALL', label: 'TẤT CẢ', icon: Filter, color: 'indigo' }, { id: 'USE', label: 'NÊN SỬ DỤNG', icon: MagicIcon, color: 'emerald' }, { id: 'CONSIDER', label: 'NÊN XEM XÉT', icon: Zap, color: 'amber' }, { id: 'REFERENCE', label: 'THAM KHẢO', icon: Target, color: 'orange' }, { id: 'HARD', label: 'QUÁ KHÓ', icon: Minimize2, color: 'rose' }, { id: 'INFO', label: 'THÔNG TIN', icon: MousePointerClick, color: 'blue' }, { id: 'BUY', label: 'MUA HÀNG', icon: TrendingUp, color: 'purple' }].map(f => (
                    <button key={f.id} onClick={() => setActiveFilter(f.id as FilterType)} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-2 transition-all border shrink-0 ${activeFilter === f.id ? `bg-${f.color === 'emerald' ? 'emerald' : f.color === 'rose' ? 'rose' : f.color === 'orange' ? 'orange' : f.color === 'amber' ? 'amber' : 'indigo'}-600 border-${f.color === 'emerald' ? 'emerald' : f.color === 'rose' ? 'rose' : f.color === 'orange' ? 'orange' : f.color === 'amber' ? 'amber' : 'indigo'}-500 text-white shadow-lg` : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}><f.icon size={11} /> {f.label}</button>
                  ))}
                </div>
              )}

              <div className={`grid ${isCpcEnabled ? 'grid-cols-13' : 'grid-cols-12'} gap-4 px-6 py-4 text-[10px] font-black uppercase tracking-wider`} style={{ backgroundColor: 'var(--hover-bg)', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                {isSiloMode && (
                  <>
                    <div className="col-span-2">Trang Trụ Cột</div>
                    <div className="col-span-2">Trang Con</div>
                  </>
                )}
                <div className={isSiloMode ? "col-span-2" : isCpcEnabled ? "col-span-4" : "col-span-5"}>Từ khóa</div>
                <div className="col-span-2 text-center">XU HƯỚNG (12T)</div>
                <div className="col-span-1 text-center">POP</div>
                <div className="col-span-1 text-center">KD</div>
                {isCpcEnabled && <div className="col-span-1 text-center">CPC</div>}
                <div className={isSiloMode ? "col-span-1 text-center" : "col-span-2 text-center"}>Intent</div>
                <div className="col-span-1 text-right">EI</div>
              </div>
            </div>

            <div className={`p-0 ${isFullScreen ? '' : 'overflow-hidden'}`}>
              <AnimatePresence>
                 {selectedKeyword && (
                    <TrendDetailsModal 
                       keyword={selectedKeyword} 
                       onClose={() => setSelectedKeyword(null)} 
                    />
                 )}
              </AnimatePresence>

              {results.length === 0 ? (<div className="flex flex-col items-center justify-center p-32 opacity-20"><Target size={100} className="mb-6" /><p className="text-sm font-black uppercase tracking-[0.5em]">Chưa có dữ liệu</p></div>) : 
               filteredResults.length === 0 ? (<div className="flex flex-col items-center justify-center p-20 opacity-40"><Filter size={48} className="mb-4" /><p className="text-xs font-black uppercase tracking-wider">Không có kết quả phù hợp</p></div>) : 
               useVirtualScroll && filteredResults.length > 100 ? (<VirtualKeywordList results={filteredResults} isSiloMode={isSiloMode} isCpcEnabled={isCpcEnabled} onKeywordClick={setSelectedKeyword} />) : (
                <>
                  <div className="divide-y divide-white/[0.03]">
                    {paginatedResults.map((r, i) => (
                      <motion.div 
                        key={(currentPage - 1) * ITEMS_PER_PAGE + i} 
                        onClick={() => setSelectedKeyword(r)}
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ delay: i * 0.02 }} 
                        className={`grid ${isCpcEnabled ? 'grid-cols-13' : 'grid-cols-12'} gap-4 px-6 py-4 hover:bg-indigo-500/10 transition-all items-center group cursor-pointer active:scale-[0.99]`}
                      >
                        {isSiloMode && (
                          <>
                            <div className="col-span-2 truncate text-[10px] font-black text-indigo-400 uppercase tracking-tighter" title={r.pillar}>{r.pillar || '-'}</div>
                            <div className="col-span-2 truncate text-[10px] font-bold text-slate-500" title={r.cluster}>{r.cluster || '-'}</div>
                          </>
                        )}
                        <div className={isSiloMode ? "col-span-2" : isCpcEnabled ? "col-span-4" : "col-span-5"}>
                          <div className="font-bold text-[color:var(--text-secondary)] text-sm group-hover:text-[color:var(--text-primary)] transition-colors truncate" title={r.keyword}>{r.keyword}</div>
                        </div>
                        <div className="col-span-2 flex justify-center">
                           <TrendSparkline data={r.trend?.history || []} growth={r.trend?.growth || 0} />
                        </div>
                        <div className="col-span-1"><PopularityBar value={r.popularity} /></div>
                        <div className="col-span-1"><DifficultyBar value={r.difficulty} /></div>
                        {isCpcEnabled && <div className="col-span-1"><CpcBar value={r.cpc} /></div>}
                        <div className={isSiloMode ? "col-span-1 flex justify-center" : "col-span-2 flex justify-center"}>
                          <IntentIcons intent={r.intent} />
                        </div>
                        <div className="col-span-1 flex justify-end"><EfficiencyBadge badge={r.badge} efficiency={r.efficiency} /></div>
                      </motion.div>
                    ))}
                  </div>
                  {totalPages > 1 && (<Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filteredResults.length} />)}
                </>
              )}
              {false && showMindmap && mindmapData.length > 0 && (
                <div className="p-8 border-t border-white/5 bg-indigo-500/[0.02]">
                  <div className="space-y-8">
                    {mindmapData.map((seedNode, seedIdx) => (
                      <div key={`${seedNode.seed_keyword}-${seedIdx}`} className="bg-black/40 rounded-3xl p-8 border border-indigo-500/20 shadow-2xl overflow-x-auto">
                        <div className="min-w-[780px] flex flex-col items-center">
                          <div className="px-6 py-3 bg-black rounded-xl border border-white/10 text-white font-black uppercase text-xs tracking-widest shadow-[0_0_24px_rgba(15,23,42,0.65)]">
                            {seedNode.seed_keyword}
                          </div>
                          <div className="h-8 w-px bg-indigo-500/30"></div>

                          <div className="w-full flex flex-col gap-8">
                            {seedNode.pillars.map((pillar, pIdx) => (
                              <div key={`${pillar.pillar_keyword}-${pIdx}`} className="flex flex-col items-center">
                                <div className="px-6 py-3 bg-indigo-600 rounded-xl border border-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.4)] text-white font-black uppercase text-[10px] tracking-widest max-w-[520px] text-center">
                                  {pillar.pillar_keyword}
                                </div>
                                <div className="h-6 w-px bg-indigo-500/30"></div>

                                <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                  {(pillar.clusters || []).map((cluster, cIdx) => (
                                    <div key={`${cluster.subpage_name}-${cIdx}`} className="rounded-2xl bg-slate-900/60 border border-white/10 p-4">
                                      <div className="px-3 py-2 bg-slate-800 rounded-lg border border-indigo-500/20 text-slate-100 text-[10px] font-bold text-center uppercase tracking-wider truncate" title={cluster.subpage_name}>
                                        {cluster.subpage_name}
                                      </div>
                                      <div className="mt-3 flex flex-col gap-1.5">
                                        {(cluster.keywords || []).length > 0 ? (
                                          cluster.keywords.map((k, kIdx) => (
                                            <div
                                              key={`${k}-${kIdx}`}
                                              title={k}
                                              className="px-2.5 py-1.5 bg-white/5 rounded border border-white/5 text-[9px] text-slate-300 hover:text-white hover:border-indigo-400/40 transition-all truncate"
                                            >
                                              {k}
                                            </div>
                                          ))
                                        ) : (
                                          <div className="px-2.5 py-1.5 bg-white/5 rounded border border-white/5 text-[9px] text-slate-500 italic">
                                            Chưa có từ khóa phù hợp
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {showMindmap && mindmapData.length > 0 && (
          <MindmapModal data={mindmapData} onClose={() => setShowMindmap(false)} />
        )}
        {toast && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 100 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 100 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[500]">
            <div className={`px-8 py-4 rounded-2xl flex items-center gap-4 border shadow-2xl backdrop-blur-2xl ${toast.type === 'success' ? 'bg-emerald-600/90 border-emerald-400/20 text-white' : 'bg-rose-600/90 border-rose-400/20 text-white'}`}>
              <CheckCircle size={18} /><span className="text-xs font-black uppercase tracking-wider">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
