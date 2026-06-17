import { NextResponse } from 'next/server';
import { cancelContentJob } from '@/shared/lib/content-engine-client';
import { pythonBridgeErrorResponse } from '@/shared/lib/server/python-bridge';

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const job = await cancelContentJob(id);
    return NextResponse.json(job);
  } catch (error: unknown) {
    return pythonBridgeErrorResponse(error);
  }
}
