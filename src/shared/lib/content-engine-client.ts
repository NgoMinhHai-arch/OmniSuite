import type {
  BulkContentJobRequest,
  BulkContentJobStatus,
  ContentOutlineRequest,
  ContentOutlineResponse,
  ContentSectionRequest,
} from '@/shared/contracts/content-engine';
import { requireInternalToken } from '@/shared/lib/server/internal-token';

const PYTHON_ENGINE_URL = process.env.PYTHON_ENGINE_URL || 'http://127.0.0.1:8082';

function getHeaders(contentType?: string) {
  const headers: Record<string, string> = {
    'x-internal-token': requireInternalToken(),
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  return headers;
}

function engineUnreachableMessage(err: unknown): Error {
  const hint =
    `Không kết nối được Python Content Engine (${PYTHON_ENGINE_URL}). ` +
    'Chạy python_engine trên đúng cổng và kiểm tra biến PYTHON_ENGINE_URL trong môi trường Next.js.';
  if (err instanceof Error) {
    const m = err.message || '';
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|terminated/i.test(m)) {
      return new Error(`${hint} (${m})`);
    }
    return err;
  }
  return new Error(`${hint} (${String(err)})`);
}

async function parseJsonSafe(resp: Response) {
  return resp.json().catch(() => ({}));
}

export async function requestOutline(payload: ContentOutlineRequest): Promise<ContentOutlineResponse> {
  let resp: Response;
  try {
    resp = await fetch(`${PYTHON_ENGINE_URL}/api/content/outline`, {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw engineUnreachableMessage(e);
  }
  if (!resp.ok) {
    const err = await parseJsonSafe(resp);
    throw new Error(err.detail || err.error || 'Outline generation failed');
  }
  return resp.json();
}

export async function requestSection(payload: ContentSectionRequest): Promise<string> {
  let resp: Response;
  try {
    resp = await fetch(`${PYTHON_ENGINE_URL}/api/content/section`, {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw engineUnreachableMessage(e);
  }
  if (!resp.ok) {
    const err = await parseJsonSafe(resp);
    throw new Error(err.detail || err.error || 'Section generation failed');
  }
  return resp.text();
}

export async function createContentJob(payload: BulkContentJobRequest): Promise<BulkContentJobStatus> {
  let resp: Response;
  try {
    resp = await fetch(`${PYTHON_ENGINE_URL}/api/content/jobs`, {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw engineUnreachableMessage(e);
  }
  if (!resp.ok) {
    const err = await parseJsonSafe(resp);
    throw new Error(err.detail || err.error || 'Create job failed');
  }
  return resp.json();
}

export async function getContentJob(jobId: string): Promise<BulkContentJobStatus> {
  let resp: Response;
  try {
    resp = await fetch(`${PYTHON_ENGINE_URL}/api/content/jobs/${jobId}`, {
      cache: 'no-store',
      headers: getHeaders(),
    });
  } catch (e) {
    throw engineUnreachableMessage(e);
  }
  if (!resp.ok) {
    const err = await parseJsonSafe(resp);
    throw new Error(err.detail || err.error || 'Get job failed');
  }
  return resp.json();
}

export async function cancelContentJob(jobId: string): Promise<BulkContentJobStatus> {
  let resp: Response;
  try {
    resp = await fetch(`${PYTHON_ENGINE_URL}/api/content/jobs/${jobId}/cancel`, {
      method: 'POST',
      headers: getHeaders(),
    });
  } catch (e) {
    throw engineUnreachableMessage(e);
  }
  if (!resp.ok) {
    const err = await parseJsonSafe(resp);
    throw new Error(err.detail || err.error || 'Cancel job failed');
  }
  return resp.json();
}

