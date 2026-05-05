/**
 * Readability helpers. Flesch Reading Ease is calibrated for English;
 * scores for Vietnamese/other languages are indicative only.
 */

export function countSyllablesEnglish(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const vowels = w.match(/[aeiouy]+/g);
  let count = vowels ? vowels.length : 1;
  if (w.endsWith("e")) count -= 1;
  return Math.max(1, count);
}

export function analyzeEnglishText(text: string) {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z'-]/g, ""))
    .filter((w) => w.length > 0);

  const syllables = words.reduce((acc, w) => acc + countSyllablesEnglish(w), 0);
  const sentenceCount = Math.max(1, sentences.length);
  const wordCount = Math.max(1, words.length);

  const avgSentenceLen = wordCount / sentenceCount;
  const avgSyllablesPerWord = syllables / wordCount;

  const fleschReadingEase =
    206.835 - 1.015 * avgSentenceLen - 84.6 * avgSyllablesPerWord;

  const fleschKincaidGrade =
    0.39 * avgSentenceLen + 11.8 * avgSyllablesPerWord - 15.59;

  return {
    sentences: sentenceCount,
    words: wordCount,
    syllables,
    avgSentenceLen,
    avgSyllablesPerWord,
    fleschReadingEase,
    fleschKincaidGrade,
  };
}

export function interpretFlesch(score: number): string {
  if (score >= 90) return "Rất dễ (5th grade)";
  if (score >= 80) return "Dễ (6th grade)";
  if (score >= 70) return "Khá dễ (7th grade)";
  if (score >= 60) return "Chuẩn (8th–9th grade)";
  if (score >= 50) return "Khá khó (high school)";
  if (score >= 30) return "Khó (college)";
  return "Rất khó (graduate)";
}

export function simpleVietnameseStats(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { sentences: 0, words: 0, avgSentenceLen: 0, avgWordLen: 0 };
  }
  const sentences = trimmed.split(/[.!?…\n]+/).filter((s) => s.trim().length > 0);
  const words = trimmed.split(/\s+/).filter(Boolean);
  const sentenceCount = Math.max(1, sentences.length);
  const wordCount = words.length;
  const chars = words.join("").length;
  return {
    sentences: sentences.length,
    words: wordCount,
    avgSentenceLen: wordCount / sentenceCount,
    avgWordLen: wordCount ? chars / wordCount : 0,
  };
}
