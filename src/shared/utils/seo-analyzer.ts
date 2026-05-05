/**
 * SEO Content Analyzer
 * Utilities for analyzing content SEO score
 */

export interface SeoAnalysisResult {
  score: number;
  categories: SeoCategory[];
  suggestions: string[];
}

export interface SeoCategory {
  name: string;
  score: number;
  maxScore: number;
  checks: SeoCheck[];
}

export interface SeoCheck {
  name: string;
  passed: boolean;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Analyze content for SEO optimization
 */
export function analyzeContentSeo(
  content: string,
  primaryKeyword: string,
  secondaryKeywords: string
): SeoAnalysisResult {
  const categories: SeoCategory[] = [];
  const suggestions: string[] = [];

  // 1. Keyword Density Analysis
  const keywordChecks: SeoCheck[] = [];
  const wordCount = content.trim().split(/\s+/).length;
  const primaryCount = (content.toLowerCase().match(new RegExp(primaryKeyword.toLowerCase(), 'g')) || []).length;
  const density = wordCount > 0 ? (primaryCount / wordCount) * 100 : 0;

  if (density >= 1 && density <= 2.5) {
    keywordChecks.push({
      name: 'Mật độ từ khóa chính',
      passed: true,
      message: `Mật độ ${density.toFixed(1)}% - Tối ưu`,
      priority: 'high'
    });
  } else if (density < 1) {
    keywordChecks.push({
      name: 'Mật độ từ khóa chính',
      passed: false,
      message: `Mật độ ${density.toFixed(1)}% quá thấp (khuyến nghị 1-2.5%)`,
      priority: 'high'
    });
    suggestions.push('Tăng số lần xuất hiện của từ khóa chính trong bài viết');
  } else {
    keywordChecks.push({
      name: 'Mật độ từ khóa chính',
      passed: false,
      message: `Mật độ ${density.toFixed(1)}% quá cao (có thể bị coi là spam)`,
      priority: 'high'
    });
    suggestions.push('Giảm số lần xuất hiện của từ khóa chính để tránh keyword stuffing');
  }

  // Check secondary keywords
  if (secondaryKeywords) {
    const secondaries = secondaryKeywords.split(',').map(k => k.trim()).filter(Boolean);
    const secondaryCount = secondaries.reduce((acc, kw) => {
      return acc + (content.toLowerCase().match(new RegExp(kw.toLowerCase(), 'g')) || []).length;
    }, 0);
    
    keywordChecks.push({
      name: 'Từ khóa phụ',
      passed: secondaryCount >= secondaries.length,
      message: `Đã sử dụng ${secondaryCount}/${secondaries.length} từ khóa phụ`,
      priority: 'medium'
    });
  }

  const keywordScore = keywordChecks.filter(c => c.passed).length / keywordChecks.length * 100;
  categories.push({
    name: 'Từ khóa',
    score: Math.round(keywordScore),
    maxScore: 25,
    checks: keywordChecks
  });

  // 2. Content Structure Analysis
  const structureChecks: SeoCheck[] = [];
  
  // Heading structure
  const h2Count = (content.match(/##\s/g) || []).length;
  const h3Count = (content.match(/###\s/g) || []).length;
  
  structureChecks.push({
    name: 'Cấu trúc tiêu đề',
    passed: h2Count >= 2,
    message: h2Count >= 2 ? `${h2Count} H2, ${h3Count} H3 - Tốt` : `Chỉ ${h2Count} H2 - Cần thêm`,
    priority: 'high'
  });

  if (h2Count < 2) {
    suggestions.push('Thêm các tiêu đề H2 để cấu trúc bài viết rõ ràng hơn');
  }

  // Word count
  structureChecks.push({
    name: 'Độ dài nội dung',
    passed: wordCount >= 300,
    message: `${wordCount} từ ${wordCount >= 500 ? '- Rất tốt' : wordCount >= 300 ? '- Tốt' : '- Cần thêm'}`,
    priority: 'medium'
  });

  if (wordCount < 300) {
    suggestions.push('Bài viết nên có ít nhất 300-500 từ để đạt chuẩn SEO');
  }

  const structureScore = structureChecks.filter(c => c.passed).length / structureChecks.length * 100;
  categories.push({
    name: 'Cấu trúc',
    score: Math.round(structureScore),
    maxScore: 25,
    checks: structureChecks
  });

  // 3. Readability Analysis
  const readabilityChecks: SeoCheck[] = [];
  
  // Paragraph length
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
  const longParagraphs = paragraphs.filter(p => p.split(/\s+/).length > 100).length;
  
  readabilityChecks.push({
    name: 'Độ dài đoạn văn',
    passed: longParagraphs === 0,
    message: longParagraphs === 0 ? 'Các đoạn văn ngắn gọn, dễ đọc' : `${longParagraphs} đoạn quá dài`,
    priority: 'medium'
  });

  if (longParagraphs > 0) {
    suggestions.push('Chia nhỏ các đoạn văn dài thành nhiều đoạn ngắn hơn (dưới 100 từ/đoạn)');
  }

  // Sentence length check (basic)
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : 0;
  
  readabilityChecks.push({
    name: 'Độ dài câu',
    passed: avgSentenceLength <= 20,
    message: `Trung bình ${avgSentenceLength.toFixed(0)} từ/câu ${avgSentenceLength <= 20 ? '- Tốt' : '- Hơi dài'}`,
    priority: 'low'
  });

  const readabilityScore = readabilityChecks.filter(c => c.passed).length / readabilityChecks.length * 100;
  categories.push({
    name: 'Khả đọc',
    score: Math.round(readabilityScore),
    maxScore: 25,
    checks: readabilityChecks
  });

  // 4. Technical SEO
  const technicalChecks: SeoCheck[] = [];
  
  // Check for images
  const imageCount = (content.match(/!\[.*?\]\(.*?\)/g) || []).length;
  technicalChecks.push({
    name: 'Hình ảnh',
    passed: imageCount > 0,
    message: imageCount > 0 ? `${imageCount} hình ảnh - Tốt` : 'Chưa có hình ảnh',
    priority: 'medium'
  });

  if (imageCount === 0) {
    suggestions.push('Thêm hình ảnh minh họa để tăng tính thẩm mỹ và SEO');
  }

  // Check for links
  const linkCount = (content.match(/\[.*?\]\(.*?\)/g) || []).length;
  technicalChecks.push({
    name: 'Liên kết',
    passed: linkCount >= 1,
    message: linkCount >= 1 ? `${linkCount} liên kết - Tốt` : 'Nên thêm liên kết nội bộ/ngoài',
    priority: 'low'
  });

  // Check for list usage
  const listCount = (content.match(/^\s*[-*+]\s/mg) || []).length;
  technicalChecks.push({
    name: 'Danh sách',
    passed: listCount >= 2,
    message: listCount >= 2 ? `${listCount} mục danh sách` : 'Nên thêm danh sách để dễ đọc',
    priority: 'low'
  });

  const technicalScore = technicalChecks.filter(c => c.passed).length / technicalChecks.length * 100;
  categories.push({
    name: 'Kỹ thuật',
    score: Math.round(technicalScore),
    maxScore: 25,
    checks: technicalChecks
  });

  // Calculate total score
  const totalScore = Math.round(
    categories.reduce((acc, cat) => acc + (cat.score / 100) * cat.maxScore, 0)
  );

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    categories,
    suggestions: suggestions.length > 0 ? suggestions : ['Nội dung đã được tối ưu tốt cho SEO!']
  };
}

/**
 * Quick SEO score calculation
 */
export function quickSeoScore(content: string, keyword: string): number {
  const result = analyzeContentSeo(content, keyword, '');
  return result.score;
}
