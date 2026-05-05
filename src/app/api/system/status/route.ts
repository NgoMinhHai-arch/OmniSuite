import { NextResponse } from 'next/server';
import { getSystemConfig } from '@/shared/lib/config';

export async function GET() {
  const config = getSystemConfig();
  
  // Return which keys are configured (boolean only for security)
  const status: Record<string, boolean> = {};
  
  Object.entries(config).forEach(([key, value]) => {
    status[key] = !!value;
  });

  return NextResponse.json(status);
}
