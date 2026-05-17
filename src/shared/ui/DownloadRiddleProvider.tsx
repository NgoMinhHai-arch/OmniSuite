"use client";

import { useDownloadWithRiddle } from "@/shared/hooks/useDownloadWithRiddle";

export function DownloadRiddleProvider({ children }: { children: React.ReactNode }) {
  const { RiddleGate } = useDownloadWithRiddle();
  return (
    <>
      {children}
      {RiddleGate}
    </>
  );
}
