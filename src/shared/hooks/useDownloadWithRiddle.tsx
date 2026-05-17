"use client";

import { useCallback, useEffect, useState } from "react";
import { DownloadRiddleGate } from "@/shared/ui/DownloadRiddleGate";
import { registerDownloadRiddleGate } from "@/shared/utils/download-riddle-bridge";
import {
  isRiddleAnswerCorrect,
  pickRandomRiddle,
  pickWrongMessage,
  type DownloadRiddle,
} from "@/shared/utils/download-riddle-data";

export function useDownloadWithRiddle() {
  const [pendingRun, setPendingRun] = useState<(() => void) | null>(null);
  const [riddle, setRiddle] = useState<DownloadRiddle | null>(null);
  const [answer, setAnswer] = useState("");
  const [wrongMessage, setWrongMessage] = useState<string | null>(null);

  const close = useCallback(() => {
    setPendingRun(null);
    setRiddle(null);
    setAnswer("");
    setWrongMessage(null);
  }, []);

  const gateDownload = useCallback((run: () => void) => {
    setRiddle(pickRandomRiddle());
    setAnswer("");
    setWrongMessage(null);
    setPendingRun(() => run);
  }, []);

  const submit = useCallback(() => {
    if (!riddle || !pendingRun) return;
    if (!answer.trim()) return;
    if (!isRiddleAnswerCorrect(riddle, answer)) {
      setWrongMessage(pickWrongMessage());
      return;
    }
    const run = pendingRun;
    close();
    run();
  }, [answer, close, pendingRun, riddle]);

  useEffect(() => {
    registerDownloadRiddleGate(gateDownload);
    return () => registerDownloadRiddleGate(null);
  }, [gateDownload]);

  const RiddleGate = (
    <DownloadRiddleGate
      open={pendingRun !== null}
      riddle={riddle}
      answer={answer}
      wrongMessage={wrongMessage}
      onAnswerChange={(value) => {
        setAnswer(value);
        if (wrongMessage) setWrongMessage(null);
      }}
      onSubmit={submit}
      onCancel={close}
    />
  );

  return { gateDownload, RiddleGate };
}
