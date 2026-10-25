import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\x1b[36m%s\x1b[0m', '========================================================');
console.log('\x1b[36m%s\x1b[0m', '   AICTE FDR Portal: Starting Backend + Frontend');
console.log('\x1b[36m%s\x1b[0m', '========================================================');

const backendDir = path.join(__dirname, 'backend');
const frontendDir = path.join(__dirname, 'frontend');

// 1. Launch FastAPI Backend
console.log('\x1b[32m%s\x1b[0m', '[1/2] Launching Backend on http://127.0.0.1:8000 ...');
const backend = spawn('uvicorn', ['app.main:app', '--reload', '--port', '8000'], {
  cwd: backendDir,
  shell: true,
  stdio: 'inherit'
});

// 2. Launch Vite Frontend
console.log('\x1b[32m%s\x1b[0m', '[2/2] Launching Frontend on http://localhost:5173 ...');
const frontend = spawn('npm', ['run', 'dev'], {
  cwd: frontendDir,
  shell: true,
  stdio: 'inherit'
});

function cleanup() {
  console.log('\n\x1b[33m%s\x1b[0m', 'Stopping all services...');
  if (backend) backend.kill('SIGINT');
  if (frontend) frontend.kill('SIGINT');
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
