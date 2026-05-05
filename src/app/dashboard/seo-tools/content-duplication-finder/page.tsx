"use client";

import { ArrowLeft, Construction } from "lucide-react";

export default function ToolPage() {
  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <a href="/dashboard/seo-tools" className="text-cyan-400 hover:text-cyan-300">
            <ArrowLeft size={24} />
          </a>
          <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>SEO Tool</h1>
        </div>
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <Construction size={48} className="text-cyan-400 mx-auto mb-4" />
          <h2 className="text-xl font-black mb-2" style={{ color: "var(--text-primary)" }}>Đang phát triển</h2>
          <p style={{ color: "var(--text-muted)" }}>Tính năng sắp ra mắt từ Search Solved SEO</p>
        </div>
      </div>
    </div>
  );
}
