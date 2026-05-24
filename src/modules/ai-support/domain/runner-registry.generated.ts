/* eslint-disable */
/** AUTO-GENERATED from integrations/manifest.json — npm run integrations:codegen */

export const RUNNER_IDS = ["open_manus","browser_use","applypilot","job_scraper"] as const;

export type RunnerId = (typeof RUNNER_IDS)[number];

export const RUNNERS: Record<RunnerId, string> = {
  open_manus: "integrations/ai-support/runners/open_manus_runner.py",
  browser_use: "integrations/ai-support/runners/browser_runner.py",
  applypilot: "integrations/ai-support/runners/applypilot_runner.py",
  job_scraper: "integrations/ai-support/runners/job_scraper_runner.py",
};

export const RUNNER_MAX_TASK_LEN: Partial<Record<RunnerId, number>> = {
  open_manus: 4000,
  browser_use: 4000,
  applypilot: 2000,
  job_scraper: 8000,
};
