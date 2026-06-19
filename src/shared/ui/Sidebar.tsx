'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  BarChart,
  FileText,
  Image as ImageIcon,
  Key,
  LayoutDashboard,
  LogOut,
  MapPin,
  Moon,
  PanelLeft,
  Search,
  Settings,
  Sparkles,
  Stethoscope,
  Sun,
} from 'lucide-react';
import { signIn, signOut, useSession } from 'next-auth/react';

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: 'TỔNG QUAN',
    items: [{ name: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard }],
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
      { name: 'Quản gia', href: '/dashboard/ai-support', icon: Sparkles },
    ],
  },
  {
    title: 'HỆ THỐNG',
    items: [
      { name: 'Trạng thái hệ thống', href: '/dashboard/system', icon: Activity },
      { name: 'Cấu hình hệ thống', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

const allNavItems = navGroups.flatMap((group) => group.items);

function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/dashboard') return pathname === href;
  const exact = pathname === href;
  const child = pathname.startsWith(`${href}/`);
  const longerSpecificMatch = allNavItems.some(
    (item) => item.href !== href && item.href.startsWith(`${href}/`) && pathname.startsWith(item.href),
  );
  return (exact || child) && !longerSpecificMatch;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const prefetchedHrefs = useRef<Set<string>>(new Set());
  const { data: session, status } = useSession();

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [runnerEnabled, setRunnerEnabled] = useState(false);

  const isGoogleConnected = status === 'authenticated';
  const isConnecting = status === 'loading';

  const prefetchNavHref = useCallback(
    (href: string) => {
      if (!href || href.startsWith('#')) return;
      if (prefetchedHrefs.current.has(href)) return;
      prefetchedHrefs.current.add(href);
      router.prefetch(href);
    },
    [router],
  );

  useEffect(() => {
    fetch('/api/system/runner')
      .then((res) => res.json())
      .then((data) => setRunnerEnabled(!!data.enabled))
      .catch(() => {});
  }, []);

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

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'omnisuite-sidebar-collapsed' || event.storageArea !== localStorage) return;
      const collapsed = event.newValue === 'true';
      setIsCollapsed(collapsed);
      document.documentElement.style.setProperty('--sidebar-width', collapsed ? '80px' : '300px');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('omnisuite-theme', nextTheme);
    document.documentElement.classList.toggle('light', nextTheme === 'light');
  };

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('omnisuite-sidebar-collapsed', String(nextState));
    document.documentElement.style.setProperty('--sidebar-width', nextState ? '80px' : '300px');
  };

  const toggleRunner = async () => {
    try {
      const nextState = !runnerEnabled;
      const res = await fetch('/api/system/runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      });
      if (res.ok) setRunnerEnabled(nextState);
    } catch {
      /* ignore */
    }
  };

  const userInitial = useMemo(() => {
    const name = session?.user?.name || session?.user?.email || 'AD';
    return name.slice(0, 1).toUpperCase();
  }, [session?.user?.email, session?.user?.name]);

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
      <div className={`flex items-center transition-[padding,height] duration-200 ease-out ${isCollapsed ? 'h-[72px] justify-center p-3' : 'h-[88px] justify-between p-6'}`}>
        <Link
          href="/"
          prefetch={false}
          className={`overflow-hidden transition-[opacity,width,max-width] duration-150 ease-out ${isCollapsed ? 'pointer-events-none w-0 max-w-0 opacity-0' : 'max-w-[280px] opacity-100'}`}
        >
          <h1 className="whitespace-nowrap text-2xl font-black tracking-tighter" style={{ color: 'var(--text-primary)' }}>
            OmniSuite <span className="text-indigo-500 drop-shadow-[0_0_12px_rgba(99,102,241,0.4)]">AI</span>
          </h1>
        </Link>

        <button
          type="button"
          onClick={toggleSidebar}
          className="shrink-0 touch-manipulation rounded-xl p-2 transition-colors duration-100 hover:bg-white/5"
          style={{
            backgroundColor: 'var(--active-bg)',
            border: '1px solid var(--border-color)',
            transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 180ms cubic-bezier(0.4, 0, 0.2, 1), background-color 100ms ease-out',
          }}
          title={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          <PanelLeft size={18} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      <nav className={`no-scrollbar flex-1 space-y-1 overflow-y-auto py-4 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!isCollapsed && (
              <div className="overflow-hidden px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-opacity duration-150" style={{ color: 'var(--text-muted)' }}>
                {group.title}
              </div>
            )}

            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onPointerEnter={() => prefetchNavHref(item.href)}
                    onFocus={() => prefetchNavHref(item.href)}
                    title={isCollapsed ? item.name : undefined}
                    className={`group relative flex touch-manipulation items-center overflow-hidden rounded-xl transition-[background-color,border-color,opacity] duration-100 ease-out active:scale-[0.99] ${isCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'} ${active ? 'border border-indigo-500/30' : 'hover:bg-white/5'}`}
                    style={{ backgroundColor: active ? 'var(--active-bg)' : 'transparent' }}
                  >
                    {active && <div className="absolute bottom-1/4 left-0 top-1/4 w-1 rounded-r-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />}
                    <div className={`relative z-10 flex items-center ${isCollapsed ? 'justify-center' : 'w-full gap-3'}`}>
                      <Icon
                        size={isCollapsed ? 22 : 20}
                        className={`shrink-0 transition-colors duration-100 ${isCollapsed ? 'mx-auto' : ''}`}
                        style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                      />
                      {!isCollapsed && (
                        <span
                          className="overflow-hidden whitespace-nowrap text-[14px] font-semibold tracking-tight transition-opacity duration-100"
                          style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                        >
                          {item.name}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t transition-opacity duration-200" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
        {isCollapsed ? (
          <div className="flex justify-center py-4">
            <button
              type="button"
              onClick={toggleRunner}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all"
              style={{
                backgroundColor: runnerEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                borderColor: runnerEnabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)',
              }}
              title={runnerEnabled ? 'AI Runner: ĐANG BẬT' : 'AI Runner: ĐANG TẮT'}
            >
              <div className={`h-2.5 w-2.5 rounded-full ${runnerEnabled ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`} />
            </button>
          </div>
        ) : (
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${runnerEnabled ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'}`} />
                <div className="flex min-w-0 flex-col">
                  <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>AI Runner</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    {runnerEnabled ? 'Đang kích hoạt' : 'Đã tạm tắt'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleRunner}
                className="relative h-5 w-9 rounded-full transition-colors focus:outline-none"
                style={{ backgroundColor: runnerEnabled ? '#6366f1' : 'var(--active-bg)', border: '1px solid var(--border-color)' }}
                title={runnerEnabled ? 'Tắt AI Runner' : 'Bật AI Runner'}
              >
                <div
                  className="absolute top-[2px] h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
                  style={{ left: '2px', transform: runnerEnabled ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`${isCollapsed ? 'p-3' : 'p-6'}`} style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
        <div className={`flex items-center gap-3 ${isCollapsed ? 'flex-col' : 'justify-between'}`}>
          <div className={`flex min-w-0 items-center gap-3 overflow-hidden ${isCollapsed ? 'flex-col' : ''}`}>
            <div
              className={`flex items-center justify-center overflow-hidden rounded-full border bg-gradient-to-br from-indigo-600 to-violet-600 font-black uppercase text-white shadow-lg ${isCollapsed ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 shrink-0 text-[12px]'}`}
              style={{ borderColor: 'rgba(255,255,255,0.12)' }}
            >
              {isConnecting ? <Activity size={isCollapsed ? 12 : 16} className="animate-spin" /> : userInitial}
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-[13px] font-black uppercase leading-none tracking-wide" style={{ color: 'var(--text-primary)' }}>
                  {isConnecting ? 'Đang đồng bộ...' : session?.user?.name || 'Quản trị viên'}
                </p>
                <span className="mt-1.5 block text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  {isGoogleConnected ? 'ĐÃ KẾT NỐI GOOGLE' : 'HỆ THỐNG NỘI BỘ'}
                </span>
              </div>
            )}
          </div>

          <div className={`flex items-center gap-2 ${isCollapsed ? 'flex-col' : ''}`}>
            <button
              type="button"
              onClick={toggleTheme}
              className={`touch-manipulation rounded-xl transition-colors duration-100 hover:bg-[color:var(--hover-bg)] ${isCollapsed ? 'p-1.5' : 'p-2.5'}`}
              style={{ backgroundColor: 'var(--active-bg)', border: '1px solid var(--border-color)' }}
              title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            >
              {theme === 'dark' ? <Sun size={isCollapsed ? 12 : 14} style={{ color: 'var(--text-secondary)' }} /> : <Moon size={isCollapsed ? 12 : 14} style={{ color: 'var(--text-secondary)' }} />}
            </button>

            {isGoogleConnected ? (
              <button
                type="button"
                onClick={() => signOut()}
                className={`touch-manipulation rounded-xl text-slate-500 transition-colors duration-100 hover:bg-rose-500/10 hover:text-rose-500 ${isCollapsed ? 'p-1.5' : 'p-2.5'}`}
                style={{ border: '1px solid var(--border-color)' }}
                title="Đăng xuất"
              >
                <LogOut size={isCollapsed ? 12 : 14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => signIn('google')}
                className={`touch-manipulation rounded-xl transition-colors duration-100 hover:bg-[color:var(--active-bg)] ${isCollapsed ? 'p-1.5' : 'px-3 py-2 text-[10px] font-black uppercase tracking-widest'}`}
                style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                title="Kết nối Google"
              >
                {isCollapsed ? <Key size={12} /> : 'Kết nối Google'}
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
