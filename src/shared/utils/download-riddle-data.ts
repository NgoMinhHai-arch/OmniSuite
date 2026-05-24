export type DownloadRiddle = {
  question: string;
  answers: string[];
};

export const DOWNLOAD_RIDDLES: DownloadRiddle[] = [
  {
    question: "Con gì đi mà không chạm đất?",
    answers: ["chim", "con chim"],
  },
  {
    question: "Càng lớn càng nhỏ — đó là cái gì?",
    answers: ["nến"],
  },
  {
    question: "Mẹ có con Đủ, Tư, Ba — con thứ tư tên gì?",
    answers: ["em", "là em"],
  },
  {
    question: "Có cổ mà không có đầu?",
    answers: ["chai", "cái chai"],
  },
  {
    question: "Cửa nào ai cũng đi qua mỗi ngày?",
    answers: ["miệng"],
  },
];

export const WRONG_ANSWER_MESSAGES = [
  "Hmm, chưa đúng đâu — thử lại xem! 😉",
  "Sai rồi nha, não đang ngủ à? ☕",
  "Gần đúng rồi… nhưng chưa phải đáp án đâu!",
  "Đố vui mà, đừng đố khó quá — gõ lại thử!",
];

/** Case-insensitive; strips Vietnamese diacritics and extra spaces. */
export function normalizeRiddleAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
}

export function pickRandomRiddle(): DownloadRiddle {
  return DOWNLOAD_RIDDLES[Math.floor(Math.random() * DOWNLOAD_RIDDLES.length)]!;
}

export function pickWrongMessage(): string {
  return WRONG_ANSWER_MESSAGES[Math.floor(Math.random() * WRONG_ANSWER_MESSAGES.length)]!;
}

export function isRiddleAnswerCorrect(riddle: DownloadRiddle, raw: string): boolean {
  const normalized = normalizeRiddleAnswer(raw);
  return riddle.answers.some((a) => normalizeRiddleAnswer(a) === normalized);
}
