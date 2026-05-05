'use client';

import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  Settings
} from 'lucide-react';
import Card from '@/shared/ui/Card';
import Typography from '@/shared/ui/Typography';
import { getMetrics, AppMetrics } from '@/shared/utils/metrics';
import * as XLSX from 'xlsx';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<AppMetrics | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [hoveredTool, setHoveredTool] = useState<{ name: string; val: number; percentage: number; color: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setMetrics(getMetrics());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 11) return 'CHÀO BUỔI SÁNG';
    if (hour >= 11 && hour < 14) return 'CHÀO BUỔI TRƯA';
    if (hour >= 14 && hour < 18) return 'CHÀO BUỔI CHIỀU';
    return 'CHÀO BUỔI TỐI';
  };

  const handleExportHistory = () => {
    if (!metrics?.history?.length) return;
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // 1. Tool Usage Metrics Sheet
      const toolData = Object.entries(metrics.tool_usage).map(([tool, val]) => ({
        'Công cụ': tool,
        'Số lượt sử dụng': val,
        'Giới hạn': 100,
        'Trạng thái (%)': `${Math.round(Math.min((val as number / 100) * 100, 100))}%`
      }));
      const wsMetrics = XLSX.utils.json_to_sheet(toolData);
      XLSX.utils.book_append_sheet(wb, wsMetrics, 'Tool Analysis');

      // 2. Detailed History Sheet
      const historyData = metrics.history.map(h => ({
        'Thời gian': new Date(h.timestamp).toLocaleString('vi-VN'),
        'Công cụ': h.tool,
        'Hành động': h.action
      }));
      const wsHistory = XLSX.utils.json_to_sheet(historyData);
      XLSX.utils.book_append_sheet(wb, wsHistory, 'Usage History');

      XLSX.writeFile(wb, `OmniSuite_FullReport_${new Date().getTime()}.xlsx`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <Activity size={48} className="text-indigo-500/20 animate-pulse" />
        <p className="font-black uppercase tracking-[0.3em] text-sm" style={{ color: 'var(--text-muted)' }}>Initializing System Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-2">
      {/* Header Section */}
      <header className="flex justify-between items-center">
        <div className="space-y-0">
          <h1 className="text-5xl font-black tracking-tighter uppercase leading-none" style={{ color: 'var(--text-primary)' }}>
            {getGreeting()}
          </h1>
        </div>
        
        <div className="flex-1" />
        
        <div className="text-right flex flex-col items-end">
          <div className="rounded-2xl p-4 px-6 backdrop-blur-md" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)' }}>
            <p className="text-4xl font-mono font-black tracking-tighter leading-none" style={{ color: 'var(--text-primary)' }}>
               {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-[10px] font-black tracking-widest uppercase mt-2 text-right" style={{ color: 'var(--text-muted)' }}>
               {currentTime.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-stretch">
        {/* Left Column: Analysis Chart */}
        <div className="xl:col-span-5 flex flex-col">
          <div className="h-16 flex items-center gap-4 mb-4">
             <Typography variant="h3" className="font-black uppercase text-2xl tracking-[0.1em] mb-0 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>PHÂN TÍCH <span style={{ color: 'var(--text-primary)' }}>CÔNG CỤ</span></Typography>
             <div className="flex-1 h-[1px]" style={{ backgroundColor: 'var(--border-color)' }} />
          </div>
          <Card className="flex-1 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center gap-10 min-h-[550px]" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <div className="relative w-80 h-80">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {Object.values(metrics.tool_usage).reduce((a, b: number) => a + (b || 0), 0) === 0 ? (
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border-color)" strokeWidth="10" />
                ) : (() => {
                  const total = Object.values(metrics.tool_usage).reduce((a, b: number) => a + (b || 0), 0);
                  let currentOffset = 0;
                  const colors = ['#6366f1', '#a78bfa', '#22d3ee', '#34d399', '#fb7185', '#fbbf24'];
                  const toolNames: Record<string, string> = {
                    content: 'Viết bài AI',
                    keywords: 'Từ khóa',
                    images: 'Hình ảnh AI',
                    maps: 'Quét Bản đồ',
                    seoTools: 'Bộ công cụ SEO'
                  };
                  
                  return Object.entries(metrics.tool_usage).map(([tool, val], i) => {
                    const percentage = ((val as number) / total) * 100;
                    if (percentage === 0) return null;
                    
                    const sliceColor = colors[i % colors.length];
                    const slice = (
                      <circle
                        key={tool}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={sliceColor}
                        strokeWidth="10"
                        strokeDasharray={`${percentage} ${100 - percentage}`}
                        strokeDashoffset={-currentOffset}
                        pathLength="100"
                        onMouseEnter={() => setHoveredTool({ 
                          name: toolNames[tool] || tool, 
                          val: val as number,
                          percentage: Math.round(percentage),
                          color: sliceColor
                        })}
                        onMouseLeave={() => setHoveredTool(null)}
                        className="transition-all duration-300 ease-out hover:stroke-white cursor-pointer hover:stroke-[12px]"
                      />
                    );
                    currentOffset += percentage;
                    return slice;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-8 transition-all duration-300">
                {hoveredTool ? (
                  <div className="animate-in fade-in zoom-in duration-300">
                    <div className="flex items-end justify-center gap-1">
                      <span className="text-5xl font-black block leading-none" style={{ color: hoveredTool.color }}>
                        {hoveredTool.val}
                      </span>
                      <span className="text-xl font-bold mb-1" style={{ color: 'var(--text-muted)' }}>
                        ({hoveredTool.percentage}%)
                      </span>
                    </div>
                    <span className="text-[12px] font-black uppercase tracking-widest leading-none block mt-2" style={{ color: 'var(--text-muted)' }}>
                      {hoveredTool.name}
                    </span>
                  </div>
                ) : (
                  <div className="animate-in fade-in zoom-in duration-300">
                    <span className="text-5xl font-black block" style={{ color: 'var(--text-primary)' }}>
                      {Object.values(metrics.tool_usage).reduce((a, b: number) => a + (b || 0), 0)}
                    </span>
                    <span className="text-[12px] font-black uppercase tracking-widest leading-none block" style={{ color: 'var(--text-primary)' }}>TỔNG CỘNG</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tool Usage Limits - Horizontal Bars */}
            <div className="w-full mt-auto pt-10 space-y-8" style={{ borderTop: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-4">
                <Typography variant="h3" className="font-black uppercase text-[14px] tracking-[0.2em] mb-0" style={{ color: 'var(--text-muted)' }}>GIỚI HẠN <span style={{ color: 'var(--text-secondary)' }}>SỬ DỤNG</span></Typography>
                <div className="flex-1 h-[1px]" style={{ backgroundColor: 'var(--border-color)' }} />
              </div>
              
              <div className="grid grid-cols-2 gap-x-10 gap-y-8">
                {(Object.entries(metrics.tool_usage) as [string, number][]).map(([key, val]) => {
                  const toolNames: Record<string, string> = {
                    content: 'Viết bài AI',
                    keywords: 'Từ khóa',
                    images: 'Hình ảnh AI',
                    maps: 'Quét Bản đồ',
                    seoTools: 'Bộ công cụ SEO'
                  };
                  const percentage = Math.min((val / 100) * 100, 100);
                  return (
                    <div key={key} className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-[13px] font-black uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>{toolNames[key] || key}</span>
                        <span className="text-[11px] font-mono font-bold" style={{ color: 'var(--text-muted)' }}>{val}/100</span>
                      </div>
                      <div className="h-[5px] w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--hover-bg)' }}>
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-1000 ease-out shadow-[0_4px_12px_rgba(99,102,241,0.4)]" 
                          style={{ width: `${percentage}%` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Real-time History Table */}
        <div className="xl:col-span-7 flex flex-col">
          <div className="h-16 flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <Typography variant="h3" className="font-black uppercase text-2xl tracking-[0.1em] mb-0 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>LỊCH SỬ <span style={{ color: 'var(--text-primary)' }}>SỬ DỤNG</span></Typography>
              <div className="w-12 h-[1px]" style={{ backgroundColor: 'var(--border-color)' }} />
            </div>
            <button onClick={handleExportHistory} className="px-6 py-2.5 text-[11px] font-black rounded-xl transition-all uppercase tracking-widest flex items-center gap-2 hover:opacity-80" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
              XUẤT BÁO CÁO
            </button>
          </div>

          <Card className="flex-1 p-0 rounded-[2.5rem] shadow-2xl overflow-hidden min-h-[550px]" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <div className="overflow-x-auto custom-scrollbar-indigo max-h-[550px] overscroll-contain relative">
               {metrics.history && metrics.history.length > 0 ? (
                  <table className="w-full border-collapse" style={{ color: 'var(--text-primary)' }}>
                     <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)' }}>
                        <tr>
                           <th className="p-5 text-left uppercase tracking-widest text-[11px] font-black" style={{ color: 'var(--text-muted)' }}>Thời gian</th>
                           <th className="p-5 text-left uppercase tracking-widest text-[11px] font-black" style={{ color: 'var(--text-muted)' }}>Công cụ</th>
                           <th className="p-5 text-left uppercase tracking-widest text-[11px] font-black" style={{ color: 'var(--text-muted)' }}>Thao tác</th>
                        </tr>
                     </thead>
                     <tbody style={{ borderColor: 'var(--border-color)' }}>
                        {metrics.history.map((h, i) => (
                           <tr key={h.id || i} className="transition-colors group" style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td className="p-5 whitespace-nowrap font-mono">
                                 <div className="flex flex-col">
                                    <span className="text-[14px] font-black tracking-tight leading-none uppercase" style={{ color: 'var(--text-primary)' }}>
                                       {new Date(h.timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </span>
                                    <span className="text-[11px] mt-1.5 font-bold tracking-widest" style={{ color: '#f59e0b' }}>
                                       {new Date(h.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                 </div>
                              </td>
                              <td className="p-5 text-left">
                                 <span className="px-3 py-1 rounded-full uppercase tracking-widest font-black text-[10px]" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                                    {h.tool}
                                 </span>
                              </td>
                              <td className="p-5 text-left">
                                 <p className="font-black text-[13px] uppercase tracking-tight truncate max-w-[250px]" style={{ color: 'var(--text-primary)' }}>{h.action}</p>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               ) : (
                  <div className="flex flex-col items-center justify-center p-32 space-y-6 grayscale">
                     <Activity size={64} className="animate-pulse" style={{ color: 'var(--border-color)' }} />
                     <Typography variant="h1" className="text-4xl font-black uppercase tracking-[0.5em] leading-none" style={{ color: 'var(--hover-bg)' }}>STANDBY</Typography>
                  </div>
               )}
            </div>
          </Card>
        </div>
      </div>

      <footer className="mt-2 pt-1 pb-1 flex justify-between items-center px-4" style={{ borderTop: '1px solid var(--border-color)' }}>
        <div className="flex flex-col gap-0.5">
          <p className="text-[15px] font-black tracking-widest leading-none text-left" style={{ color: 'var(--text-muted)' }}>
            © 2026 <span style={{ color: 'var(--text-primary)' }}>OmniSuite AI</span>
          </p>
          <div className="h-[2px] w-12 bg-indigo-500/50 rounded-full" />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-1 rounded-full backdrop-blur-sm" style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)' }}>
             <span className="text-[13px] font-black text-indigo-500 uppercase tracking-widest">High Speed</span>
             <span className="font-bold" style={{ color: 'var(--text-muted)' }}>·</span>
             <span className="text-[13px] font-black text-violet-500 uppercase tracking-widest">High Performance</span>
             <span className="font-bold" style={{ color: 'var(--text-muted)' }}>·</span>
             <span className="text-[13px] font-black text-emerald-500 uppercase tracking-widest">Stable</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
