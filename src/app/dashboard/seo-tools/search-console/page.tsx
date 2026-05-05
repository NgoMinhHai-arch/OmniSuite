"use client";

import { GscQueryShell } from "@/components/seo/GscQueryShell";

export default function SearchConsolePage() {
  return (
    <GscQueryShell
      title="GSC Downloader"
      description="Tải dữ liệu Search Console với dimension query, theo khoảng ngày tuỳ chọn."
      defaultDimensions={["query"]}
      rowLimit={5000}
      hint="Dimension mặc định: query. Có thể export CSV để xử lý tiếp ở Excel hoặc các tool khác."
    />
  );
}
