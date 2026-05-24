import { NextResponse } from 'next/server';
import AiProcessManager from '@/shared/lib/aiProcessManager';

/**
 * GET /api/images/health
 * Returns the current status of the AI Pipeline: 'ready', 'loading', or 'error'
 */
export async function GET() {
  const manager = AiProcessManager.getInstance();
  const status = await manager.getStatus();
  return NextResponse.json({ status });
}

/**
 * POST /api/images/health
 * Proactively triggers 'ensureStarted' in the background to warm up the CLIP model.
 * Returns the final status after a short wait.
 */
export async function POST() {
  const manager = AiProcessManager.getInstance();

  // Idempotent warmup: nếu đã ready/loading thì không start lại.
  const currentStatus = await manager.getStatus();
  if (currentStatus === 'ready' || currentStatus === 'loading') {
    return NextResponse.json({
      message: 'Warmup already in progress or ready',
      status: currentStatus
    });
  }

  manager.ensureStarted();

  await new Promise(r => setTimeout(r, 1000));
  const status = await manager.getStatus();

  return NextResponse.json({
    message: 'Warmup triggered',
    status
  });
}
