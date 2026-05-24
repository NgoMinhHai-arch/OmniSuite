const { spawn, execSync } = require('child_process');
const path = require('path');
const net = require('net');
const fs = require('fs');

const PROJECT_DIR = path.join(__dirname, '..');
const { resolvePythonExecutable, pythonEnvPatch } = require('./resolve-python');

function resolvePythonCmd() {
  return resolvePythonExecutable();
}
const PYTHON_SCRIPT = path.join(__dirname, 'interpreter_service.py');
const PORT = 8081;

const PIPELINE_SCRIPT = path.join(PROJECT_DIR, 'services', 'clip_service', 'pipeline_engine.py');
const PIPELINE_PORT = 8000;

const MAX_CONSECUTIVE_FAILURES = 3;
const BACKOFF_MS = [2000, 10000, 30000];

const backendState = { consecutiveFailures: 0, stopped: false };
const pipelineState = { consecutiveFailures: 0, stopped: false };

function checkPort(port) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.once('connect', () => {
      client.destroy();
      resolve(true);
    });
    client.once('error', () => {
      client.destroy();
      resolve(false);
    });
    client.connect(port, '127.0.0.1');
  });
}

async function runRepairOnce(scope) {
  try {
    const { verifyAndRepair } = require('./verify-and-repair');
    await verifyAndRepair({ repair: true, only: scope, quiet: true });
    return true;
  } catch {
    return false;
  }
}

async function preflightImport(moduleName, label, repairScope) {
  const py = resolvePythonCmd();
  const tryImport = () => {
    try {
      execSync(`"${py}" -c "import ${moduleName}"`, {
        cwd: PROJECT_DIR,
        stdio: 'pipe',
        windowsHide: true,
        env: pythonEnvPatch(),
      });
      return true;
    } catch {
      return false;
    }
  };

  if (tryImport()) return true;

  if (repairScope) {
    console.log(`[INFO] Tu dong sua loi Python (${label})...`);
    await runRepairOnce(repairScope);
    if (tryImport()) {
      console.log(`[OK] Da sua: import ${moduleName} cho ${label}`);
      return true;
    }
  }

  console.error(`[LOI] Thieu Python module "${moduleName}" cho ${label}.`);
  console.error('      Chay lai: 01_START_OMNISUITE.bat hoac npm run setup:repair');
  return false;
}

function scheduleRestart(state, startFn, serviceLabel, code) {
  if (code === 0) {
    state.consecutiveFailures = 0;
    return;
  }
  if (state.stopped) return;

  state.consecutiveFailures += 1;
  if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    state.stopped = true;
    console.error(
      `[LOI] ${serviceLabel} da thu khoi dong ${MAX_CONSECUTIVE_FAILURES} lan — dung auto-restart.`,
    );
    console.error('      Chay: scripts\\setup_deps.bat (hoac pip install -r requirements.txt)');
    return;
  }

  const delay = BACKOFF_MS[Math.min(state.consecutiveFailures - 1, BACKOFF_MS.length - 1)];
  console.log(`[INFO] ${serviceLabel} thu lai sau ${delay / 1000}s (lan ${state.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})...`);
  setTimeout(() => startFn(), delay);
}

function spawnPython(scriptPath, label, state, startFn, cwd = PROJECT_DIR) {
  const python = spawn(resolvePythonCmd(), [scriptPath], {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: pythonEnvPatch(),
  });

  python.on('error', (err) => {
    console.error(`[LOI] Khong khoi dong duoc ${label}:`, err.message);
    scheduleRestart(state, startFn, label, 1);
  });

  python.on('exit', (code) => {
    console.log(`${label} exited with code ${code}`);
    if (code === 0) {
      state.consecutiveFailures = 0;
      return;
    }
    scheduleRestart(state, startFn, label, code ?? 1);
  });
}

async function startPythonBackend() {
  if (backendState.stopped) return;

  const isRunning = await checkPort(PORT);
  if (isRunning) {
    console.log('✅ Python backend already running on port', PORT);
    backendState.consecutiveFailures = 0;
    return;
  }

  if (!(await preflightImport('flask', 'Python backend (8081)', 'flask'))) {
    backendState.stopped = true;
    return;
  }

  console.log(`🚀 Starting Python backend (Port ${PORT})...`);
  spawnPython(PYTHON_SCRIPT, 'Python backend', backendState, startPythonBackend);
}

async function startImagePipeline() {
  if (pipelineState.stopped) return;

  const isRunning = await checkPort(PIPELINE_PORT);
  if (isRunning) {
    console.log('✅ Image Pipeline (CLIP) already running on port', PIPELINE_PORT);
    pipelineState.consecutiveFailures = 0;
    return;
  }

  if (!(await preflightImport('uvicorn', 'Image Pipeline (8000)', 'clip'))) {
    pipelineState.stopped = true;
    return;
  }

  console.log(`🚀 Starting Image Pipeline (CLIP) (Port ${PIPELINE_PORT})...`);
  const clipDir = path.join(PROJECT_DIR, 'services', 'clip_service');
  spawnPython(PIPELINE_SCRIPT, 'Image Pipeline', pipelineState, startImagePipeline, clipDir);
}

console.log('==========================================');
console.log('   OMNITOOL AI - AUTO STARTUP');
console.log('==========================================');

startPythonBackend();
startImagePipeline();
