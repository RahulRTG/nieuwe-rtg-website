'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
function cancellation(source = process) {
  const state = { interrupted: false, kill: null };
  const interrupt = () => { state.interrupted = true; state.kill?.(); };
  for (const signal of ['SIGTERM', 'SIGINT']) source.on(signal, interrupt);
  state.dispose = () => { for (const signal of ['SIGTERM', 'SIGINT']) source.removeListener(signal, interrupt); };
  return state;
}
async function runContainer(args, name, output, cancellation) {
  const out = fs.openSync(path.join(output, 'container.stdout'), 'wx'), err = fs.openSync(path.join(output, 'container.stderr'), 'wx');
  let timeout = false;
  const child = cp.spawn('docker', args, { stdio: ['ignore', out, err] });
  fs.closeSync(out); fs.closeSync(err);
  const kill = () => { cp.spawnSync('docker', ['kill', name], { timeout: 15000, stdio: 'ignore' }); };
  const timer = setTimeout(() => { timeout = true; kill(); }, 17 * 60 * 1000);
  cancellation.kill = kill;
  if (cancellation.interrupted) kill();
  try { return await new Promise(resolve => {
    child.once('error', error => resolve({ exitCode: null, error: error.message, timeout, interrupted: cancellation.interrupted }));
    child.once('close', (exitCode, signal) => resolve({ exitCode, signal, timeout, interrupted: cancellation.interrupted }));
  }); } finally { clearTimeout(timer); cancellation.kill = null; kill(); }
}
module.exports = { cancellation, runContainer };
