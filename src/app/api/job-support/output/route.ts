import { NextResponse } from 'next/server';
import { readLastWorkspaceRun } from '@/modules/job-support/services/orchestrator';

export async function GET() {
  try {
    const output = await readLastWorkspaceRun();
    if (!output) {
      return NextResponse.json({ ok: false, error: 'No output found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, output });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read output';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
