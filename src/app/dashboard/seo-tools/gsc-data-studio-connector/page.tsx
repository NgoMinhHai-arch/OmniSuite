"use client";

import { ExternalLink, Workflow } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";

export default function GscDataStudioConnectorPage() {
  return (
    <ToolShell
      title="GSC → Looker Studio Connector"
      description="Hướng dẫn từng bước nối GSC với Looker Studio (Data Studio). OmniSuite cũng tự export được CSV bằng GSC Downloader."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <h3 className="text-sm font-black uppercase flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Workflow size={16} className="text-cyan-400" /> 4 bước
        </h3>
        <ol className="list-decimal pl-5 space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <li>Mở <a className="text-cyan-400 underline inline-flex items-center gap-1" href="https://lookerstudio.google.com" target="_blank" rel="noreferrer">Looker Studio <ExternalLink size={10} /></a> và tạo Data source mới.</li>
          <li>Chọn connector <b>Search Console</b> chính chủ.</li>
          <li>Chọn property GSC tương ứng + chọn <b>Site impression</b> hoặc <b>URL impression</b> tuỳ mục đích.</li>
          <li>Tạo report và kéo trường vào: <i>Date, Query, Page, Country, Device, Clicks, Impressions, CTR, Avg Position.</i></li>
        </ol>
      </div>
      <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(16,185,129,0.25)" }}>
        <p className="text-sm font-bold text-emerald-400">Mẹo nhanh từ OmniSuite</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          Bạn có thể dùng <a href="/dashboard/seo-tools/search-console" className="text-cyan-400 underline">GSC Downloader</a> trong OmniSuite để xuất CSV và import trực tiếp vào Looker Studio nếu cần dataset offline / version-controlled.
        </p>
      </div>
    </ToolShell>
  );
}
