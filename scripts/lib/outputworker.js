'use strict';
const { spawn } = require('node:child_process');

// Each worker owns a new process group. Only that group may be interrupted;
// the coordinator must not leave test/server grandchildren behind on failure.
function runWorker(args, options = {}) {
  if (process.platform === 'win32') return Promise.reject(Error('Output proof requires isolated POSIX process groups.'));
  return new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: options.cwd, env: options.env,
      detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false, spawnError = null, cleanupError = null, cleaned = false;
    const cleanup = () => {
      if (cleaned || !Number.isInteger(child.pid) || child.pid <= 1) return;
      cleaned = true;
      try { process.kill(-child.pid, 'SIGKILL'); }
      catch (error) { if (error.code !== 'ESRCH') cleanupError = error.code || 'PROCESS_GROUP_CLEANUP_FAILED'; }
    };
    // A mutation and its independent control each retain their 240s limit.
    // This outer bound includes both executions plus startup/cleanup overhead.
    const timer = setTimeout(() => { timedOut = true; cleanup(); }, options.timeout ?? 500000);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8192); });
    child.once('error', error => { spawnError = error.code || 'WORKER_START_FAILED'; });
    child.once('exit', cleanup);
    child.once('close', (code, signal) => {
      clearTimeout(timer); cleanup();
      if (timedOut || spawnError || cleanupError || code !== 0 || signal) {
        resolve({ staat: 'stoornis', reden: 'Worker did not complete safely.',
          execution: { code, signal, timedOut, spawnError, cleanupError, stderr } });
        return;
      }
      const line = stdout.trim().split('\n').filter(Boolean).pop();
      try { resolve(JSON.parse(line)); }
      catch { resolve({ staat: 'stoornis', reden: 'Worker returned no valid evidence.', execution: { code, stderr } }); }
    });
  });
}

module.exports = { runWorker };
