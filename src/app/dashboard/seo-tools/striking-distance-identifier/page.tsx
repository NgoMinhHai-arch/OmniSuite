"use client";

import { GscQueryShell } from "@/components/seo/GscQueryShell";

export default function StrikingDistancePage() {
  return (
    <GscQueryShell
      title="Striking Distance Identifier"
      description="Lọc query đang xếp hạng vị trí 4–20 với impressions ≥ 100 — dễ đẩy lên top 3."
      defaultDimensions={["query", "page"]}
      rowLimit={2000}
      transform={(rows) =>
        rows
          .filter((r) => (r.position || 0) >= 4 && (r.position || 0) <= 20 && (r.impressions || 0) >= 100)
          .sort((a, b) => (a.position || 0) - (b.position || 0))
      }
    />
  );
}
