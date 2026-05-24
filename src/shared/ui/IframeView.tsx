'use client';

import React from 'react';

interface IframeViewProps {
  url: string;
  title: string;
}

export default function IframeView({ url, title }: IframeViewProps) {
  return (
    <div className="w-full h-[calc(100vh-80px)] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <span className="text-sm font-medium text-slate-400 ml-2">{title}</span>
        </div>
        <div className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700/50">
          Running on {url}
        </div>
      </div>
      <iframe 
        src={url} 
        title={title}
        className="w-full h-full border-none bg-white"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
      />
    </div>
  );
}
