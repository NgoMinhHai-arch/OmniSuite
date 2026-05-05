const { spawn, exec } = require('child_process');
const path = require('path');

const PYTHON_SCRIPT = path.join(__dirname, 'interpreter_service.py');
const PORT = 8081;

const PIPELINE_SCRIPT = path.join(__dirname, '..', 'services', 'clip_service', 'pipeline_engine.py');
const PIPELINE_PORT = 8000;

function checkPort(port) {
  return new Promise((resolve) => {
    const net = require('net');
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

async function startPythonBackend() {
  const isRunning = await checkPort(PORT);
  
  if (isRunning) {
    console.log('✅ Python backend already running on port', PORT);
    return;
  }
  
  console.log(`🚀 Starting Python backend (Port ${PORT})...`);
  
  const python = spawn('python', [`"${PYTHON_SCRIPT}"`], {
    stdio: 'inherit',
    shell: true,
    detached: true
  });
  
  python.on('error', (err) => {
    console.error('❌ Failed to start Python:', err.message);
  });
  
  python.on('exit', (code) => {
    console.log(`Python exited with code ${code}`);
    // Auto restart
    setTimeout(() => startPythonBackend(), 2000);
  });
}

async function startImagePipeline() {
  const isRunning = await checkPort(PIPELINE_PORT);
  
  if (isRunning) {
    console.log('✅ Image Pipeline (CLIP) already running on port', PIPELINE_PORT);
    return;
  }
  
  console.log(`🚀 Starting Image Pipeline (CLIP) (Port ${PIPELINE_PORT})...`);
  
  const python = spawn('python', [`"${PIPELINE_SCRIPT}"`], {
    stdio: 'inherit',
    shell: true,
    detached: true
  });
  
  python.on('error', (err) => {
    console.error('❌ Failed to start Image Pipeline:', err.message);
  });
  
  python.on('exit', (code) => {
    console.log(`Image Pipeline exited with code ${code}`);
    // Auto restart
    setTimeout(() => startImagePipeline(), 2000);
  });
}

console.log('==========================================');
console.log('   OMNITOOL AI - AUTO STARTUP');
console.log('==========================================');

startPythonBackend();
startImagePipeline();