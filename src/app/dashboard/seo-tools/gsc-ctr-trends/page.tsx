"use client";

import { GscQueryShell } from "@/components/seo/GscQueryShell";

export default function GscCtrTrendsPage() {
  return (
    <GscQueryShell
      title="GSC CTR Trends"
      description="CTR theo từng ngày — phát hiện sự sụt giảm bất thường."
      defaultDimensions={["date"]}
      rowLimit={365}
    />
  );
}
