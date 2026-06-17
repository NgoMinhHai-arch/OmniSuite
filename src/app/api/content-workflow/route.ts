import { NextResponse } from 'next/server';
import { requestWorkflow } from '@/shared/lib/content-engine-client';
import { analyzeContentSeo } from '@/shared/utils/seo-analyzer';
import type { ContentWorkflowRequest, WorkflowImageSuggestion } from '@/shared/contracts/content-engine';
import { pythonBridgeErrorResponse } from '@/shared/lib/server/python-bridge';

export const maxDuration = 120;

function slugify(value: string): string {
  return (value || 'workflow')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'workflow';
}

function extractHeadings(markdown: string): string[] {
  return (markdown || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^##+\s+/.test(line))
    .map((line) => line.replace(/^##+\s+/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .slice(0, 4);
}

function buildImageSuggestion(input: {
  topic?: string;
  keyword: string;
  outline: string;
}): WorkflowImageSuggestion {
  const title = (input.topic || input.keyword || '').trim();
  const headings = extractHeadings(input.outline);
  const visualAnchors = headings.length ? headings.join(', ') : input.keyword;

  return {
    prompt:
      `áº¢nh hero editorial hiá»‡n Ä‘áº¡i cho bÃ i SEO vá» "${title}". ` +
      `Nháº¥n máº¡nh cÃ¡c Ã½: ${visualAnchors}. ` +
      `Bá»‘ cá»¥c sáº¡ch, Ã¡nh sÃ¡ng tá»± nhiÃªn, cáº£m giÃ¡c chuyÃªn nghiá»‡p, khÃ´ng chÃ¨n chá»¯, khÃ´ng watermark, tá»‰ lá»‡ ngang 16:9.`,
    altText: `áº¢nh minh há»a cho ${title}`,
    fileName: `${slugify(input.keyword)}-hero.webp`,
  };
}

function buildWorkflowReport(params: {
  topic?: string;
  keyword: string;
  secondaryKeywords?: string;
  outline: string;
  article: string;
  quality: { passed: boolean; issues: Array<{ severity: string; message: string; type: string }> };
  seoAnalysis: ReturnType<typeof analyzeContentSeo>;
  imageSuggestion: WorkflowImageSuggestion;
  sources: Array<{ title: string; url: string; snippet: string }>;
}): string {
  const headingCount = extractHeadings(params.outline).length;
  const wordCount = params.article.trim().split(/\s+/).filter(Boolean).length;
  const secondary = params.secondaryKeywords?.trim() || 'KhÃ´ng cÃ³';
  const qualityLines =
    params.quality.issues.length > 0
      ? params.quality.issues.map((issue) => `- [${issue.severity}] ${issue.message}`).join('\n')
      : '- KhÃ´ng phÃ¡t hiá»‡n lá»—i cháº¥t lÆ°á»£ng nghiÃªm trá»ng.';
  const sourceLines =
    params.sources.length > 0
      ? params.sources
          .slice(0, 5)
          .map((source) => `- [${source.title}](${source.url})`)
          .join('\n')
      : '- KhÃ´ng cÃ³ nguá»“n research ngoÃ i.';

  return [
    `# BÃ¡o cÃ¡o workflow ná»™i dung: ${params.topic || params.keyword}`,
    '',
    '## 1. Tá»« khÃ³a',
    `- Tá»« khÃ³a chÃ­nh: ${params.keyword}`,
    `- Tá»« khÃ³a phá»¥: ${secondary}`,
    '',
    '## 2. DÃ n Ã½',
    `- Sá»‘ heading H2/H3 Ä‘Ã£ táº¡o: ${headingCount}`,
    '',
    '## 3. BÃ i viáº¿t',
    `- Äá»™ dÃ i Æ°á»›c tÃ­nh: ${wordCount} tá»«`,
    '',
    '## 4. Kiá»ƒm tra',
    `- Quality gate: ${params.quality.passed ? 'Äáº¡t' : 'Cáº§n chá»‰nh sá»­a'}`,
    `- SEO score: ${params.seoAnalysis.score}/100`,
    qualityLines,
    '',
    '## 5. áº¢nh',
    `- Alt text Ä‘á» xuáº¥t: ${params.imageSuggestion.altText}`,
    `- TÃªn file Ä‘á» xuáº¥t: ${params.imageSuggestion.fileName}`,
    `- Prompt áº£nh: ${params.imageSuggestion.prompt}`,
    '',
    '## 6. BÃ¡o cÃ¡o nguá»“n',
    sourceLines,
    '',
    '## HÃ nh Ä‘á»™ng tiáº¿p theo',
    ...(params.seoAnalysis.quickFixes?.slice(0, 4).map((tip) => `- ${tip}`) || ['- RÃ  láº¡i SEO score vÃ  bá»• sung hÃ¬nh minh há»a.']),
  ].join('\n');
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ContentWorkflowRequest;
    if (!body.keyword?.trim()) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    const workflow = await requestWorkflow(body);
    const seoAnalysis = analyzeContentSeo(
      workflow.article || '',
      body.keyword || '',
      body.secondaryKeywords || '',
    );
    const imageSuggestion = buildImageSuggestion({
      topic: body.topic,
      keyword: body.keyword,
      outline: workflow.outline,
    });
    const reportMarkdown = buildWorkflowReport({
      topic: body.topic,
      keyword: body.keyword,
      secondaryKeywords: body.secondaryKeywords,
      outline: workflow.outline,
      article: workflow.article,
      quality: workflow.quality,
      seoAnalysis,
      imageSuggestion,
      sources: workflow.research?.sources || [],
    });

    return NextResponse.json({
      ...workflow,
      seoAnalysis,
      imageSuggestion,
      reportMarkdown,
    });
  } catch (error: unknown) {
    return pythonBridgeErrorResponse(error);
  }
}
