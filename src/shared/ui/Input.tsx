'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: LucideIcon;
  onEnter?: () => void;
  className?: string;
}

export function Input({
  label,
  icon: Icon,
  onEnter,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className={`space-y-2 w-full ${className}`}>
      {label && (
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
          {label}
        </label>
      )}
      <div className="relative group">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
            <Icon size={18} />
          </div>
        )}
        <input
          className={`
            w-full bg-slate-900/50 border border-white/5 rounded-xl
            text-white placeholder:text-slate-600 text-sm font-medium
            transition-all duration-300
            focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 focus:bg-slate-900/80
            group-hover:border-white/10
            ${Icon ? 'pl-12 pr-4' : 'px-4'}
            py-3.5
          `}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEnter) {
              onEnter();
            }
          }}
          {...props}
        />
      </div>
    </div>
  );
}

export default Input;
