import { NextResponse } from 'next/server';
import { getContentJob } from '@/shared/lib/content-engine-client';
import { pythonBridgeErrorResponse } from '@/shared/lib/server/python-bridge';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const job = await getContentJob(id);
    return NextResponse.json(job);
  } catch (error: unknown) {
    return pythonBridgeErrorResponse(error);
  }
}
