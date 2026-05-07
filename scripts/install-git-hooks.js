const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const gitDir = path.join(repoRoot, '.git');
const hooksDir = path.join(gitDir, 'hooks');

if (!fs.existsSync(gitDir)) {
  console.error('No .git directory found. Run this inside the repository root.');
  process.exit(1);
}

fs.mkdirSync(hooksDir, { recursive: true });

const hooks = [
  {
    name: 'pre-commit',
    content: `#!/usr/bin/env sh
set -e
npm run security:scan:staged
`,
  },
  {
    name: 'pre-push',
    content: `#!/usr/bin/env sh
set -e
npm run security:scan
`,
  },
];

for (const hook of hooks) {
  const target = path.join(hooksDir, hook.name);
  fs.writeFileSync(target, hook.content, 'utf8');
  fs.chmodSync(target, 0o755);
  console.log(`Installed .git/hooks/${hook.name}`);
}

console.log('Git hooks installed successfully.');
