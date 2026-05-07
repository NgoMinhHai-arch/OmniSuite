export type JobWorkspace = 'find-jobs' | 'tailor-cv' | 'auto-apply';

export type JobSupportProvider = 'vn-job-feed' | 'manual-apply' | 'ai-resume-tailor' | 'crawl4ai-url';

export type JobSupportErrorCode =
  | 'INVALID_INPUT'
  | 'PROVIDER_NOT_READY'
  | 'MISSING_APPROVAL'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'COMMAND_FAILED'
  | 'DEPENDENCIES_MISSING';

export type JobSupportMode = 'dry-run' | 'live';

/** Normalized listing for Find Jobs (VN aggregator). */
export type JobListing = {
  title: string;
  link: string;
  snippet?: string;
  source: string;
  /** SerpApi engine slice: google | google_jobs */
  engine?: string;
  company?: string;
  location?: string;
  salary?: string;
  postedAt?: string;
  description?: string;
  requirements?: string[];
  benefits?: string[];
};

export type JobSupportRequest = {
  workspace: JobWorkspace;
  mode?: JobSupportMode;
  approved?: boolean;
  jobUrl?: string;
  jobTitle?: string;
  location?: string;
  jdText?: string;
  /** Multiline domains (e.g. vietnamworks.com) or comma-separated override for SerpApi site: queries */
  companyPortals?: string;
  scoreThreshold?: string;
  resumeText?: string;
  /** Optional SerpApi key from client localStorage merged with env */
  serpapi_key?: string;
  /** Optional Tavily key from client localStorage merged with env */
  tavily_api_key?: string;
  /** Eco mode: reduce query count to save SerpApi credits */
  ecoMode?: boolean;
  /** Optional hard cap for total SerpApi requests in one run */
  maxQueries?: number;
  /** Multiline URLs for manual apply (one per line); preferred over repurposing jdText */
  applyJobUrls?: string;
  /** Optional URL-in crawling mode powered by Job Ops + Crawl4AI */
  searchUrl?: string;
  maxPages?: number;
};

export type JobSupportRunResult = {
  id: string;
  workspace: JobWorkspace;
  provider: JobSupportProvider;
  mode: JobSupportMode;
  command: string;
  cwd: string;
  ok: boolean;
  exitCode: number;
  durationMs: number;
  startedAt: string;
  endedAt: string;
  stdout: string;
  stderr: string;
  summary: string;
  errorCode?: JobSupportErrorCode;
  hint?: string;
  meta?: {
    jobs?: JobListing[];
    applyUrls?: string[];
    domainCounts?: Record<string, number>;
    queriesUsed?: string[];
    summaryText?: string;
    [key: string]: unknown;
  };
};

export type JobSupportApiResponse = {
  ok: boolean;
  output?: JobSupportRunResult;
  error?: string;
  errorCode?: JobSupportErrorCode;
  hint?: string;
};

export type JobDetailCostMode = 'free_only' | 'free_then_paid' | 'paid_priority';

export type JobDetailEnrichment = {
  description?: string;
  requirements?: string[];
  benefits?: string[];
  source: string;
  updatedAt: string;
};

export type JobDetailStrategy = 'free_fetch' | 'tavily' | 'serpapi';

export type JobDetailEnrichRequest = {
  link: string;
  title?: string;
  costMode: JobDetailCostMode;
  serpapi_key?: string;
  tavily_api_key?: string;
};

export type JobDetailEnrichResponse = {
  ok: boolean;
  detail?: JobDetailEnrichment;
  strategyUsed?: JobDetailStrategy;
  fallbackUsed?: boolean;
  creditsEstimate?: number;
  error?: string;
  errorCode?: JobSupportErrorCode;
  hint?: string;
};
