'use client';

import React from 'react';

export default function GlowBackground() {
  // Get theme from document class to avoid context issues during SSR/hydration
  const [isDark, setIsDark] = React.useState(true);

  React.useEffect(() => {
    const checkTheme = () => {
      setIsDark(!document.documentElement.classList.contains('light'));
    };
    checkTheme();
    
    // Listen for class changes on documentElement
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none transition-colors duration-500"
      style={{ backgroundColor: isDark ? '#020617' : '#f1f5f9' }}
    >
      {/* Primary Glow - Top Right */}
      <div 
        className="absolute top-[-10%] right-[-5%] w-[50%] h-[60%] rounded-full blur-[120px] transition-opacity duration-500"
        style={{
          background: isDark 
            ? 'radial-gradient(circle, rgba(79, 70, 229, 0.6) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(79, 70, 229, 0.15) 0%, transparent 70%)',
          opacity: isDark ? 0.2 : 0.4
        }}
      />
      
      {/* Secondary Glow - Bottom Left */}
      <div 
        className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[50%] rounded-full blur-[100px] transition-opacity duration-500"
        style={{
          background: isDark 
            ? 'radial-gradient(circle, rgba(124, 58, 237, 0.5) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(124, 58, 237, 0.12) 0%, transparent 70%)',
          opacity: isDark ? 0.15 : 0.35
        }}
      />

      {/* Subtle Accent - Center */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full blur-[150px] transition-opacity duration-500"
        style={{
          background: isDark 
            ? 'radial-gradient(circle, rgba(30, 58, 138, 0.4) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
          opacity: isDark ? 0.1 : 0.25
        }}
      />
      
      {/* Noise Texture (Optional for premium feel) */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}
