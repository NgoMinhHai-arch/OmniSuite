'use client';

import React from 'react';
import { motion, Transition } from 'framer-motion';

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
  
  const animationProps = animate ? {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { 
      duration: 0.5, 
      delay
    }
  } : {};

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
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-700" />
      
      {/* Content Rendering */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
      
      {/* Subtle Corner Accents */}
      <div className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-indigo-500/5 blur-2xl pointer-events-none group-hover/card:bg-indigo-500/10 transition-colors duration-700" />
    </Component>
  );
}

export default Card;
