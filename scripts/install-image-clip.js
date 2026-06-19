const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  PROJECT_DIR,
  resolvePythonExecutable,
  pythonEnvPatch,
  localPythonPackagesDir,
} = require('./resolve-python');

const reqFile = path.join(PROJECT_DIR, 'services', 'clip_service', 'requirements-clip.txt');
const flagFile = path.join(PROJECT_DIR, '.omnisuite', 'image-clip-installed.flag');

function log(msg = '') {
  console.log(msg);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: PROJECT_DIR,
      stdio: 'inherit',
      shell: process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx'),
      env: pythonEnvPatch(),
    });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    child.on('error', reject);
  });
}

async function main() {
  log('');
  log('OmniSuite - Image CLIP optional installer');
  log('');

  if (!fs.existsSync(reqFile)) {
    throw new Error('Missing services/clip_service/requirements-clip.txt. Please update the repository first.');
  }

  fs.mkdirSync(localPythonPackagesDir(), { recursive: true });
  fs.mkdirSync(path.dirname(flagFile), { recursive: true });

  const py = resolvePythonExecutable();
  log(`Python: ${py}`);
  log(`Target: ${path.relative(PROJECT_DIR, localPythonPackagesDir())}`);
  log('Installing optional Image CLIP packages. First run can take a while.');
  log('');

  await run(py, [
    '-m',
    'pip',
    'install',
    '--upgrade',
    '--target',
    localPythonPackagesDir(),
    '-r',
    reqFile,
  ]);

  fs.writeFileSync(flagFile, new Date().toISOString(), 'utf8');
  log('');
  log('Image CLIP packages installed. Run 01_START_OMNISUITE.bat again.');
}

main().catch((err) => {
  console.error('Image CLIP install failed:', err.message);
  process.exit(1);
});
