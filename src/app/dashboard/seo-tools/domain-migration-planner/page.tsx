"use client";

import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";

const PHASES: { phase: string; tasks: string[] }[] = [
  {
    phase: "Trước khi chuyển",
    tasks: [
      "Crawl toàn bộ site cũ (Screaming Frog/Sitebulb)",
      "Sao lưu Search Console properties + lưu CSV mapping URL",
      "Audit backlink, lập danh sách domain cần outreach",
      "Chuẩn bị URL mapping CSV (Old → New) — dùng URL Migration Mapper",
      "Cấu hình DNS TTL thấp (300s) trước 24h",
    ],
  },
  {
    phase: "Ngày chuyển",
    tasks: [
      "Cài đặt redirect 301 từ domain cũ → domain mới",
      "Cập nhật canonical, hreflang, sitemap, robots.txt",
      "Submit sitemap mới + Change of Address trong GSC",
      "Kiểm tra log redirect chain ≤ 1 hop",
    ],
  },
  {
    phase: "Sau chuyển 7 ngày",
    tasks: [
      "Theo dõi crawl stats GSC + log server",
      "Theo dõi index coverage, fix 4xx/5xx phát sinh",
      "Outreach các domain backlink quan trọng để cập nhật link",
    ],
  },
  {
    phase: "Sau 30/60/90 ngày",
    tasks: [
      "So sánh CTR / Impressions trước-sau bằng GSC CTR Trends",
      "Re-evaluate trang giảm sâu, cập nhật nội dung",
      "Ngừng giữ 410 cho URL đã không cần",
    ],
  },
];

export default function DomainMigrationPlannerPage() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  const toggle = (k: string) => setDone((d) => ({ ...d, [k]: !d[k] }));
  const total = PHASES.reduce((acc, p) => acc + p.tasks.length, 0);
  const completed = Object.values(done).filter(Boolean).length;

  return (
    <ToolShell
      title="Domain Migration Planner"
      description="Checklist toàn diện cho việc đổi domain hoặc tái cấu trúc URL. Tick để theo dõi tiến độ."
      requires={[]}
    >
      <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <div className="flex items-center justify-between text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          <span>Tiến độ tổng thể</span>
          <span className="text-cyan-400">{completed}/{total}</span>
        </div>
        <div className="mt-2 h-2 rounded-full overflow-hidden bg-cyan-900/20">
          <div className="h-full bg-cyan-500" style={{ width: `${(completed / Math.max(1, total)) * 100}%` }} />
        </div>
      </div>

      {PHASES.map((p) => (
        <div key={p.phase} className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
          <h3 className="text-sm font-black uppercase mb-2" style={{ color: "var(--text-primary)" }}>{p.phase}</h3>
          {p.tasks.map((t) => {
            const k = `${p.phase}::${t}`;
            const v = !!done[k];
            return (
              <button
                key={k}
                onClick={() => toggle(k)}
                className="flex items-start gap-3 text-left w-full text-sm hover:opacity-80"
                style={{ color: v ? "var(--text-muted)" : "var(--text-secondary)" }}
              >
                {v ? <CheckCircle2 size={18} className="text-emerald-400 mt-0.5 shrink-0" /> : <Circle size={18} className="text-cyan-400/60 mt-0.5 shrink-0" />}
                <span className={v ? "line-through" : ""}>{t}</span>
              </button>
            );
          })}
        </div>
      ))}
    </ToolShell>
  );
}
