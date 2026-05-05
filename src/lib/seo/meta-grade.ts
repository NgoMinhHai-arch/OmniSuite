export interface MetaGradeResult {
  score: number;
  feedback: string[];
}

/**
 * Heuristic meta description scoring (no AI). Good defaults for Google snippets.
 */
export function gradeMetaDescription(
  meta: string,
  opts?: { brandHint?: string }
): MetaGradeResult {
  const m = meta.trim();
  const feedback: string[] = [];
  let score = 50;

  const len = m.length;
  if (len === 0) {
    return { score: 0, feedback: ["Meta trống — hãy viết mô tả hấp dẫn."] };
  }

  if (len < 110) {
    feedback.push("Hơi ngắn — nên khoảng 120–155 ký tự để đủ ngữ cảnh.");
    score -= 12;
  } else if (len > 165) {
    feedback.push("Hơi dài — Google có thể cắt; mục tiêu ~150–160 ký tự.");
    score -= 8;
  } else {
    score += 10;
  }

  if (/[!?]/.test(m)) {
    score += 4;
    feedback.push("Có dấu hỏi/cảm — có thể tăng CTR.");
  }

  if (/\b(bạn|mẹo|cách|tìm|mua|miễn phí|hướng dẫn|so sánh|top)\b/i.test(m)) {
    score += 6;
    feedback.push("Chứa từ gợi ý ý định — tốt cho CTR.");
  }

  const brand = opts?.brandHint?.trim();
  if (brand && m.toLowerCase().includes(brand.toLowerCase())) {
    score += 8;
    feedback.push("Có nhắc thương hiệu — giúp nhận diện trên SERP.");
  } else if (!brand && !/[|–—-]\s*\w+/.test(m)) {
    feedback.push("Cân nhắc thêm thương hiệu (ví dụ: \"… | Tên site\").");
    score -= 4;
  }

  if (/^[\s\w\u00C0-\u024F]+$/u.test(m) && !/[,:;]/.test(m) && len > 80) {
    feedback.push("Có thể chia nhỏ bằng dấu phẩy để dễ đọc hơn.");
    score -= 3;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  if (feedback.length === 0) {
    feedback.push("Meta ổn — kiểm tra lại từ khóa chính và CTA.");
  }

  return { score, feedback };
}
