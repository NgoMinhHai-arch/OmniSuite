import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { promises as fs } from 'node:fs';

type FullAuditRequest = {
  url?: string;
  categories?: string[];
  includeCwv?: boolean;
  crawl?: boolean;
  maxPages?: number;
  format?: 'json' | 'html' | 'markdown' | 'llm' | 'console';
  exportFile?: boolean;
};

function parseJsonFromOutput(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Empty audit output');
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error('Invalid JSON output');
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FullAuditRequest;
    const targetUrl = (body.url || '').trim();
    if (!targetUrl) return NextResponse.json({ error: 'url is required' }, { status: 400 });
    try {
      new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: 'invalid url' }, { status: 400 });
    }

    const outputFormat = body.format || 'json';
    const repoRoot = process.cwd();
    const cliPath = path.join(repoRoot, '.tmp', 'seo-audit-skill', 'dist', 'cli.js');
    const cliCwd = path.join(repoRoot, '.tmp', 'seo-audit-skill');
    const args: string[] = [cliPath, 'audit', targetUrl, '--format', outputFormat];
    if (Array.isArray(body.categories) && body.categories.length > 0) {
      args.push('--categories', body.categories.join(','));
    }
    if (body.includeCwv === false) args.push('--no-cwv');
    if (body.crawl) {
      args.push('--crawl');
      if (typeof body.maxPages === 'number' && body.maxPages > 0) {
        args.push('--max-pages', String(Math.min(body.maxPages, 100)));
      }
    }
    const shouldExportFile = !!body.exportFile && outputFormat !== 'console';
    const safeHost = new URL(targetUrl).hostname.replace(/[^a-z0-9.-]/gi, '_');
    const ext =
      outputFormat === 'html'
        ? 'html'
        : outputFormat === 'markdown'
          ? 'md'
          : outputFormat === 'json'
            ? 'json'
            : 'txt';
    const fileName = `full-audit-${safeHost}-${Date.now()}.${ext}`;
    const exportPath = path.join(repoRoot, '.tmp', 'seo-audit-skill', '.exports', fileName);
    if (shouldExportFile) {
      await fs.mkdir(path.dirname(exportPath), { recursive: true });
      args.push('--output', exportPath);
    }

    const output = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(process.execPath, args, {
        cwd: cliCwd,
        env: process.env,
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Full audit timed out after 120s'));
      }, 120_000);
      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(stderr || `Audit exited with code ${code}`));
          return;
        }
        resolve({ stdout, stderr });
      });
    });

    if (outputFormat === 'json' && !shouldExportFile) {
      const parsed = parseJsonFromOutput(output.stdout);
      return NextResponse.json({ format: 'json', data: parsed });
    }

    if (shouldExportFile) {
      const content = await fs.readFile(exportPath, 'utf-8');
      if (outputFormat === 'json') {
        return NextResponse.json({
          format: 'json',
          fileName,
          data: parseJsonFromOutput(content),
          content,
        });
      }
      return NextResponse.json({
        format: outputFormat,
        fileName,
        content,
      });
    }

    if (outputFormat === 'llm') {
      return NextResponse.json({ format: 'llm', content: output.stdout.trim() });
    }

    return NextResponse.json({
      format: outputFormat,
      content: output.stdout.trim(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to run full audit' },
      { status: 500 },
    );
  }
}

