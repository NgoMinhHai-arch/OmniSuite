/**
 * SEO Content Analyzer
 * Utilities for analyzing content SEO score
 */

export interface SeoAnalysisResult {
  score: number;
  categories: SeoCategory[];
  suggestions: string[];
  dimensionScores: {
    seoStructure: number;
    readability: number;
    semanticIntent: number;
    platformFit: number;
    trustSignals: number;
  };
  criticalIssues: string[];
  quickFixes: string[];
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
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
  const criticalIssues: string[] = [];
  const quickFixes: string[] = [];

  // 1. Keyword Density Analysis
  const keywordChecks: SeoCheck[] = [];
  const safeContent = content || '';
  const safePrimary = (primaryKeyword || '').trim();
  const safeSecondary = (secondaryKeywords || '').trim();
  const wordCount = safeContent.trim() ? safeContent.trim().split(/\s+/).length : 0;
  const primaryRegex = safePrimary ? new RegExp(escapeRegex(safePrimary.toLowerCase()), 'g') : null;
  const primaryCount = primaryRegex ? ((safeContent.toLowerCase().match(primaryRegex) || []).length) : 0;
  const density = wordCount > 0 ? (primaryCount / wordCount) * 100 : 0;

  if (!safePrimary) {
    keywordChecks.push({
      name: 'Từ khóa chính',
      passed: false,
      message: 'Chưa nhập từ khóa chính để chấm điểm',
      priority: 'high'
    });
    criticalIssues.push('Thiếu từ khóa chính');
    quickFixes.push('Nhập từ khóa chính rồi chạy lại phân tích.');
  } else if (density >= 1 && density <= 2.5) {
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
    quickFixes.push('Thêm từ khóa chính vào 1 H2 và đoạn mở đầu.');
  } else {
    keywordChecks.push({
      name: 'Mật độ từ khóa chính',
      passed: false,
      message: `Mật độ ${density.toFixed(1)}% quá cao (có thể bị coi là spam)`,
      priority: 'high'
    });
    suggestions.push('Giảm số lần xuất hiện của từ khóa chính để tránh keyword stuffing');
    quickFixes.push('Giảm lặp từ khóa chính, thay bằng biến thể gần nghĩa.');
  }

  // Check secondary keywords
  if (safeSecondary) {
    const secondaries = safeSecondary.split(',').map(k => k.trim()).filter(Boolean);
    const secondaryCount = secondaries.reduce((acc, kw) => {
      const kwRegex = new RegExp(escapeRegex(kw.toLowerCase()), 'g');
      return acc + (safeContent.toLowerCase().match(kwRegex) || []).length;
    }, 0);
    
    keywordChecks.push({
      name: 'Từ khóa phụ',
      passed: secondaryCount >= secondaries.length,
      message: `Đã sử dụng ${secondaryCount}/${secondaries.length} từ khóa phụ`,
      priority: 'medium'
    });

    if (secondaryCount < secondaries.length) {
      quickFixes.push('Bổ sung thêm từ khóa phụ còn thiếu vào các đoạn thân bài.');
    }
  }

  const keywordScore = keywordChecks.length > 0
    ? (keywordChecks.filter(c => c.passed).length / keywordChecks.length) * 100
    : 0;
  categories.push({
    name: 'Từ khóa',
    score: Math.round(keywordScore),
    maxScore: 25,
    checks: keywordChecks
  });

  // 2. Content Structure Analysis
  const structureChecks: SeoCheck[] = [];
  
