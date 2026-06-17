"use client";

import { useCallback, useState } from "react";
import type { BulkContentJobStatus } from "@/shared/contracts/content-engine";
import { DEFAULT_PYTHON_ENGINE_URL } from "@/shared/lib/python-engine-url";

export function useContentJobs(
  onNotify: (message: string, type?: "success" | "error") => void,
  onBulkComplete?: (data: BulkContentJobStatus) => void,
) {
  const [bulkJob, setBulkJob] = useState<BulkContentJobStatus | null>(null);

  const explainFetchFailure = useCallback((err: unknown): Error => {
    if (err instanceof TypeError) {
      const message = err.message || "";
      if (message === "Failed to fetch" || /failed to fetch|networkerror|load failed/i.test(message)) {
        return new Error(
          `KhÃ´ng káº¿t ná»‘i Ä‘Æ°á»£c mÃ¡y chá»§ (Failed to fetch). Kiá»ƒm tra: (1) Next.js Ä‘ang cháº¡y, (2) Python Content Engine Ä‘Ã£ báº­t trÃªn cá»•ng trong PYTHON_ENGINE_URL (máº·c Ä‘á»‹nh ${DEFAULT_PYTHON_ENGINE_URL}), (3) tÆ°á»ng lá»­a/proxy khÃ´ng cháº·n localhost.`,
        );
      }
    }
    if (err instanceof Error) return err;
    return new Error("Lá»—i máº¡ng khÃ´ng xÃ¡c Ä‘á»‹nh.");
  }, []);

  const fetchJsonOrThrow = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      let resp: Response;
      try {
        resp = await fetch(input, init);
      } catch (error) {
        throw explainFetchFailure(error);
      }
      let data: Record<string, unknown>;
      try {
        data = (await resp.json()) as Record<string, unknown>;
      } catch {
        const txt = await resp.text().catch(() => "");
        throw new Error(
          resp.ok ? `Pháº£n há»“i khÃ´ng pháº£i JSON: ${txt.slice(0, 160)}` : `HTTP ${resp.status}: ${txt.slice(0, 240)}`,
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
          } catch (error) {
            throw explainFetchFailure(error);
          }
          const data = await resp.json();
          if (!resp.ok) throw new Error(String(data.error || "KhÃ´ng thá»ƒ Ä‘á»c tráº¡ng thÃ¡i job"));
          setBulkJob(data);
          if (data.status === "completed" || data.status === "failed" || data.status === "cancelled") {
            clearInterval(interval);
            setLoading(false);
            if (data.status === "completed") {
              onBulkComplete?.(data as BulkContentJobStatus);
              onNotify(`Bulk hoÃ n táº¥t: ${data.results?.length || 0} bÃ i`, "success");
            } else if (data.status === "failed") {
              onNotify(String(data.error || "Bulk job tháº¥t báº¡i"), "error");
            } else {
              onNotify("ÄÃ£ há»§y bulk job", "error");
            }
          }
        } catch (error: unknown) {
          clearInterval(interval);
          setLoading(false);
          const message = error instanceof Error ? error.message : "Lá»—i polling bulk job";
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
