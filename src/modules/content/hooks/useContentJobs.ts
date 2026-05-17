"use client";

import { useCallback, useState } from "react";
import type { BulkContentJobStatus } from "@/shared/contracts/content-engine";

export function useContentJobs(
  onNotify: (message: string, type?: "success" | "error") => void,
  onBulkComplete?: (data: BulkContentJobStatus) => void,
) {
  const [bulkJob, setBulkJob] = useState<BulkContentJobStatus | null>(null);

  const explainFetchFailure = useCallback((err: unknown): Error => {
    if (err instanceof TypeError) {
      const m = err.message || "";
      if (m === "Failed to fetch" || /failed to fetch|networkerror|load failed/i.test(m)) {
        return new Error(
          "Không kết nối được máy chủ (Failed to fetch). Kiểm tra: (1) Next.js đang chạy, (2) Python Content Engine đã bật trên cổng trong PYTHON_ENGINE_URL (mặc định http://127.0.0.1:8082), (3) tường lửa/proxy không chặn localhost.",
        );
      }
    }
    if (err instanceof Error) return err;
    return new Error("Lỗi mạng không xác định.");
  }, []);

  const fetchJsonOrThrow = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      let resp: Response;
      try {
        resp = await fetch(input, init);
      } catch (e) {
        throw explainFetchFailure(e);
      }
      let data: Record<string, unknown>;
      try {
        data = (await resp.json()) as Record<string, unknown>;
      } catch {
        const txt = await resp.text().catch(() => "");
        throw new Error(
          resp.ok ? `Phản hồi không phải JSON: ${txt.slice(0, 160)}` : `HTTP ${resp.status}: ${txt.slice(0, 240)}`,
        );
      }
      return { resp, data };
    },
    [explainFetchFailure],
  );

  const pollBulkJob = useCallback(
    (jobId: string, setLoading: (v: boolean) => void) => {
      const interval = setInterval(async () => {
        try {
          let resp: Response;
          try {
            resp = await fetch(`/api/content-jobs/${jobId}`);
          } catch (netErr) {
            throw explainFetchFailure(netErr);
          }
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || "Không thể đọc trạng thái job");
          setBulkJob(data);
          if (data.status === "completed" || data.status === "failed" || data.status === "cancelled") {
            clearInterval(interval);
            setLoading(false);
            if (data.status === "completed") {
              onBulkComplete?.(data as BulkContentJobStatus);
              onNotify(`Bulk hoàn tất: ${data.results?.length || 0} bài`, "success");
            } else if (data.status === "failed") {
              onNotify(data.error || "Bulk job thất bại", "error");
            } else {
              onNotify("Đã hủy bulk job", "error");
            }
          }
        } catch (err: unknown) {
          clearInterval(interval);
          setLoading(false);
          const message = err instanceof Error ? err.message : "Lỗi polling bulk job";
          onNotify(message, "error");
        }
      }, 2200);
    },
    [explainFetchFailure, onBulkComplete, onNotify],
  );

  return {
    bulkJob,
    setBulkJob,
    pollBulkJob,
    fetchJsonOrThrow,
    explainFetchFailure,
  } as const;
}
