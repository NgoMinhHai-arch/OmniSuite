import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENV_PATH = path.resolve(process.cwd(), '.env');

export async function GET() {
  const enabled = (process.env.AI_SUPPORT_RUNNER_ENABLED || '').toLowerCase() === 'true';
  return NextResponse.json({ enabled });
}

export async function POST(req: Request) {
  try {
    const { enabled } = await req.json();
    const isEnabled = !!enabled;

    // Update in-memory environment variable immediately
    process.env.AI_SUPPORT_RUNNER_ENABLED = String(isEnabled);

    // Read and update the .env file if it exists
    if (fs.existsSync(ENV_PATH)) {
      let content = fs.readFileSync(ENV_PATH, 'utf8');
      const regex = /^AI_SUPPORT_RUNNER_ENABLED=(.*)$/m;

      if (regex.test(content)) {
        content = content.replace(regex, `AI_SUPPORT_RUNNER_ENABLED=${isEnabled}`);
      } else {
        if (content.length && !content.endsWith('\n')) content += '\n';
        content += `AI_SUPPORT_RUNNER_ENABLED=${isEnabled}\n`;
      }
      fs.writeFileSync(ENV_PATH, content, 'utf8');
    }

    return NextResponse.json({ success: true, enabled: isEnabled });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Không thể cập nhật cấu hình' },
      { status: 500 }
    );
  }
}
