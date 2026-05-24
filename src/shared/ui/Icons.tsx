'use client';

import React from 'react';

export const OmniAIIcon = ({ size = 24, className = "", style = {} }: { size?: number, className?: string, style?: React.CSSProperties }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    style={style}
  >
    <defs>
      <linearGradient id="omni-ai-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
    <path 
      d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" 
      stroke="url(#omni-ai-grad)" 
      strokeWidth="1.5"
      strokeDasharray="4 4"
    />
    <path 
      d="M12 8V12L15 15" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
    />
    <path 
      d="M8 12H8.01M12 12H12.01M16 12H16.01" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
    />
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.2" />
  </svg>
);

export const MagicIcon = ({ size = 24, className = "", style = {} }: { size?: number, className?: string, style?: React.CSSProperties }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    style={style}
  >
    <path 
      d="M12 3L14.5 9.5L21 12L14.5 14.5L12 21L9.5 14.5L3 12L9.5 9.5L12 3Z" 
      fill="currentColor" 
      fillOpacity="0.1" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinejoin="round" 
    />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <path d="M12 7V8M12 16V17M7 12H8M16 12H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const TargetIcon = ({ size = 24, className = "", style = {} }: { size?: number, className?: string, style?: React.CSSProperties }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    style={style}
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);

export const GaugeIcon = ({ size = 24, className = "", style = {} }: { size?: number, className?: string, style?: React.CSSProperties }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    style={style}
  >
    <path d="M3.34 19a10 10 0 1 1 17.32 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 12L19 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
);
