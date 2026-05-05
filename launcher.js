/**
 * OMNISUITE LAUNCHER
 * ÄÆ¡n giáº£n hÃ³a viá»‡c khá»Ÿi Ä‘á»™ng - chá»‰ cáº§n cháº¡y: node launcher.js
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const PROJECT_DIR = __dirname;
const LOGS_DIR = path.join(PROJECT_DIR, 'logs');
const ENV_PATH = path.join(PROJECT_DIR, '.env');
const ENV_EXAMPLE_PATH = path.join(PROJECT_DIR, '.env.example');

// MÃ u cho console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(type, msg) {
  const time = new Date().toLocaleTimeString('vi-VN');
  let color = colors.reset;
  let prefix = '[?]';
  
  switch(type) {
    case 'ok': color = colors.green; prefix = '[OK]'; break;
    case 'err': color = colors.red; prefix = '[LOI]'; break;
    case 'warn': color = colors.yellow; prefix = '[CANH BAO]'; break;
    case 'info': color = colors.blue; prefix = '[INFO]'; break;
    case 'step': color = colors.cyan; prefix = '[*]'; break;
  }
  
  console.log(`${color}${prefix}${colors.reset} ${msg}`);
}

function checkCommand(cmd) {
  return new Promise((resolve) => {
    exec(`${cmd} --version`, { windowsHide: true }, (err) => {
      resolve(!err);
    });
  });
}

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: PROJECT_DIR,
      shell: true,
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    
    child.on('close', (code) => {
      if (code === 0 || options.ignoreError) resolve(code);
      else reject(new Error(`Command failed with code ${code}`));
    });
    
    child.on('error', reject);
  });
}

async function ensureDependencies() {
  log('step', 'Kiem tra moi truong...');
  
  // Kiá»ƒm tra Node.js
  const hasNode = await checkCommand('node');
  if (!hasNode) {
    log('err', 'KHONG TIM THAY NODE.JS!');
    log('info', 'Vui long cai dat tu: https://nodejs.org/');
    return false;
  }
  log('ok', 'Node.js OK');
  
  // Kiá»ƒm tra Python
  const hasPython = await checkCommand('python');
  if (!hasPython) {
    log('err', 'KHONG TIM THAY PYTHON!');
    log('info', 'Vui long cai dat tu: https://www.python.org/downloads/');
    return false;
  }
  log('ok', 'Python OK');
  
  return true;
}

async function installDependencies() {
  // Táº¡o logs directory
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);
  
  // CÃ i npm packages
  if (!fs.existsSync(path.join(PROJECT_DIR, 'node_modules'))) {
    log('step', 'Dang cai Node.js packages (lan dau)...');
    log('warn', 'Qua trinh nay co the mat 3-5 phut...');
    try {
      await runCommand('npm', ['install'], { silent: false });
      log('ok', 'Node.js packages da san sang');
    } catch (e) {
      log('err', 'npm install that bai!');
      log('info', 'Thu: npm install --registry https://registry.npmmirror.com');
      return false;
    }
  } else {
    log('ok', 'Node.js packages da co san');
  }
  
  // CÃ i Python packages
  if (fs.existsSync(path.join(PROJECT_DIR, 'requirements.txt'))) {
    log('step', 'Dang cai Python packages...');
    try {
      await runCommand('python', ['-m', 'pip', 'install', '-r', 'requirements.txt'], { silent: false, ignoreError: true });
      log('ok', 'Python packages da san sang');
    } catch (e) {
      log('warn', 'Co loi khi cai Python packages (co the bo qua)');
    }
  }
  
  return true;
}

function startService(name, cmd, args, readyCheck = null) {
  return new Promise((resolve) => {
    log('step', `Khoi dong ${name}...`);
    
    const child = spawn(cmd, args, {
      cwd: PROJECT_DIR,
      shell: true,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });
    
    child.on('error', (err) => {
      log('err', `${name} loi: ${err.message}`);
    });
    
    // Äá»£i má»™t chÃºt Ä‘á»ƒ service khá»Ÿi Ä‘á»™ng
    setTimeout(() => {
      log('ok', `${name} da khoi dong`);
      resolve(child);
    }, 3000);
  });
}


function generateInternalToken() {
  return `omni_${crypto.randomBytes(24).toString('hex')}`;
}

function ensureEnvTokens() {
  let envContent = '';
  let modified = false;

  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf8');
  } else if (fs.existsSync(ENV_EXAMPLE_PATH)) {
    envContent = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');
    log('warn', 'Khong tim thay .env, se tao tu .env.example');
  } else {
    log('warn', 'Khong tim thay .env va .env.example, se tao .env moi');
  }

  // Ensure INTERNAL_TOKEN
  const tokenRegex = /^INTERNAL_TOKEN=(.*)$/m;
  const tokenMatch = envContent.match(tokenRegex);
  const existingToken = tokenMatch ? (tokenMatch[1] || '').trim() : '';
  let token = existingToken;

  if (!token) {
    token = generateInternalToken();
    if (tokenMatch) {
      envContent = envContent.replace(tokenRegex, `INTERNAL_TOKEN=${token}`);
    } else {
      if (envContent.length && !envContent.endsWith('\n')) envContent += '\n';
      envContent += `INTERNAL_TOKEN=${token}\n`;
    }
    modified = true;
  }

  // Ensure NEXTAUTH_SECRET
  const secretRegex = /^NEXTAUTH_SECRET=(.*)$/m;
  const secretMatch = envContent.match(secretRegex);
  const existingSecret = secretMatch ? (secretMatch[1] || '').trim() : '';
  let secret = existingSecret;

  if (!secret) {
    secret = `omnisuite_${crypto.randomBytes(32).toString('hex')}`;
    if (secretMatch) {
      envContent = envContent.replace(secretRegex, `NEXTAUTH_SECRET=${secret}`);
    } else {
      if (envContent.length && !envContent.endsWith('\n')) envContent += '\n';
      envContent += `NEXTAUTH_SECRET=${secret}\n`;
    }
    modified = true;
  }

  if (modified || !fs.existsSync(ENV_PATH)) {
    fs.writeFileSync(ENV_PATH, envContent, 'utf8');
    log('ok', 'Da tao/cap nhat INTERNAL_TOKEN va NEXTAUTH_SECRET trong .env');
  }

  process.env.INTERNAL_TOKEN = token;
  process.env.NEXTAUTH_SECRET = secret;
}
async function main() {
  console.clear();
  console.log(`${colors.bold}${colors.cyan}`);
  console.log('========================================');
  console.log('   OMNISUITE AI - LAUNCHER');
  console.log('========================================');
  console.log(`${colors.reset}`);
  
  // 1. Kiá»ƒm tra mÃ´i trÆ°á»ng
  const envOk = await ensureDependencies();
  if (!envOk) {
    console.log('\nNhan Enter de thoat...');
    await new Promise(r => process.stdin.once('data', r));
    process.exit(1);
  }
  
  // 2. CÃ i Ä‘áº·t dependencies
  const depsOk = await installDependencies();
  if (!depsOk) {
    console.log('\nNhan Enter de thoat...');
    await new Promise(r => process.stdin.once('data', r));
    process.exit(1);
  }

  ensureEnvTokens();
  
  // 3. Khá»Ÿi Ä‘á»™ng cÃ¡c services
  console.log('\n');
  log('info', 'Dang khoi dong he thong...');
  
  const services = [];
  
  // Service 1: Python Interpreter (port 8081)
  services.push(await startService(
    'Python Backend (8081)',
    'node',
    ['scripts/start-backend.js']
  ));
  
  // Service 2: Python Engine (port 8082)
  services.push(await startService(
    'Python Engine (8082)',
    'python',
    ['-m', 'uvicorn', 'python_engine.main:app', '--host', '127.0.0.1', '--port', '8082', '--reload']
  ));
  
  // Service 3: Next.js Frontend (port 3000)
  services.push(await startService(
    'Next.js Frontend (3000)',
    'node',
    ['--dns-result-order=ipv4first', 'node_modules/next/dist/bin/next', 'dev']
  ));
  
  // Má»Ÿ trÃ¬nh duyá»‡t sau 10 giÃ¢y
  setTimeout(() => {
    log('info', 'Mo trinh duyet...');
    exec('start http://localhost:3000');
  }, 10000);
  
  // Hiá»ƒn thá»‹ thÃ´ng tin
  console.log('\n');
  console.log(`${colors.green}${colors.bold}`);
  console.log('========================================');
  console.log('   SERVER DANG CHAY!');
  console.log('   URL: http://localhost:3000');
  console.log('========================================');
  console.log(`${colors.reset}`);
  console.log('\nNhan Ctrl+C de dung tat ca services\n');
  
  // Xá»­ lÃ½ dá»«ng graceful
  process.on('SIGINT', () => {
    log('warn', '\nDang dung cac services...');
    services.forEach(s => {
      try { s.kill(); } catch(e) {}
    });
    setTimeout(() => process.exit(0), 2000);
  });
  
  // Giá»¯ process sá»‘ng
  await new Promise(() => {});
}

main().catch(err => {
  log('err', `Loi khong mong muon: ${err.message}`);
  process.exit(1);
});

