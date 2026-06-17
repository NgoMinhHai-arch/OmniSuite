import { NextResponse } from 'next/server';
import { getPythonEngineUrl } from '@/shared/lib/python-engine-url';

export type PythonBridgeErrorCode =
  | 'PYTHON_ENGINE_UNREACHABLE'
  | 'PYTHON_ENGINE_UNAUTHORIZED'
  | 'PYTHON_ENGINE_BAD_RESPONSE'
  | 'PYTHON_ENGINE_REQUEST_FAILED'
  | 'PYTHON_ENGINE_AUTH_CONFIG';

export class PythonBridgeError extends Error {
  code: PythonBridgeErrorCode;
  status: number;
  details?: Record<string, unknown>;

  constructor(
    code: PythonBridgeErrorCode,
    message: string,
    status = 502,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PythonBridgeError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function buildPythonEngineUnreachableMessage(engineUrl = getPythonEngineUrl()): string {
  return `KhÃ´ng káº¿t ná»‘i Ä‘Æ°á»£c Python Engine táº¡i ${engineUrl}. HÃ£y cháº¡y npm run dev hoáº·c kiá»ƒm tra PYTHON_ENGINE_URL.`;
}

function looksLikeInternalTokenError(message: string): boolean {
  const lower = (message || '').toLowerCase();
  return lower.includes('internal_token') || lower.includes('internal token');
}

export function normalizePythonBridgeError(error: unknown, engineUrl = getPythonEngineUrl()): PythonBridgeError {
  if (error instanceof PythonBridgeError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message || '';
    if (looksLikeInternalTokenError(message)) {
      return new PythonBridgeError(
        'PYTHON_ENGINE_AUTH_CONFIG',
        'Cáº¥u hÃ¬nh INTERNAL_TOKEN khÃ´ng há»£p lá»‡. HÃ£y Ä‘áº·t INTERNAL_TOKEN riÃªng hoáº·c táº¯t strict mode khi cháº¡y development.',
        500,
        { engineUrl },
      );
    }
    if (/fetch failed|econnrefused|enotfound|etimedout|terminated|networkerror|load failed/i.test(message)) {
      return new PythonBridgeError(
        'PYTHON_ENGINE_UNREACHABLE',
        buildPythonEngineUnreachableMessage(engineUrl),
        502,
        { engineUrl },
      );
    }
    return new PythonBridgeError('PYTHON_ENGINE_REQUEST_FAILED', message, 502, { engineUrl });
  }

  return new PythonBridgeError(
    'PYTHON_ENGINE_REQUEST_FAILED',
    `KhÃ´ng thá»ƒ gá»i Python Engine táº¡i ${engineUrl}.`,
    502,
    { engineUrl },
  );
}

export async function buildPythonHttpError(
  response: Response,
  engineUrl = getPythonEngineUrl(),
): Promise<PythonBridgeError> {
  const raw = await response.text().catch(() => '');
  const trimmed = raw.trim();

  if (response.status === 401 || response.status === 403) {
    return new PythonBridgeError(
      'PYTHON_ENGINE_UNAUTHORIZED',
      `Python Engine tá»« chá»‘i xÃ¡c thá»±c táº¡i ${engineUrl}. Kiá»ƒm tra INTERNAL_TOKEN giá»¯a Next.js vÃ  Python FastAPI.`,
      502,
      { engineUrl, upstreamStatus: response.status, upstreamBody: trimmed.slice(0, 500) },
    );
  }

  return new PythonBridgeError(
    'PYTHON_ENGINE_REQUEST_FAILED',
    `Python Engine tráº£ lá»—i ${response.status} táº¡i ${engineUrl}.`,
    response.status >= 500 ? 502 : response.status,
    { engineUrl, upstreamStatus: response.status, upstreamBody: trimmed.slice(0, 1000) },
  );
}

export async function parsePythonJsonOrThrow<T>(
  response: Response,
  engineUrl = getPythonEngineUrl(),
): Promise<T> {
  if (!response.ok) {
    throw await buildPythonHttpError(response, engineUrl);
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new PythonBridgeError(
      'PYTHON_ENGINE_BAD_RESPONSE',
      `Python Engine tráº£ dá»¯ liá»‡u JSON khÃ´ng há»£p lá»‡ táº¡i ${engineUrl}.`,
      502,
      { engineUrl, reason: error instanceof Error ? error.message : String(error) },
    );
  }
}

export function pythonBridgeErrorResponse(
  error: unknown,
  engineUrl = getPythonEngineUrl(),
): NextResponse {
  const normalized = normalizePythonBridgeError(error, engineUrl);
  return NextResponse.json(
    {
      error: normalized.code,
      message: normalized.message,
      ...(normalized.details ? { details: normalized.details } : {}),
    },
    { status: normalized.status },
  );
}
