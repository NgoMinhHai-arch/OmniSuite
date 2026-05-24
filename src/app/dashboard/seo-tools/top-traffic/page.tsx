"use client";

import { GscQueryShell } from "@/components/seo/GscQueryShell";

export default function TopTrafficPage() {
  return (
    <GscQueryShell
      title="Top Traffic Pages"
      description="Trang nhận nhiều click nhất theo GSC."
      defaultDimensions={["page"]}
      rowLimit={500}
      transform={(rows) => rows.sort((a, b) => (b.clicks || 0) - (a.clicks || 0))}
    />
  );
}
