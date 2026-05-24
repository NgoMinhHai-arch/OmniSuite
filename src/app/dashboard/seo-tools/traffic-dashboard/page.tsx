"use client";

import { GscQueryShell } from "@/components/seo/GscQueryShell";

export default function TrafficDashboardPage() {
  return (
    <GscQueryShell
      title="Traffic Dashboard"
      description="Chuỗi clicks/impressions theo ngày."
      defaultDimensions={["date"]}
      rowLimit={365}
    />
  );
}
