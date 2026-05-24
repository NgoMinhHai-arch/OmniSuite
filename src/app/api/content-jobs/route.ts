import { NextResponse } from 'next/server';
import { createContentJob } from '@/shared/lib/content-engine-client';
import type { BulkContentJobRequest } from '@/shared/contracts/content-engine';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BulkContentJobRequest;
    if (!Array.isArray(body.variants) || body.variants.length === 0) {
      return NextResponse.json({ error: 'variants is required' }, { status: 400 });
    }
    const job = await createContentJob(body);
    return NextResponse.json(job);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Create job failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

