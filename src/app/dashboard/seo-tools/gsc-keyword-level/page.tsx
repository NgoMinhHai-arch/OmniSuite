"use client";

import { GscQueryShell } from "@/components/seo/GscQueryShell";

export default function GscKeywordLevelPage() {
  return (
    <GscQueryShell
      title="GSC Keyword Level"
      description="Top keyword theo clicks/impressions/ctr/position."
      defaultDimensions={["query"]}
      rowLimit={1000}
      transform={(rows) => rows.sort((a, b) => (b.clicks || 0) - (a.clicks || 0))}
    />
  );
}
