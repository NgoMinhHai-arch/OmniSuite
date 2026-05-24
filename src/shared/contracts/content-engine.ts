export type ContentPlatformPreset =
  | 'googleSeoLongForm'
  | 'facebookEngagement'
  | 'socialShort'
  | 'adCopy';

export type ContentOutputMode = 'single' | 'bulk';

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface ContentResearchPayload {
  query: string;
  context: string;
  sources: ResearchSource[];
}

export interface ContentOutlineRequest {
  topic?: string;
  keyword: string;
  secondaryKeywords?: string;
  masterContext?: string;
  framework?: string;
  provider?: string;
  modelName?: string;
  apiKey?: string;
  customBaseUrl?: string;
  tavilyApiKey?: string;
  platformPreset?: ContentPlatformPreset;
}

export interface ContentOutlineResponse {
  outline: string;
  tavilyContext: string;
  research: ContentResearchPayload;
}

export interface ContentSectionRequest {
  topic?: string;
  keyword: string;
  secondaryKeywords?: string;
  sectionTitle: string;
  sectionIndex: number;
  totalSections: number;
  masterContext?: string;
  framework?: string;
  provider?: string;
  modelName?: string;
  apiKey?: string;
  customBaseUrl?: string;
  tavilyApiKey?: string;
  tavilyContext?: string;
  platformPreset?: ContentPlatformPreset;
}

export interface ContentQualityIssue {
  type: 'duplicate' | 'missing_keyword' | 'structure' | 'style';
  message: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ContentQualityReport {
  passed: boolean;
  issues: ContentQualityIssue[];
}

export interface BulkContentVariantRequest {
  keyword: string;
  topic?: string;
  secondaryKeywords?: string;
  framework?: string;
  platformPreset?: ContentPlatformPreset;
  targetLength?: number;
}

export interface BulkContentJobRequest {
  mode: ContentOutputMode;
  provider?: string;
  modelName?: string;
  apiKey?: string;
  tavilyApiKey?: string;
  customBaseUrl?: string;
  variants: BulkContentVariantRequest[];
}

export interface BulkContentItemResult {
  keyword: string;
  platformPreset: ContentPlatformPreset;
  outline: string;
  article: string;
  research: ContentResearchPayload;
  quality: ContentQualityReport;
}

export interface BulkContentJobStatus {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    completed: number;
    total: number;
    currentKeyword?: string;
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
  results: BulkContentItemResult[];
}

