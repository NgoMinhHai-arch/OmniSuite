import { NextResponse } from 'next/server';
import { cancelContentJob } from '@/shared/lib/content-engine-client';

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const job = await cancelContentJob(id);
    return NextResponse.json(job);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cancel job failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

