const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const gitDir = path.join(repoRoot, '.git');
const hooksDir = path.join(gitDir, 'hooks');

if (!fs.existsSync(gitDir)) {
  console.error('No .git directory found. Run this inside the repository root.');
  console.error('Ban ZIP: van co the chay "npm run security:scan" thu cong truoc khi chia se code.');
  process.exit(1);
}

fs.mkdirSync(hooksDir, { recursive: true });

const hooks = [
  {
    name: 'pre-commit',
    content: `#!/usr/bin/env sh
set -e
echo "[OmniSuite] Quet secret tren file dang commit..."
npm run security:scan:staged
`,
  },
  {
    name: 'pre-push',
    content: `#!/usr/bin/env sh
set -e
echo ""
echo "=========================================="
echo "  OMNISUITE - KIEM TRA TRUOC KHI PUSH"
echo "=========================================="
echo "Neu phat hien API key / .env -> PUSH BI CHAN"
echo ""
node scripts/security-scan.js --pre-push
`,
  },
];

for (const hook of hooks) {
  const target = path.join(hooksDir, hook.name);
  fs.writeFileSync(target, hook.content, 'utf8');
  fs.chmodSync(target, 0o755);
  console.log(`Installed .git/hooks/${hook.name}`);
}

console.log('Git hooks installed. Moi lan push len GitHub se quet secret tu dong.');
