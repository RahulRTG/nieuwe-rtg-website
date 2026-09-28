'use strict';
const net = require('node:net');
const { setTimeout:pause } = require('node:timers/promises');

async function freePort() {
  const s = net.createServer();
  await new Promise((resolve,reject) => { s.once('error', reject); s.listen(0, '127.0.0.1', resolve); });
  const port = s.address().port; await new Promise(resolve => s.close(resolve)); return port;
}
async function stop(child) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  const abort = new AbortController();
  try {
    const graceful = await Promise.race([exited.then(() => true), pause(15000, false, { signal:abort.signal })]);
    if (!graceful) { child.kill('SIGKILL'); await exited; throw Error('Native proefserver vereiste een geforceerde stop.'); }
  } finally { abort.abort(); }
}
module.exports = { freePort, stop };