  // Heading structure
  const h2Count = (safeContent.match(/^##\s+/gm) || []).length;
  const h3Count = (safeContent.match(/^###\s+/gm) || []).length;
  
  structureChecks.push({
    name: 'Cấu trúc tiêu đề',
    passed: h2Count >= 2,
    message: h2Count >= 2 ? `${h2Count} H2, ${h3Count} H3 - Tốt` : `Chỉ ${h2Count} H2 - Cần thêm`,
    priority: 'high'
  });

  if (h2Count < 2) {
    suggestions.push('Thêm các tiêu đề H2 để cấu trúc bài viết rõ ràng hơn');
    quickFixes.push('Tăng ít nhất 2 tiêu đề H2 để chia ý chính.');
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
    quickFixes.push('Mở rộng thêm ví dụ, số liệu hoặc mục FAQ ngắn.');
  }

  const structureScore = (structureChecks.filter(c => c.passed).length / structureChecks.length) * 100;
  categories.push({
    name: 'Cấu trúc',
    score: Math.round(structureScore),
    maxScore: 25,
    checks: structureChecks
  });

  // 3. Readability Analysis
  const readabilityChecks: SeoCheck[] = [];
  
  // Paragraph length
  const paragraphs = safeContent.split('\n\n').filter(p => p.trim().length > 0);
  const longParagraphs = paragraphs.filter(p => p.split(/\s+/).length > 100).length;
  
  readabilityChecks.push({
    name: 'Độ dài đoạn văn',
    passed: longParagraphs === 0,
    message: longParagraphs === 0 ? 'Các đoạn văn ngắn gọn, dễ đọc' : `${longParagraphs} đoạn quá dài`,
    priority: 'medium'
  });

  if (longParagraphs > 0) {
    suggestions.push('Chia nhỏ các đoạn văn dài thành nhiều đoạn ngắn hơn (dưới 100 từ/đoạn)');
    quickFixes.push('Tách đoạn >100 từ thành 2-3 đoạn ngắn.');
  }

  // Sentence length check (basic)
  const sentences = safeContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : 0;
  
  readabilityChecks.push({
    name: 'Độ dài câu',
    passed: avgSentenceLength <= 20,
    message: `Trung bình ${avgSentenceLength.toFixed(0)} từ/câu ${avgSentenceLength <= 20 ? '- Tốt' : '- Hơi dài'}`,
    priority: 'low'
  });

  const readabilityScore = (readabilityChecks.filter(c => c.passed).length / readabilityChecks.length) * 100;
  categories.push({
    name: 'Khả đọc',
    score: Math.round(readabilityScore),
    maxScore: 25,
    checks: readabilityChecks
  });

  // 4. Technical SEO
  const technicalChecks: SeoCheck[] = [];
  
  // Check for images
  const imageCount = (safeContent.match(/!\[.*?\]\(.*?\)/g) || []).length;
  technicalChecks.push({
    name: 'Hình ảnh',
    passed: imageCount > 0,
    message: imageCount > 0 ? `${imageCount} hình ảnh - Tốt` : 'Chưa có hình ảnh',
    priority: 'medium'
  });

  if (imageCount === 0) {
    suggestions.push('Thêm hình ảnh minh họa để tăng tính thẩm mỹ và SEO');
    quickFixes.push('Chèn tối thiểu 1 ảnh có alt text chứa ngữ cảnh chủ đề.');
  }

  // Check for links
  const linkCount = (safeContent.match(/\[.*?\]\(.*?\)/g) || []).length;
  technicalChecks.push({
    name: 'Liên kết',
    passed: linkCount >= 1,
    message: linkCount >= 1 ? `${linkCount} liên kết - Tốt` : 'Nên thêm liên kết nội bộ/ngoài',
    priority: 'low'
  });

  // Check for list usage
  const listCount = (safeContent.match(/^\s*[-*+]\s/mg) || []).length;
  technicalChecks.push({
    name: 'Danh sách',
    passed: listCount >= 2,
    message: listCount >= 2 ? `${listCount} mục danh sách` : 'Nên thêm danh sách để dễ đọc',
    priority: 'low'
  });

  const technicalScore = (technicalChecks.filter(c => c.passed).length / technicalChecks.length) * 100;
  categories.push({
    name: 'Kỹ thuật',
    score: Math.round(technicalScore),
    maxScore: 25,
    checks: technicalChecks
  });

  // Calculate total score
  // 5. Semantic intent + trust + platform fit
  const semanticChecks: SeoCheck[] = [];
  const intentTerms = ['cách', 'hướng dẫn', 'so sánh', 'review', 'mua', 'giá', 'tại sao'];
  const intentHits = intentTerms.filter(term => safeContent.toLowerCase().includes(term)).length;
  semanticChecks.push({
    name: 'Bao phủ intent',
    passed: intentHits >= 2,
    message: intentHits >= 2 ? `Đã bao phủ ${intentHits} tín hiệu intent` : 'Intent còn mỏng, thiên về mô tả chung',
    priority: 'medium'
  });
  const secondaryCoverage = safeSecondary
    ? safeSecondary.split(',').map(v => v.trim().toLowerCase()).filter(Boolean).filter(v => safeContent.toLowerCase().includes(v)).length
    : 0;
  semanticChecks.push({
    name: 'Bao phủ ngữ nghĩa',
    passed: !safeSecondary || secondaryCoverage >= 2,
    message: safeSecondary ? `Khớp ${secondaryCoverage} từ khóa phụ trong nội dung` : 'Không có danh sách từ khóa phụ',
    priority: 'medium'
  });
  const semanticScore = (semanticChecks.filter(c => c.passed).length / semanticChecks.length) * 100;
  categories.push({
    name: 'Ngữ nghĩa',
    score: Math.round(semanticScore),
    maxScore: 15,
    checks: semanticChecks
  });

  const trustChecks: SeoCheck[] = [];
  const hasCitationLike = /\[[^\]]+\]\((https?:\/\/[^)]+)\)/.test(safeContent);
  trustChecks.push({
    name: 'Nguồn tham chiếu',
    passed: hasCitationLike,
    message: hasCitationLike ? 'Có nguồn tham chiếu trong bài' : 'Thiếu nguồn tham chiếu trực tiếp',
    priority: 'high'
  });
  const hasConcreteData = /\d+[%.,]?\d*/.test(safeContent);
  trustChecks.push({
    name: 'Tín hiệu dữ kiện',
    passed: hasConcreteData,
    message: hasConcreteData ? 'Có số liệu/hệ đo đạc trong nội dung' : 'Nên thêm số liệu hoặc mốc cụ thể',
    priority: 'medium'
  });
  const trustScore = (trustChecks.filter(c => c.passed).length / trustChecks.length) * 100;
  categories.push({
    name: 'Tin cậy',
    score: Math.round(trustScore),
    maxScore: 10,
    checks: trustChecks
  });

  const platformChecks: SeoCheck[] = [];
  const hasHook = /^#|^##|^[A-ZÀ-Ỹ0-9]/m.test(safeContent);
  platformChecks.push({
    name: 'Hook mở bài',
    passed: hasHook,
    message: hasHook ? 'Mở bài có tín hiệu hook/heading rõ' : 'Mở bài chưa có hook đủ mạnh',
    priority: 'low'
  });
  const hasCTA = /(liên hệ|đăng ký|mua ngay|thử ngay|xem thêm|bình luận|chia sẻ)/i.test(safeContent);
  platformChecks.push({
    name: 'Kêu gọi hành động',
    passed: hasCTA,
    message: hasCTA ? 'Có CTA ở nội dung' : 'Thiếu CTA rõ cho người đọc',
    priority: 'medium'
  });
  const platformScore = (platformChecks.filter(c => c.passed).length / platformChecks.length) * 100;
  categories.push({
    name: 'Nền tảng',
    score: Math.round(platformScore),
    maxScore: 10,
    checks: platformChecks
  });

  const totalScore = Math.round(
    categories.reduce((acc, cat) => acc + (cat.score / 100) * cat.maxScore, 0)
  );

  for (const category of categories) {
    for (const check of category.checks) {
      if (!check.passed && check.priority === 'high') {
        criticalIssues.push(`${category.name}: ${check.message}`);
      }
    }
  }
  if (criticalIssues.length === 0) {
    criticalIssues.push('Không có lỗi nghiêm trọng.');
  }
  if (quickFixes.length === 0) {
    quickFixes.push('Nội dung đang ổn, có thể tối ưu thêm link nội bộ và ví dụ thực tế.');
  }

  return {
    score: clamp(totalScore),
    categories,
    suggestions: suggestions.length > 0 ? suggestions : ['Nội dung đã được tối ưu tốt cho SEO!'],
    dimensionScores: {
      seoStructure: clamp(Math.round((keywordScore * 0.5) + (structureScore * 0.5))),
      readability: clamp(Math.round(readabilityScore)),
      semanticIntent: clamp(Math.round(semanticScore)),
      platformFit: clamp(Math.round(platformScore)),
      trustSignals: clamp(Math.round(trustScore)),
    },
    criticalIssues,
    quickFixes
  };
}

/**
 * Quick SEO score calculation
 */
export function quickSeoScore(content: string, keyword: string): number {
  const result = analyzeContentSeo(content, keyword, '');
  return result.score;
}
