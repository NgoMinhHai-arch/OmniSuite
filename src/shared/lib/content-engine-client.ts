import type {
  BulkContentJobRequest,
  BulkContentJobStatus,
  ContentOutlineRequest,
  ContentOutlineResponse,
  ContentSectionRequest,
  ContentWorkflowRequest,
  ContentWorkflowResponse,
} from '@/shared/contracts/content-engine';
import { getPythonEngineUrl } from '@/shared/lib/python-engine-url';
import { requireInternalToken } from '@/shared/lib/server/internal-token';
import {
  buildPythonEngineUnreachableMessage,
  buildPythonHttpError,
  normalizePythonBridgeError,
  parsePythonJsonOrThrow,
} from '@/shared/lib/server/python-bridge';

function getHeaders(contentType?: string) {
  const headers: Record<string, string> = {
    'x-internal-token': requireInternalToken(),
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  return headers;
}

function engineUnreachableMessage(err: unknown, engineUrl: string): Error {
  const hint = buildPythonEngineUnreachableMessage(engineUrl);
  if (err instanceof Error) {
    const message = err.message || '';
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|terminated/i.test(message)) {
      return new Error(`${hint} (${message})`);
    }
    return err;
  }
  return new Error(`${hint} (${String(err)})`);
}

export async function requestOutline(payload: ContentOutlineRequest): Promise<ContentOutlineResponse> {
  const pythonEngineUrl = getPythonEngineUrl();
  let response: Response;
  try {
    response = await fetch(`${pythonEngineUrl}/api/content/outline`, {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw normalizePythonBridgeError(engineUnreachableMessage(error, pythonEngineUrl), pythonEngineUrl);
  }
  return parsePythonJsonOrThrow<ContentOutlineResponse>(response, pythonEngineUrl);
}

export async function requestSection(payload: ContentSectionRequest): Promise<string> {
  const pythonEngineUrl = getPythonEngineUrl();
  let response: Response;
  try {
    response = await fetch(`${pythonEngineUrl}/api/content/section`, {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw normalizePythonBridgeError(engineUnreachableMessage(error, pythonEngineUrl), pythonEngineUrl);
  }
  if (!response.ok) {
    throw await buildPythonHttpError(response, pythonEngineUrl);
  }
  return response.text();
}

export async function requestWorkflow(payload: ContentWorkflowRequest): Promise<ContentWorkflowResponse> {
  const pythonEngineUrl = getPythonEngineUrl();
  let response: Response;
  try {
    response = await fetch(`${pythonEngineUrl}/api/content/workflow`, {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw normalizePythonBridgeError(engineUnreachableMessage(error, pythonEngineUrl), pythonEngineUrl);
  }
  return parsePythonJsonOrThrow<ContentWorkflowResponse>(response, pythonEngineUrl);
}

export async function createContentJob(payload: BulkContentJobRequest): Promise<BulkContentJobStatus> {
  const pythonEngineUrl = getPythonEngineUrl();
  let response: Response;
  try {
    response = await fetch(`${pythonEngineUrl}/api/content/jobs`, {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw normalizePythonBridgeError(engineUnreachableMessage(error, pythonEngineUrl), pythonEngineUrl);
  }
  return parsePythonJsonOrThrow<BulkContentJobStatus>(response, pythonEngineUrl);
}

export async function getContentJob(jobId: string): Promise<BulkContentJobStatus> {
  const pythonEngineUrl = getPythonEngineUrl();
  let response: Response;
  try {
    response = await fetch(`${pythonEngineUrl}/api/content/jobs/${jobId}`, {
      cache: 'no-store',
      headers: getHeaders(),
    });
  } catch (error) {
    throw normalizePythonBridgeError(engineUnreachableMessage(error, pythonEngineUrl), pythonEngineUrl);
  }
  return parsePythonJsonOrThrow<BulkContentJobStatus>(response, pythonEngineUrl);
}

export async function cancelContentJob(jobId: string): Promise<BulkContentJobStatus> {
  const pythonEngineUrl = getPythonEngineUrl();
  let response: Response;
  try {
    response = await fetch(`${pythonEngineUrl}/api/content/jobs/${jobId}/cancel`, {
      method: 'POST',
      headers: getHeaders(),
    });
  } catch (error) {
    throw normalizePythonBridgeError(engineUnreachableMessage(error, pythonEngineUrl), pythonEngineUrl);
  }
  return parsePythonJsonOrThrow<BulkContentJobStatus>(response, pythonEngineUrl);
}
