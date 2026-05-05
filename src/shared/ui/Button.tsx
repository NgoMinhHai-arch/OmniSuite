'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  fullWidth = false,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-all duration-200 rounded-xl active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none gap-2';
  
  const variants = {
    primary: 'bg-gradient-to-r from-indigo-600 to-violet-700 text-white shadow-[0_10px_20px_rgba(79,70,229,0.3)] hover:shadow-[0_15px_30px_rgba(79,70,229,0.4)] border border-white/10',
    secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-white/5',
    outline: 'bg-transparent border border-white/10 hover:bg-white/5 text-slate-300 hover:text-white',
    ghost: 'bg-transparent hover:bg-white/5 text-slate-400 hover:text-white border-none',
    danger: 'bg-rose-600/10 text-rose-500 border border-rose-500/20 hover:bg-rose-600 hover:text-white shadow-none',
    success: 'bg-emerald-600 to-green-700 text-white shadow-[0_10px_20px_rgba(16,185,129,0.2)] hover:shadow-[0_15px_30px_rgba(16,185,129,0.3)] border border-white/10',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-6 py-3 text-sm',
    lg: 'px-10 py-4 text-base',
    xl: 'px-16 h-[64px] text-base uppercase tracking-widest',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={isLoading || disabled}
      {...(props as any)}
    >
      {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : leftIcon}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </motion.button>
  );
}

export default Button;
