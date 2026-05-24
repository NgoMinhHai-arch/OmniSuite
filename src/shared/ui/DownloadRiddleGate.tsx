"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, Sparkles, X } from "lucide-react";
import type { DownloadRiddle } from "@/shared/utils/download-riddle-data";

type Props = {
  open: boolean;
  riddle: DownloadRiddle | null;
  answer: string;
  wrongMessage: string | null;
  onAnswerChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function DownloadRiddleGate({
  open,
  riddle,
  answer,
  wrongMessage,
  onAnswerChange,
  onSubmit,
  onCancel,
}: Props) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <AnimatePresence>
      {open && riddle ? (
        <motion.div
          key="download-riddle-gate"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-labelledby="download-riddle-title"
            aria-modal="true"
            className="relative w-full max-w-md rounded-3xl p-7 shadow-2xl"
            style={{
              backgroundColor: "var(--card-bg)",
              border: "1px solid rgba(6,182,212,0.22)",
            }}
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <motion.div
                className="flex items-center gap-3 min-w-0"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
              >
                <div
                  className="p-2.5 rounded-xl shrink-0"
                  style={{ backgroundColor: "rgba(6,182,212,0.12)" }}
                >
                  <Sparkles size={18} className="text-cyan-400" />
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 }}
                >
                  <p
                    id="download-riddle-title"
                    className="text-[10px] font-black uppercase tracking-widest text-cyan-400"
                  >
                    Đánh đố tải file
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    Trả lời đúng là cho tải ngay nhé!
                  </p>
                </motion.div>
              </motion.div>
              <button
                type="button"
                onClick={onCancel}
                className="p-1.5 rounded-lg transition-colors shrink-0"
                style={{ color: "var(--text-muted)" }}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <motion.p
              className="text-base font-semibold leading-relaxed mb-5"
              style={{ color: "var(--text-primary)" }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {riddle.question}
            </motion.p>

            <motion.div
              className="space-y-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
            >
              <input
                type="text"
                value={answer}
                onChange={(e) => onAnswerChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Gõ đáp án..."
                autoFocus
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-shadow"
                style={{
                  backgroundColor: "var(--hover-bg)",
                  border: "1px solid rgba(6,182,212,0.25)",
                  color: "var(--text-primary)",
                }}
              />

              {wrongMessage ? (
                <motion.p
                  className="text-xs text-amber-400/90 px-1"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  role="status"
                >
                  {wrongMessage}
                </motion.p>
              ) : null}

              <motion.div
                className="flex gap-2 pt-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.18 }}
              >
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
                  style={{
                    backgroundColor: "var(--hover-bg)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Để sau
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!answer.trim()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-40"
                  style={{
                    background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                  }}
                >
                  <Download size={15} />
                  Tải xuống
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
