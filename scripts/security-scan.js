const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const MODE_STAGED = process.argv.includes('--staged');

const SECRET_ASSIGNMENT_REGEX =
  /(INTERNAL_TOKEN|NEXTAUTH_SECRET|SERPAPI_KEY|TAVILY_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|GROQ_API_KEY|LLM_API_KEY)\s*[:=]\s*["']?([^\s"'`]{12,})/g;
const DIRECT_TOKEN_PATTERNS = [
  { label: 'OpenAI-like key', regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { label: 'Google API key', regex: /\bAIza[0-9A-Za-z\-_]{20,}\b/g },
  { label: 'GitHub token', regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { label: 'JWT token', regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/g },
];

function runGit(command) {
  return execSync(command, { encoding: 'utf8' });
}

function listTrackedFiles() {
  const raw = runGit('git ls-files -z');
  return raw.split('\0').filter(Boolean);
}

function listStagedFiles() {
  const raw = runGit('git diff --cached --name-only -z --diff-filter=ACMRTUXB');
  return raw.split('\0').filter(Boolean);
}

function shouldSkipContentScan(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return (
    /(^|\/)\.env\.example$/i.test(normalized) ||
    /(^|\/)\.env\.sample$/i.test(normalized) ||
    /(^|\/)(__tests__|test|tests|fixtures?)\//i.test(normalized) ||
    /\.(png|jpg|jpeg|gif|webp|svg|ico|pdf|lock|exe|bin|zip)$/i.test(normalized)
  );
}

function looksLikePlaceholder(value) {
  const v = value.toLowerCase();
  return (
    v.includes('process.env') ||
    v.includes('import.meta.env') ||
    v.startsWith('${') ||
    v.includes('your_') ||
    v.includes('placeholder') ||
    v.includes('example') ||
    v.includes('changeme') ||
    v.includes('dummy') ||
    v.includes('test') ||
    v.includes('fake') ||
    v.includes('private') ||
    v.includes('abc123') ||
    v.includes('mock')
  );
}

function scanContent(filePath, content) {
  if (shouldSkipContentScan(filePath)) return [];
  const findings = [];

  let assignmentMatch;
  while ((assignmentMatch = SECRET_ASSIGNMENT_REGEX.exec(content)) !== null) {
    const keyName = assignmentMatch[1];
    const keyValue = assignmentMatch[2];
    if (!looksLikePlaceholder(keyValue)) {
      findings.push(`${filePath}: potential hardcoded ${keyName}`);
    }
  }
  SECRET_ASSIGNMENT_REGEX.lastIndex = 0;

  for (const pattern of DIRECT_TOKEN_PATTERNS) {
    if (pattern.regex.test(content)) {
      findings.push(`${filePath}: potential ${pattern.label}`);
    }
    pattern.regex.lastIndex = 0;
  }

  return findings;
}

function scanTrackedFiles(files) {
  const findings = [];
  for (const file of files) {
    const base = path.basename(file);
    if (/^\.env($|\.)/i.test(base) && !/\.example$/i.test(base) && !/\.sample$/i.test(base)) {
      findings.push(`${file}: tracked env file should not be committed`);
      continue;
    }
    try {
      const content = fs.readFileSync(file, 'utf8');
      findings.push(...scanContent(file, content));
    } catch {
      // ignore unreadable files
    }
  }
  return findings;
}

function scanStagedDiff() {
  const stagedFiles = listStagedFiles();
  const findings = [];

  for (const file of stagedFiles) {
    const base = path.basename(file);
    if (/^\.env($|\.)/i.test(base) && !/\.example$/i.test(base) && !/\.sample$/i.test(base)) {
      findings.push(`${file}: staged env file should not be committed`);
      continue;
    }
    if (shouldSkipContentScan(file)) continue;
    let patch = '';
    try {
      patch = runGit(`git diff --cached -U0 -- "${file}"`);
    } catch {
      continue;
    }
    const addedLines = patch
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .map((line) => line.slice(1))
      .join('\n');
    if (!addedLines.trim()) continue;
    findings.push(...scanContent(`${file} (staged)`, addedLines));
  }

  return findings;
}

function main() {
  const findings = MODE_STAGED
    ? scanStagedDiff()
    : scanTrackedFiles(listTrackedFiles());

  if (findings.length > 0) {
    console.error('Security scan failed. Potential secrets detected:\n');
    for (const finding of findings) {
      console.error(`- ${finding}`);
    }
    process.exit(1);
  }

  console.log(
    MODE_STAGED
      ? 'Security scan passed for staged changes.'
      : 'Security scan passed (no obvious tracked secrets found).',
  );
}

main();
