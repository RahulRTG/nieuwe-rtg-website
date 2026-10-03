'use strict';
/* Retained-allocation sampling van uitsluitend de synthetische wegwerpserver.
   Geen inspectorpoort, heapdump, omgevingsdump of eigen periodieke belasting. */
const fs = require('node:fs'), path = require('node:path');
const H = require('./lib/heapdiagnose');
module.exports = function heapHook({ env = process.env, pid = process.pid, session } = {}) {
  if (!H.active(env)) return null;
  H.check(env.NODE_ENV === 'test' && env.GITHUB_ACTIONS === 'true' && env.RTG_DEMO === '1', 'heap-test-only');
  H.check(!env.RTG_CPU_PROFILE_DIR && env.RTG_DATA_DIR && env.RTG_GC_OUT, 'heap-isolation');
  const root = path.resolve(__dirname, '..'), dir = path.resolve(env.RTG_HEAP_PROFILE_DIR);
  H.check(dir === path.resolve(env.GITHUB_WORKSPACE || root, 'artifacts/performance-debt/heap'), 'heap-output-directory');
  H.check(path.dirname(path.resolve(env.RTG_GC_OUT)) === fs.realpathSync(env.RTG_DATA_DIR), 'heap-control-directory');
  fs.mkdirSync(dir, { recursive: true });
  H.check(fs.realpathSync(dir) === dir, 'heap-output-symlink');
  const base = { ...H.identity(env), pid, diagnosticOnly: true, node: process.version, v8: process.versions.v8,
    samplingInterval: 32768, includeCollected: false };
  const manifest = { ...base, status: 'INCOMPLETE', phases: [], profiles: [] };
  const requestFile = env.RTG_GC_OUT + '.heap-request', ackFile = env.RTG_GC_OUT + '.heap-ack';
  let seq = 0, busy = false, failed = false;
  const post = (method, params) => new Promise((resolve, reject) => session.post(method, params || {}, (e, r) => e ? reject(e) : resolve(r)));
  const save = () => {
    const tmp = path.join(dir, 'HEAP-DIAGNOSTIC.tmp');
    H.write(tmp, manifest, 65536); fs.renameSync(tmp, path.join(dir, 'HEAP-DIAGNOSTIC.json'));
  };
  return async function naGc() {
    if (!fs.existsSync(requestFile)) return;
    let request;
    try {
      H.check(!busy && !failed, 'heap-session-state'); busy = true;
      request = JSON.parse(H.read(requestFile, 4096)); fs.unlinkSync(requestFile);
      H.check(request.pid === pid && request.candidate === base.candidate && request.tooling === base.tooling &&
        request.seq === seq + 1 && request.phase === H.PHASES[seq] && /^[a-f0-9]{32}$/.test(request.nonce), 'heap-request-binding');
      if (request.phase === 'start') {
        H.check(!fs.existsSync(path.join(dir, 'HEAP-DIAGNOSTIC.json')), 'heap-stale-output');
        session = session || new (require('node:inspector').Session)(); session.connect();
        await post('HeapProfiler.enable');
        await post('HeapProfiler.startSampling', { samplingInterval: 32768, includeObjectsCollectedByMajorGC: false, includeObjectsCollectedByMinorGC: false });
      } else {
        const { profile } = await post(request.phase === 'stop' ? 'HeapProfiler.stopSampling' : 'HeapProfiler.getSamplingProfile');
        const clean = H.sanitize(profile, root);
        const artifact = H.write(path.join(dir, 'round-' + seq + '.heapprofile.json'),
          { ...base, seq: request.seq, nonce: request.nonce, timestamp: new Date().toISOString(), profile: clean });
        manifest.profiles.push(artifact);
      }
      seq++;
      manifest.phases.push({ seq, phase: request.phase, nonce: request.nonce, status: 'OK', timestamp: new Date().toISOString() });
      if (seq === 3) { session.disconnect(); manifest.status = 'COMPLETE'; }
      save(); H.write(ackFile, { ...request, status: 'OK' }, 4096);
    } catch (_) {
      failed = true; manifest.status = 'INCOMPLETE'; manifest.error = 'heap-diagnostic-failed';
      try { if (session) { await post('HeapProfiler.stopSampling'); session.disconnect(); } } catch (_) {}
      try { save(); } catch (_) {}
      try { if (request) H.write(ackFile, { ...request, status: 'ERROR' }, 4096); } catch (_) {}
    } finally { busy = false; }
  };
};
