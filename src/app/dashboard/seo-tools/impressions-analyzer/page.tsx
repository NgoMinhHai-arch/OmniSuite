"use client";

import { GscQueryShell } from "@/components/seo/GscQueryShell";

export default function ImpressionsAnalyzerPage() {
  return (
    <GscQueryShell
      title="Impressions Analyzer"
      description="Trang/keyword có nhiều impressions nhưng CTR thấp → cơ hội tối ưu title/meta."
      defaultDimensions={["query", "page"]}
      rowLimit={2000}
      transform={(rows) =>
        rows
          .filter((r) => (r.impressions || 0) > 100 && (r.ctr || 0) < 0.05)
          .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
      }
    />
  );
}
