"use client";

import { useState } from "react";
import { ArrowLeft, Construction, Sparkles } from "lucide-react";

export default function ToolPage() {
  const [activeTab, setActiveTab] = useState<"input" | "settings" | "results">("input");

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <a href="/dashboard/seo-tools" className="text-cyan-400 hover:text-cyan-300 transition-colors">
            <ArrowLeft size={24} />
          </a>
          <div>
            <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
              SEO Tool
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Powered by Lee Foot SEO
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 rounded-xl" style={{ backgroundColor: "var(--hover-bg)" }}>
          {["input", "settings", "results"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab
                  ? "bg-cyan-500 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mx-auto mb-6">
            <Construction size={40} className="text-white" />
          </div>
          <h2 className="text-2xl font-black mb-3" style={{ color: "var(--text-primary)" }}>
            Đang phát triển
          </h2>
          <p className="text-sm max-w-md mx-auto mb-6" style={{ color: "var(--text-muted)" }}>
            Tính năng này đang được xây dựng dựa trên công cụ từ Search Solved Public SEO repository.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <Sparkles size={16} className="text-cyan-400" />
            <span>Sẽ sớm ra mắt với đầy đủ chức năng</span>
          </div>
        </div>
      </div>
    </div>
  );
}
