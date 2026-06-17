import { NextResponse } from 'next/server';
import { createContentJob } from '@/shared/lib/content-engine-client';
import type { BulkContentJobRequest } from '@/shared/contracts/content-engine';
import { pythonBridgeErrorResponse } from '@/shared/lib/server/python-bridge';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BulkContentJobRequest;
    if (!Array.isArray(body.variants) || body.variants.length === 0) {
      return NextResponse.json({ error: 'variants is required' }, { status: 400 });
    }
    const job = await createContentJob(body);
    return NextResponse.json(job);
  } catch (error: unknown) {
    return pythonBridgeErrorResponse(error);
  }
}
