#!/usr/bin/env node
'use strict';
// Aan te roepen door de bestaande Keychain-wikkel, nadat geheimen zijn geladen.
// Vertrouwde controller-checkout en bewijs blijven buiten de immutable app.
const path = require('node:path'), cp = require('node:child_process');
function start(root) {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') throw Error('Native host is niet macOS arm64.');
  for (const key of Object.keys(process.env))
    if (/^(NODE_OPTIONS|NODE_PATH|LD_PRELOAD|DYLD_.*)$/.test(key) && process.env[key])
      throw Error('Runtime-injectievariabele is niet toegestaan in de bevroren native release.');
  const a = require('./lib/native-host').current(root);
  const env = { ...process.env, NODE_ENV:'production', PORT:String(a.config.port), RTG_DATA_DIR:a.config.dataDirectory };
  const child = cp.spawn(path.join(a.release, 'runtime/node'), ['server/server.js'],
    { cwd:path.join(a.release, 'app'), env, stdio:'inherit' });
  const forward = signal => { if (child.exitCode === null && !child.signalCode) child.kill(signal); };
  process.on('SIGTERM', () => forward('SIGTERM')); process.on('SIGINT', () => forward('SIGINT'));
  child.on('error', () => { console.error('Native app kon niet starten.'); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code === null ? (signal ? 1 : 0) : code; });
  return child;
}
if (require.main === module) {
  try { start(path.resolve(__dirname, '..')); }
  catch (e) { console.error('[native-start] ' + e.message); process.exitCode = 1; }
}
module.exports = { start };
