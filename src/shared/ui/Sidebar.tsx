'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  MapPin, 
  Image as ImageIcon, 
  Settings,
  Key,
  Search,
  Activity,
  X,
  Sun,
  Moon,
  LogOut,
  BarChart,
  PanelLeft,
  PanelRight
} from 'lucide-react';
import { useSession, signIn, signOut } from "next-auth/react";
import Image from 'next/image';

const navGroups = [
  {
    title: 'TỔNG QUAN',
    items: [
      { name: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard },
    ]
  },
  {
    title: 'CÁC CÔNG CỤ',
    items: [
      { name: 'Phân tích Từ khóa', href: '/dashboard/keywords', icon: Key },
      { name: 'Viết bài AI', href: '/dashboard/content', icon: FileText },
      { name: 'Quét bản đồ', href: '/dashboard/maps', icon: MapPin },
      { name: 'Bộ công cụ SEO', href: '/dashboard/seo-tools', icon: Search },
      { name: 'SEO nâng cao', href: '/dashboard/seo-tools/advanced', icon: BarChart },
      { name: 'Hình ảnh AI', href: '/dashboard/images', icon: ImageIcon },
    ]
  },
  {
    title: 'HỆ THỐNG',
    items: [
      { name: 'Cấu hình hệ thống', href: '/dashboard/settings', icon: Settings },
    ]
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  /** SSR/first paint = expanded; sync from localStorage after mount to avoid empty-shell flash */
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // REAL AUTH SESSION
  const { data: session, status } = useSession();
  const isGoogleConnected = status === "authenticated";
  const isConnecting = status === "loading";

  useEffect(() => {
    // Check saved theme
    const savedTheme = localStorage.getItem('omnisuite-theme') as 'dark' | 'light' | null;
    const initialTheme = savedTheme || 'dark';
    setTheme(initialTheme);
    document.documentElement.classList.toggle('light', initialTheme === 'light');

    // Listen for theme changes
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains('light') ? 'light' : 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // Check saved sidebar state
    const savedCollapsed = localStorage.getItem('omnisuite-sidebar-collapsed') === 'true';
    setIsCollapsed(savedCollapsed);
    document.documentElement.style.setProperty('--sidebar-width', savedCollapsed ? '80px' : '300px');
    
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('omnisuite-theme', newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
  };

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('omnisuite-sidebar-collapsed', String(newState));
    // Update CSS custom property for layout
    document.documentElement.style.setProperty('--sidebar-width', newState ? '80px' : '300px');
  };

  return (
    <aside 
      className={`fixed left-0 top-0 h-screen z-50 flex flex-col font-inter will-change-transform ${isCollapsed ? 'w-[80px]' : 'w-[300px]'}`} 
      style={{ 
        backgroundColor: 'var(--sidebar-bg)', 
        borderRight: '1px solid var(--border-color)',
        transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      {/* Branding Area with Toggle */}
      <div className={`flex items-center transition-all duration-300 ${isCollapsed ? 'p-3 justify-center h-[72px]' : 'p-6 justify-between h-[88px]'}`}>
        <Link 
          href="/" 
          className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}
        >
          <h1 className="text-2xl font-black tracking-tighter whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
            OmniSuite <span className="text-indigo-500 drop-shadow-[0_0_12px_rgba(99,102,241,0.4)]">AI</span>
          </h1>
        </Link>
        
        {/* Collapse Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-xl transition-all duration-200 hover:scale-110 hover:bg-white/5 shrink-0"
          style={{ 
            backgroundColor: 'var(--active-bg)', 
            border: '1px solid var(--border-color)',
            transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), background-color 200ms'
          }}
          title={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          <PanelLeft size={18} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className={`flex-1 py-4 space-y-1 overflow-y-auto no-scrollbar ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {/* Group Title - only show when expanded */}
            {!isCollapsed && (
              <div 
                className="px-4 py-2 text-[10px] font-black tracking-widest uppercase overflow-hidden transition-all duration-300"
                style={{ color: 'var(--text-muted)' }}
              >
                {group.title}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                // Fix: Chỉ active item cụ thể nhất, không active cả parent và child cùng lúc
                const isExactMatch = pathname === item.href;
                // Chỉ match parent nếu path là con trực tiếp (không có / trong phần còn lại)
                const isParentMatch = item.href !== '/dashboard' && 
                  pathname?.startsWith(item.href + '/') &&
                  !pathname?.slice(item.href.length + 1).includes('/');
                // Hoặc match nếu đây là path dài nhất khớp (tìm trong tất cả items)
                const allHrefs = navGroups.flatMap(g => g.items.map(i => i.href));
                const longerMatchExists = allHrefs.some(h => 
                  h !== item.href && 
                  h.startsWith(item.href + '/') && 
                  pathname?.startsWith(h)
                );
                const isActive = isExactMatch || (isParentMatch && !longerMatchExists);
                const isMonitor = item.href === '#monitor';
                
                return (
                  <button
                    key={item.href}
                    onClick={(e) => {
                      if (isMonitor) {
                        e.preventDefault();
                        setIsMonitorOpen(true);
                      }
                    }}
                    className={`w-full ${isCollapsed ? 'text-center' : 'text-left'}`}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <Link
                      href={isMonitor ? '#' : item.href}
                      className={`flex items-center ${isCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'} transition-all duration-200 group rounded-xl relative overflow-hidden ${
                        isActive 
                          ? 'border border-indigo-500/30' 
                          : 'hover:bg-white/5'
                      }`}
                      style={{ 
                        backgroundColor: isActive ? 'var(--active-bg)' : 'transparent'
                      }}
                    >
                      {/* Active Indicator Line */}
                      {isActive && (
                        <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                      )}
                      
                      <div className={`flex items-center relative z-10 ${isCollapsed ? 'justify-center' : 'gap-3 w-full'}`}>
                        <item.icon 
                          size={isCollapsed ? 22 : 20} 
                          className={`transition-all duration-200 shrink-0 ${isCollapsed ? 'mx-auto' : ''}`} 
                          style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }} 
                        />
                        {!isCollapsed && (
                          <span 
                            className="text-[14px] font-semibold tracking-tight transition-all duration-300 whitespace-nowrap overflow-hidden"
                            style={{ 
                              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                              maxWidth: isCollapsed ? '0' : '200px',
                              opacity: isCollapsed ? '0' : '1'
                            }} 
                          >
                            {item.name}
                          </span>
                        )}
                      </div>
                    </Link>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Area */}
      <div className={`backdrop-blur-md relative ${isCollapsed ? 'p-3' : 'p-6'}`} style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
        <div className="flex flex-col gap-6">
          <div className={`flex items-center ${isCollapsed ? 'flex-col gap-2' : 'justify-between'}`}>
            <div className={`flex items-center gap-3 group/user overflow-hidden ${isCollapsed ? 'flex-col' : ''}`}>
              <div className={`rounded-full flex items-center justify-center font-black text-[12px] border uppercase shadow-lg transition-all duration-500 overflow-hidden relative ${
                isGoogleConnected 
                  ? 'bg-white border-sky-500/30' 
                  : 'bg-gradient-to-br from-indigo-600 to-violet-600 border-white/10'
              } ${isCollapsed ? 'w-8 h-8 text-[10px]' : 'w-10 h-10 shrink-0'}`} style={{ color: isGoogleConnected ? '#1e293b' : 'white' }}>
                 {isConnecting ? (
                   <div className="animate-spin text-sky-500">
                      <Activity size={isCollapsed ? 12 : 16} />
                   </div>
                 ) : (
                   <>
                     {isGoogleConnected && session?.user?.image ? (
                        <Image 
                          src={session.user.image} 
                          alt="Avatar" 
                          width={isCollapsed ? 32 : 40} 
                          height={isCollapsed ? 32 : 40} 
                          className="w-full h-full object-cover"
                        />
                     ) : (
                        <span>{session?.user?.name?.[0] || 'AD'}</span>
                     )}
                   </>
                 )}
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <p className={`text-[13px] font-black leading-none uppercase tracking-wide truncate transition-colors ${isGoogleConnected ? 'text-sky-400' : 'text-white'}`}>
                     {isConnecting ? 'Đang đồng bộ...' : (session?.user?.name || 'Quản trị viên')}
                  </p>
                  {!isGoogleConnected && !isConnecting && (
                     <span className="text-[9px] font-bold text-slate-500 mt-1.5 uppercase tracking-widest">HỆ THỐNG NỘI BỘ</span>
                  )}
                </div>
              )}
            </div>
            
            <div className={`flex items-center gap-2 ${isCollapsed ? 'flex-col' : ''}`}>
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className={`rounded-xl transition-all duration-200 hover:scale-105 ${isCollapsed ? 'p-1.5' : 'p-2.5'}`}
                style={{ backgroundColor: 'var(--active-bg)', border: '1px solid var(--border-color)' }}
                title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              >
                {theme === 'dark' ? (
                  <Sun size={isCollapsed ? 12 : 14} style={{ color: 'var(--text-secondary)' }} />
                ) : (
                  <Moon size={isCollapsed ? 12 : 14} style={{ color: 'var(--text-secondary)' }} />
                )}
              </button>

              {/* Real Sign Out Button */}
              {isGoogleConnected && (
                <button
                  onClick={() => signOut()}
                  className={`rounded-xl transition-all duration-200 hover:scale-105 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 ${isCollapsed ? 'p-1.5' : 'p-2.5'}`}
                  style={{ border: '1px solid var(--border-color)' }}
                  title="Đăng xuất"
                >
                  <LogOut size={isCollapsed ? 12 : 14} />
                </button>
              )}
            </div>
          </div>

          {!isGoogleConnected && !isConnecting && !isCollapsed && (
            <button 
              onClick={() => signIn('google')}
              className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2 group"
            >
               <div className="w-1.5 h-1.5 rounded-full bg-slate-600 group-hover:bg-sky-500 transition-colors" />
               KẾT NỐI TÀI KHOẢN GOOGLE
            </button>
          )}

        </div>
      </div>

      {/* Professional Diagnostic Monitor Modal */}
      {isMonitorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           {/* Backdrop Backdrop */}
           <div 
             className="absolute inset-0 backdrop-blur-md transition-colors duration-300" 
             style={{ backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }}
             onClick={() => setIsMonitorOpen(false)}
           />
           
           {/* Modal Box */}
           <div className="relative w-full max-w-[480px] rounded-[2.5rem] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300"
             style={{ backgroundColor: 'var(--sidebar-bg)', border: '1px solid var(--border-color)' }}>
              <div className="p-8 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                   <span className="text-[14px] font-black tracking-[0.2em] uppercase" style={{ color: 'var(--text-primary)' }}>CHẨN ĐOÁN HỆ THỐNG</span>
                </div>
                <button 
                  onClick={() => setIsMonitorOpen(false)}
                  className="p-2 rounded-full transition-colors hover:opacity-70"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-10 space-y-7">
                 {[
                   { name: 'Nghiên cứu Từ khóa', status: 'ĐANG XỬ LÝ', code: 'KW_72', color: 'text-indigo-500' },
                   { name: 'Viết bài AI (Content)', status: 'ĐANG CHẠY', code: 'CT_88', color: 'text-emerald-500' },
                   { name: 'Quét bản đồ (Maps)', status: 'XUNG ĐỘT', code: 'MP_Err_8000', color: 'text-rose-500' },
                   { name: 'Bộ công cụ SEO', status: '50+ TOOLS', code: 'SEO_50', color: 'text-emerald-500' },
                   { name: 'Hình ảnh AI (Image)', status: 'CHẾ ĐỘ CHỜ', code: 'IM_READY', color: 'var(--text-muted)' },
                 ].map((t) => (
                   <div key={t.name} className="flex justify-between items-center group">
                      <div className="space-y-1">
                         <h4 className="font-black uppercase tracking-wider text-[14px]" style={{ color: 'var(--text-primary)' }}>{t.name}</h4>
                         <p className="font-black uppercase tracking-[0.2em] text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.code}</p>
                      </div>
                      <div className="text-right">
                         <p className={`text-[12px] font-black uppercase ${t.color} tracking-widest`} style={t.color.startsWith('var') ? { color: t.color } : {}}>{t.status}</p>
                         <p className="text-[10px] font-black uppercase mt-1" style={{ color: 'var(--text-muted)' }}>HOẠT ĐỘNG: 99.9%</p>
                      </div>
                   </div>
                 ))}
              </div>

              <div className="p-8 space-y-4" style={{ backgroundColor: 'var(--hover-bg)', borderTop: '1px solid var(--border-color)' }}>
                 <div className="flex justify-between text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    <span>TẢI CPU HỆ THỐNG</span>
                    <span>12%</span>
                 </div>
                 <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--hover-bg)' }}>
                    <div className="h-full w-[12%]" style={{ backgroundColor: 'var(--text-secondary)' }} />
                 </div>
                 <button 
                   onClick={() => setIsMonitorOpen(false)}
                   className="w-full py-4 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] mt-4 transition-all hover:opacity-80"
                   style={{ backgroundColor: 'var(--hover-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                 >
                   QUAY LẠI TRANG CHỦ
                 </button>
              </div>
           </div>
        </div>
      )}
    </aside>
  );
}
