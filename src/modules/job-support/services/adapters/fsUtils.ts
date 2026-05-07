import path from 'node:path';
import { promises as fs } from 'node:fs';

export function integrationPath(folder: string): string {
  return path.join(process.cwd(), 'integrations', 'benchmarks', folder);
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
