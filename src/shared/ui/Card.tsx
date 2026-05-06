'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  animate?: boolean;
  delay?: number;
  style?: React.CSSProperties;
}

export function Card({
  children,
  className = '',
  noPadding = false,
  animate = true,
  delay = 0,
  style,
}: CardProps) {
  const Component = animate ? motion.div : 'div';
  
  const animationProps = animate
    ? {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.18,
          delay,
          ease: [0.25, 0.46, 0.45, 0.94],
        },
      }
    : {};

  return (
    <Component
      {...animationProps}
      className={`
        glass-card overflow-hidden relative group/card
        ${noPadding ? '' : 'p-8'}
        ${className}
      `}
      style={style}
    >
      {/* Subtle Inner Glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover/card:opacity-100" />
      
      {/* Content Rendering */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
      
      {/* Subtle Corner Accents */}
      <div className="pointer-events-none absolute bottom-4 right-4 h-12 w-12 rounded-full bg-indigo-500/5 blur-2xl transition-colors duration-300 group-hover/card:bg-indigo-500/10" />
    </Component>
  );
}

export default Card;
