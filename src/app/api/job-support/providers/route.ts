import { NextResponse } from 'next/server';
import { getModernProviderStatuses } from '@/modules/job-support/services/orchestrator';

export async function GET() {
  try {
    const providers = await getModernProviderStatuses();
    return NextResponse.json({ ok: true, providers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load provider status';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
