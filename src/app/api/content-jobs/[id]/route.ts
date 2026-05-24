import { NextResponse } from 'next/server';
import { getContentJob } from '@/shared/lib/content-engine-client';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const job = await getContentJob(id);
    return NextResponse.json(job);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Get job failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

