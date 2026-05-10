'use client';

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  MapPin, 
  Image as ImageIcon, 
  BriefcaseBusiness,
  Settings,
  Key,
  Search,
  Stethoscope,
  Activity,
  X,
  Sun,
  Moon,
  LogOut,
  BarChart,
  PanelLeft,
  Sparkles,
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
      { name: 'Kiểm tra website', href: '/dashboard/seo-tools/scraper', icon: Stethoscope },
      { name: 'SEO nâng cao', href: '/dashboard/seo-tools/advanced', icon: BarChart },
      { name: 'Tìm hình ảnh', href: '/dashboard/images', icon: ImageIcon },
      { name: 'Hỗ trợ tìm việc', href: '/dashboard/job-support', icon: BriefcaseBusiness },
      { name: 'Quản gia', href: '/dashboard/ai-support', icon: Sparkles },
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
  const router = useRouter();
  /** Tránh prefetch đồng loạt mọi công cụ (làm dev/build nghẽn); chỉ prefetch khi người dùng gần chọn */
  const prefetchedHrefs = useRef<Set<string>>(new Set());

  const prefetchNavHref = useCallback(
    (href: string) => {
      if (!href || href.startsWith('#')) return;
      if (prefetchedHrefs.current.has(href)) return;
      prefetchedHrefs.current.add(href);
      router.prefetch(href);
    },
    [router],
  );
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  /** SSR/first paint = expanded; sync from localStorage after mount to avoid empty-shell flash */
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // REAL AUTH SESSION
  const { data: session, status } = useSession();
  const isGoogleConnected = status === "authenticated";
  const isConnecting = status === "loading";

  /** Sync theme + sidebar from localStorage before paint to avoid flash and layout jumps */
  useLayoutEffect(() => {
    try {
      const savedTheme = localStorage.getItem('omnisuite-theme') as 'dark' | 'light' | null;
      const initialTheme = savedTheme || 'dark';
      setTheme(initialTheme);
      document.documentElement.classList.toggle('light', initialTheme === 'light');

      const savedCollapsed = localStorage.getItem('omnisuite-sidebar-collapsed') === 'true';
      setIsCollapsed(savedCollapsed);
      document.documentElement.style.setProperty('--sidebar-width', savedCollapsed ? '80px' : '300px');
    } catch {
      document.documentElement.style.setProperty('--sidebar-width', '300px');
    }
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains('light') ? 'light' : 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  /** Other tabs / windows: keep sidebar width in sync */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'omnisuite-sidebar-collapsed' || e.storageArea !== localStorage) return;
      const collapsed = e.newValue === 'true';
      setIsCollapsed(collapsed);
      document.documentElement.style.setProperty('--sidebar-width', collapsed ? '80px' : '300px');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
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
      className="fixed left-0 top-0 z-50 flex h-screen flex-col font-inter will-change-transform"
      style={{ 
        width: 'var(--sidebar-width, 300px)',
        backgroundColor: 'var(--sidebar-bg)', 
        borderRight: '1px solid var(--border-color)',
        transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Branding Area with Toggle */}
      <div className={`flex items-center transition-[padding,height] duration-200 ease-out ${isCollapsed ? 'p-3 justify-center h-[72px]' : 'p-6 justify-between h-[88px]'}`}>
        <Link 
          href="/" 
          prefetch={false}
          className={`overflow-hidden transition-[opacity,width,max-width] duration-150 ease-out ${isCollapsed ? 'pointer-events-none w-0 max-w-0 opacity-0' : 'max-w-[280px] opacity-100'}`}
        >
          <h1 className="text-2xl font-black tracking-tighter whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
            OmniSuite <span className="text-indigo-500 drop-shadow-[0_0_12px_rgba(99,102,241,0.4)]">AI</span>
          </h1>
        </Link>
        
        {/* Collapse Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="touch-manipulation shrink-0 rounded-xl p-2 transition-colors duration-100 hover:bg-white/5"
          style={{ 
            backgroundColor: 'var(--active-bg)', 
            border: '1px solid var(--border-color)',
            transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 180ms cubic-bezier(0.4, 0, 0.2, 1), background-color 100ms ease-out'
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
                className="overflow-hidden px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-opacity duration-150"
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
                
                const itemClass = `touch-manipulation group relative flex items-center overflow-hidden rounded-xl transition-[background-color,border-color,opacity] duration-100 ease-out ${isCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'} ${
                  isActive ? 'border border-indigo-500/30' : 'hover:bg-white/5'
                }`;
                const itemStyle = { backgroundColor: isActive ? 'var(--active-bg)' : 'transparent' } as const;

                return (
                  <div
                    key={item.href}
                    className={`w-full ${isCollapsed ? 'text-center' : 'text-left'}`}
                  >
                    {isMonitor ? (
                      <button
                        type="button"
                        onClick={() => setIsMonitorOpen(true)}
                        className={`${itemClass} w-full active:scale-[0.99]`}
                        style={itemStyle}
                        title={isCollapsed ? item.name : undefined}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                        )}
                        <div className={`relative z-10 flex items-center ${isCollapsed ? 'justify-center' : 'w-full gap-3'}`}>
                          <item.icon
                            size={isCollapsed ? 22 : 20}
                            className={`shrink-0 transition-colors duration-100 ${isCollapsed ? 'mx-auto' : ''}`}
                            style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                          />
                          {!isCollapsed && (
                            <span
                              className="overflow-hidden whitespace-nowrap text-[14px] font-semibold tracking-tight transition-opacity duration-100"
                              style={{
                                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                              }}
                            >
                              {item.name}
                            </span>
                          )}
                        </div>
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        prefetch={false}
                        onPointerEnter={() => prefetchNavHref(item.href)}
                        onFocus={() => prefetchNavHref(item.href)}
                        className={`${itemClass} w-full active:scale-[0.99]`}
                        style={itemStyle}
                        title={isCollapsed ? item.name : undefined}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                        )}
                        <div className={`relative z-10 flex items-center ${isCollapsed ? 'justify-center' : 'w-full gap-3'}`}>
                          <item.icon
                            size={isCollapsed ? 22 : 20}
                            className={`shrink-0 transition-colors duration-100 ${isCollapsed ? 'mx-auto' : ''}`}
                            style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                          />
                          {!isCollapsed && (
                            <span
                              className="overflow-hidden whitespace-nowrap text-[14px] font-semibold tracking-tight transition-opacity duration-100"
                              style={{
                                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                              }}
                            >
                              {item.name}
                            </span>
                          )}
                        </div>
                      </Link>
                    )}
                  </div>
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
              <div className={`relative flex items-center justify-center overflow-hidden rounded-full border font-black text-[12px] uppercase shadow-lg transition-[width,height] duration-200 ease-out ${
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
                  <p
                    className={`text-[13px] font-black leading-none uppercase tracking-wide truncate transition-colors ${isGoogleConnected ? 'text-sky-400' : ''}`}
                    style={!isGoogleConnected ? { color: 'var(--text-primary)' } : undefined}
                  >
                     {isConnecting ? 'Đang đồng bộ...' : (session?.user?.name || 'Quản trị viên')}
                  </p>
                  {!isGoogleConnected && !isConnecting && (
                     <span className="text-[9px] font-bold mt-1.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                       HỆ THỐNG NỘI BỘ
                     </span>
                  )}
                </div>
              )}
            </div>
            
            <div className={`flex items-center gap-2 ${isCollapsed ? 'flex-col' : ''}`}>
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className={`touch-manipulation rounded-xl transition-colors duration-100 ${isCollapsed ? 'p-1.5' : 'p-2.5'} hover:bg-[color:var(--hover-bg)]`}
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
                  className={`touch-manipulation rounded-xl text-slate-500 transition-colors duration-100 hover:bg-rose-500/10 hover:text-rose-500 ${isCollapsed ? 'p-1.5' : 'p-2.5'}`}
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
              className="group flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl border py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-[background-color,color,border-color] duration-100 bg-[color:var(--hover-bg)] border-[color:var(--border-color)] text-[color:var(--text-secondary)] hover:bg-[color:var(--active-bg)] hover:text-[color:var(--text-primary)] active:scale-[0.99]"
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
                   { name: 'Tìm hình ảnh (Image)', status: 'CHẾ ĐỘ CHỜ', code: 'IM_READY', color: 'var(--text-muted)' },
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
