'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface TypographyProps {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'label' | 'sublabel' | 'caption';
  className?: string;
  animate?: boolean;
  delay?: number;
  style?: React.CSSProperties;
}

export function Typography({
  children,
  variant = 'body',
  className = '',
  animate = false,
  delay = 0,
  style,
}: TypographyProps) {
  const Component = animate ? motion.div : 'div';
  const animationProps = animate ? {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay: 0.1, ease: 'easeOut' } as any
  } : { initial: {}, animate: {}, transition: {} };

  const variants = {
    h1: 'text-3xl md:text-4xl font-black font-outfit text-gradient uppercase tracking-tight leading-tight mb-2',
    h2: 'text-2xl md:text-3xl font-bold font-outfit tracking-tight mb-2',
    h3: 'text-xl font-bold font-outfit tracking-tight mb-1',
    h4: 'text-base font-bold uppercase tracking-widest text-[11px] mb-1 opacity-80',
    body: 'text-sm font-medium leading-relaxed',
    label: 'text-[10px] font-black uppercase tracking-widest flex items-center gap-2 px-1',
    sublabel: 'text-[11px] font-bold leading-relaxed uppercase tracking-wider',
    caption: 'text-[9px] font-bold uppercase tracking-widest',
  };

  const Tag = (variant.startsWith('h') ? variant : 'div') as React.ElementType;

  return (
    <Component
      initial={animationProps.initial}
      animate={animationProps.animate}
      transition={animationProps.transition}
      className={`${variants[variant]} ${className}`}
      style={style}
    >
      {children}
    </Component>
  );
}

export default Typography;
