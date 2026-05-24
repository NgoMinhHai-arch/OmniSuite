const { spawnSync } = require('node:child_process');

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function runCapture(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    if (stderr) process.stderr.write(`${stderr}\n`);
    process.exit(result.status || 1);
  }
  return (result.stdout || '').trim();
}

function parseArgs(argv) {
  const raw = argv.slice(2);
  const help = raw.includes('--help') || raw.includes('-h');
  const messageParts = [];

  for (const token of raw) {
    if (token === '--help' || token === '-h') continue;
    messageParts.push(token);
  }

  return {
    help,
    message: messageParts.join(' ').trim(),
  };
}

function printHelp() {
  console.log(
    [
      'Usage:',
      '  npm run ship -- "commit message"',
      '',
      'Behavior:',
      '  1) Run security scan',
      '  2) Stage all changes',
      '  3) Commit (if there are changes)',
      '  4) Push current branch to origin',
      '',
      'Examples:',
      '  npm run ship -- "fix crawl fallback"',
      '  npm run ship -- "update docs and hooks"',
    ].join('\n'),
  );
}

function main() {
  const { help, message } = parseArgs(process.argv);
  if (help) {
    printHelp();
    return;
  }

  const currentBranch = runCapture('git', ['branch', '--show-current']);
  if (!currentBranch) {
    console.error('Could not determine current git branch.');
    process.exit(1);
  }

  run('npm', ['run', 'security:scan']);

  const before = runCapture('git', ['status', '--porcelain']);
  if (!before) {
    console.log('No local changes. Pushing current branch...');
    run('git', ['push', 'origin', currentBranch]);
    return;
  }

  if (!message) {
    console.error('Commit message is required when there are changes.');
    console.error('Run: npm run ship -- "your commit message"');
    process.exit(1);
  }

  run('git', ['add', '-A']);
  run('git', ['commit', '-m', message]);
  run('git', ['push', 'origin', currentBranch]);
}

main();
