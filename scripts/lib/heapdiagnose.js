'use strict';
/* Alleen testtooling: begrensde samplingprofielen, nooit heapinhoud of normale
   prestatienormen. Het protocol deelt de bestaande GC-puls met de wegwerpserver. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const MAX_BYTES = 5 * 1024 * 1024;
const PHASES = ['start', 'sample', 'stop'];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const integer = (n, min = 0) => Number.isSafeInteger(n) && n >= min;
const check = (ok, code) => { if (!ok) throw new Error(code); };
const active = env => Boolean(env.RTG_HEAP_PROFILE_DIR);
function identity(env) {
  const candidate = env.RTG_PERFORMANCE_COMMIT, tooling = env.RTG_PERFORMANCE_WORKFLOW_COMMIT;
  check(/^[a-f0-9]{40}$/.test(candidate || '') && /^[a-f0-9]{40}$/.test(tooling || ''), 'heap-identity');
  return { candidate, tooling };
}
function read(file, limit = MAX_BYTES) {
  const st = fs.lstatSync(file);
  check(st.isFile() && st.size <= limit, 'heap-file-boundary');
  return fs.readFileSync(file);
}
function write(file, value, limit = MAX_BYTES) {
  const bytes = Buffer.from(JSON.stringify(value));
  check(bytes.length <= limit, 'heap-output-limit');
  fs.writeFileSync(file, bytes, { flag: 'wx', mode: 0o600 });
  return { file: path.basename(file), bytes: bytes.length, sha256: sha(bytes) };
}
function sanitize(profile, root) {
  const ids = new Set();
  const number = n => { check(integer(n), 'heap-profile-number'); return n; };
  function frame(f) {
    check(f && integer(f.lineNumber, -1) && integer(f.columnNumber, -1), 'heap-frame');
    let url = typeof f.url === 'string' ? f.url : '';
    if (url.startsWith('file://')) { try { url = require('node:url').fileURLToPath(url); } catch (_) { url = ''; } }
    const relative = path.relative(root, url);
    if (path.isAbsolute(url) && !relative.startsWith('..') && !path.isAbsolute(relative) &&
        /^(server|scripts|node_modules)\/[a-zA-Z0-9_@./+-]+\.(?:c?js|mjs)$/.test(relative)) url = relative;
    else if (!/^node:[a-zA-Z0-9_./-]+$/.test(url)) url = '<external>';
    // Namen kunnen door runtime-invoer worden afgeleid. Alleen codeposities
    // worden geëxporteerd; objectwaarden, functionName en scriptId nooit.
    return { functionName: '', url, lineNumber: f.lineNumber, columnNumber: f.columnNumber };
  }
  function node(n, depth) {
    check(n && depth < 256 && ids.size < 32768 && Array.isArray(n.children), 'heap-profile-tree');
    const id = number(n.id); check(!ids.has(id), 'heap-profile-duplicate-node'); ids.add(id);
    return { id, callFrame: frame(n.callFrame), selfSize: number(n.selfSize), children: n.children.map(c => node(c, depth + 1)) };
  }
  check(profile && Array.isArray(profile.samples) && profile.samples.length <= 100000, 'heap-profile-samples');
  const head = node(profile.head, 0), ordinals = new Set();
  const samples = profile.samples.map(s => {
    check(s && ids.has(s.nodeId) && !ordinals.has(s.ordinal), 'heap-profile-sample-node');
    const ordinal = number(s.ordinal); ordinals.add(ordinal);
    return { size: number(s.size), nodeId: number(s.nodeId), ordinal };
  });
  return { head, samples };
}
const sequences = new Map();
function vraag(pid, gcOut, phase, env = process.env) {
  if (!active(env)) return null;
  const seq = (sequences.get(pid) || 0) + 1;
  check(integer(pid, 1) && PHASES[seq - 1] === phase, 'heap-phase-order');
  const request = { ...identity(env), pid, seq, phase, nonce: crypto.randomBytes(16).toString('hex') };
  const file = gcOut + '.heap-request', ack = gcOut + '.heap-ack';
  if (fs.existsSync(ack)) { read(ack, 4096); fs.unlinkSync(ack); }
  write(file, request, 4096); sequences.set(pid, seq);
  return { request, ack };
}
async function wacht(pending, timeoutMs = 10000) {
  if (!pending) return;
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (fs.existsSync(pending.ack)) {
      const ack = JSON.parse(read(pending.ack, 4096));
      for (const [key, value] of Object.entries(pending.request)) check(ack[key] === value, 'heap-ack-binding');
      check(ack.status === 'OK', 'heap-diagnostic-failed'); return;
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('heap-diagnostic-timeout');
}
function verify(dir, expected) {
  try {
    const manifest = JSON.parse(read(path.join(dir, 'HEAP-DIAGNOSTIC.json'), 65536));
    check(manifest.diagnosticOnly === true && manifest.status === 'COMPLETE', 'heap-incomplete');
    check(typeof manifest.node === 'string' && /^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(manifest.node) &&
      typeof manifest.v8 === 'string' && /^\d+\.\d+\.\d+[\w.-]*$/.test(manifest.v8), 'heap-runtime-version');
    check(manifest.candidate === expected.candidate && manifest.tooling === expected.tooling && integer(manifest.pid, 1), 'heap-binding');
    check(manifest.profiles?.length === 2 && manifest.phases?.length === 3, 'heap-profile-count');
    check(manifest.samplingInterval === 32768 && manifest.includeCollected === false, 'heap-sampling-mode');
    const nonces = new Set();
    manifest.phases.forEach((p, i) => {
      check(p.phase === PHASES[i] && p.seq === i + 1 && p.status === 'OK' && /^[a-f0-9]{32}$/.test(p.nonce) && !nonces.has(p.nonce), 'heap-phase-proof');
      nonces.add(p.nonce);
    });
    manifest.profiles.forEach((p, i) => {
      check(p.file === 'round-' + (i + 1) + '.heapprofile.json', 'heap-profile-path');
      const bytes = read(path.join(dir, p.file));
      check(bytes.length === p.bytes && sha(bytes) === p.sha256, 'heap-profile-digest');
      const body = JSON.parse(bytes);
      const fields = ['candidate', 'tooling', 'pid', 'diagnosticOnly', 'node', 'v8', 'samplingInterval', 'includeCollected', 'seq', 'nonce', 'timestamp', 'profile'];
      check(Object.keys(body).length === fields.length && Object.keys(body).every(k => fields.includes(k)), 'heap-profile-fields');
      check(body.diagnosticOnly === true && body.candidate === expected.candidate && body.tooling === expected.tooling &&
        body.pid === manifest.pid && body.seq === i + 2 && body.nonce === manifest.phases[i + 1].nonce &&
        body.node === manifest.node && body.v8 === manifest.v8 &&
        body.samplingInterval === 32768 && body.includeCollected === false, 'heap-profile-binding');
      // Canonical exported profiles contain only this schema. Sanitizing again
      // may not remove or replace anything: forged payloads fail closed.
      const restored = restoreUrls(body.profile);
      check(JSON.stringify(sanitize(restored, '/rtg')) === JSON.stringify(body.profile), 'heap-profile-schema');
    });
    return { status: 'COMPLETE', manifestSha256: sha(read(path.join(dir, 'HEAP-DIAGNOSTIC.json'), 65536)), profiles: manifest.profiles };
  } catch (e) { return { status: 'INCOMPLETE', reason: /^heap-[a-z-]+$/.test(e.message) ? e.message : 'heap-evidence-unreadable' }; }
}
function restoreUrls(profile) {
  // Only used to validate already-normalized code locations, never to load code.
  const copy = JSON.parse(JSON.stringify(profile));
  const visit = n => {
    if (/^(server|scripts|node_modules)\//.test(n.callFrame.url)) n.callFrame.url = '/rtg/' + n.callFrame.url;
    n.children.forEach(visit);
  };
  visit(copy.head); return copy;
}
module.exports = { MAX_BYTES, PHASES, active, identity, read, write, sha, check, sanitize, vraag, wacht, verify };
