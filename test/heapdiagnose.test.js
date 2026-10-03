'use strict';
/* Alleen kleine protocolfixtures; geen server, storm of prestatienormmeting. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const H = require('../scripts/lib/heapdiagnose'), maak = require('../scripts/heap-profile-hook');
const C = 'a'.repeat(40), W = 'b'.repeat(40), root = path.resolve(__dirname, '..');
let pid = 800000;
function fixture(t, options = {}) {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'heapdiag-')));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const data = path.join(home, 'data'); fs.mkdirSync(data);
  const env = { NODE_ENV: 'test', GITHUB_ACTIONS: 'true', RTG_DEMO: '1', GITHUB_WORKSPACE: home,
    RTG_DATA_DIR: data, RTG_GC_OUT: path.join(data, 'gc.json'),
    RTG_HEAP_PROFILE_DIR: path.join(home, 'artifacts/performance-debt/heap'),
    RTG_PERFORMANCE_COMMIT: C, RTG_PERFORMANCE_WORKFLOW_COMMIT: W };
  const calls = [], id = ++pid;
  const profile = () => ({ head: { id: 1, selfSize: 32768,
    callFrame: { functionName: 'PRIVATE_VALUE', scriptId: 'PRIVATE_ID', url: path.join(root, 'server/server.js'), lineNumber: 1, columnNumber: 2 },
    children: [] }, samples: [{ size: 32768, nodeId: 1, ordinal: 1 }], environment: 'PRIVATE_ENV' });
  const session = { connect() {}, disconnect() { calls.push('disconnect'); },
    post(method, params, cb) { calls.push({ method, params });
      cb(options.error ? new Error('PRIVATE_FAILURE') : null, { profile: profile() }); } };
  const hook = maak({ env, pid: id, session });
  const phase = async name => {
    const pending = H.vraag(id, env.RTG_GC_OUT, name, env);
    await hook(); await H.wacht(pending, 100); return pending;
  };
  return { home, env, id, calls, hook, phase, dir: env.RTG_HEAP_PROFILE_DIR, expected: { candidate: C, tooling: W } };
}
async function complete(f) { for (const p of H.PHASES) await f.phase(p); }

test('uitgeschakeld doet niets; productie en gemengde CPU-diagnose worden geweigerd', t => {
  assert.equal(maak({ env: {} }), null); assert.equal(H.vraag(1, '/niet-bestaan', 'start', {}), null);
  const f = fixture(t);
  assert.throws(() => maak({ env: { ...f.env, NODE_ENV: 'production' } }), /heap-test-only/);
  assert.throws(() => maak({ env: { ...f.env, RTG_CPU_PROFILE_DIR: '/cpu' } }), /heap-isolation/);
  assert.throws(() => maak({ env: { ...f.env, RTG_HEAP_PROFILE_DIR: '/tmp' } }), /heap-output-directory/);
});

test('start/sample/stop bindt twee gesaniteerde profielen en behoudt exacte GC-samplingopties', async t => {
  const f = fixture(t); await complete(f);
  assert.equal(H.verify(f.dir, f.expected).status, 'COMPLETE');
  const start = f.calls.find(c => c.method === 'HeapProfiler.startSampling');
  assert.deepEqual(start.params, { samplingInterval: 32768, includeObjectsCollectedByMajorGC: false, includeObjectsCollectedByMinorGC: false });
  for (const n of [1, 2]) {
    const text = fs.readFileSync(path.join(f.dir, `round-${n}.heapprofile.json`), 'utf8');
    assert.doesNotMatch(text, /PRIVATE|environment|scriptId/);
    assert.match(text, /server\/server.js/); assert.ok(Buffer.byteLength(text) < H.MAX_BYTES);
  }
  assert.throws(() => H.vraag(f.id, f.env.RTG_GC_OUT, 'sample', f.env), /heap-phase-order/);
});

test('verkeerde PID, identiteit, volgorde en nonce leveren geen compleet bewijs', async t => {
  for (const patch of [{ pid: 12 }, { candidate: W }, { tooling: C }, { seq: 2 }, { phase: 'stop' }, { nonce: 'bad' }]) {
    const f = fixture(t), pending = H.vraag(f.id, f.env.RTG_GC_OUT, 'start', f.env);
    fs.writeFileSync(f.env.RTG_GC_OUT + '.heap-request', JSON.stringify({ ...pending.request, ...patch }));
    await f.hook(); await assert.rejects(H.wacht(pending, 100), /heap-ack-binding|heap-diagnostic-failed/);
    assert.equal(H.verify(f.dir, f.expected).status, 'INCOMPLETE');
  }
});

test('ontbrekende of vervalste ack en profilerfout falen gesloten', async t => {
  const f = fixture(t), p = H.vraag(f.id, f.env.RTG_GC_OUT, 'start', f.env);
  await assert.rejects(H.wacht(p, 1), /heap-diagnostic-timeout/);
  H.write(p.ack, { ...p.request, nonce: '0'.repeat(32), status: 'OK' });
  await assert.rejects(H.wacht(p, 100), /heap-ack-binding/);
  const broken = fixture(t, { error: true });
  await assert.rejects(broken.phase('start'), /heap-diagnostic-failed/);
  assert.equal(H.verify(broken.dir, broken.expected).status, 'INCOMPLETE');
  assert.doesNotMatch(fs.readFileSync(path.join(broken.dir, 'HEAP-DIAGNOSTIC.json'), 'utf8'), /PRIVATE_FAILURE/);
});

test('bytes, kandidaatbinding, sampleverwijzingen en extra payloads worden onafhankelijk geweigerd', async t => {
  const f = fixture(t); await complete(f);
  assert.equal(H.verify(f.dir, { candidate: W, tooling: W }).status, 'INCOMPLETE');
  const file = path.join(f.dir, 'round-1.heapprofile.json'), original = fs.readFileSync(file);
  fs.appendFileSync(file, ' '); assert.equal(H.verify(f.dir, f.expected).status, 'INCOMPLETE');
  const manifestFile = path.join(f.dir, 'HEAP-DIAGNOSTIC.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile));
  for (const mutate of [b => { b.payload = 'PRIVATE'; }, b => { b.profile.samples[0].nodeId = 99; }, b => { b.profile.head.callFrame.functionName = 'PRIVATE'; }, ...['node', 'v8'].map(k => b => { b[k] += '-wrong'; })]) {
    const body = JSON.parse(original); mutate(body); const bytes = Buffer.from(JSON.stringify(body));
    fs.writeFileSync(file, bytes); manifest.profiles[0].sha256 = H.sha(bytes); manifest.profiles[0].bytes = bytes.length;
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));
    assert.equal(H.verify(f.dir, f.expected).status, 'INCOMPLETE', 'herhashen omzeilt binding niet');
  }
});

test('outputlimiet, symlink en vervalste COMPLETE zonder twee profielen zijn geen bewijs', async t => {
  const f = fixture(t), file = path.join(f.home, 'te-groot');
  assert.throws(() => H.write(file, 'x'.repeat(H.MAX_BYTES)), /heap-output-limit/);
  assert.equal(fs.existsSync(file), false);
  await f.phase('start');
  const m = path.join(f.dir, 'HEAP-DIAGNOSTIC.json'), body = JSON.parse(fs.readFileSync(m));
  body.status = 'COMPLETE'; fs.writeFileSync(m, JSON.stringify(body));
  assert.equal(H.verify(f.dir, f.expected).status, 'INCOMPLETE');
  const link = path.join(f.home, 'link'); fs.symlinkSync(m, link);
  assert.throws(() => H.read(link), /heap-file-boundary/);
});

test('prepare/evaluate blijven diagnostisch bij ontbrekende profielen en verdwenen vlag', t => {
  const f = fixture(t), { assess, evaluate } = require('../scripts/performance-debt');
  const norm = { prestatieBron: '4k/17g/linux/sqlite', prestatieKalibratie: 10,
    prestatie: { p99Ms: 144, eventLoopP99Ms: 64.8, doorvoerPerSec: 336, herstelSeconden: 1, verhalenSlaagPctStorm: 100, geheugenHellingMBPerMin: 0 } };
  const measurement = { stempel: { commit: C.slice(0, 9), boomVuil: false }, modus: 'sqlite',
    machine: { kernen: 4, geheugenGB: 17, platform: 'linux', kalibratieBasisMs: 10 }, oordeel: 'PASS', gezakteDrempels: 0,
    meters: { ...norm.prestatie, stormDuurSec: 180, endpointsOnbereikt: 0 } };
  assert.equal(assess(C, norm, measurement).status, 'PASS');
  assert.equal(assess(C, norm, { ...measurement, diagnosticOnly: true }).status, 'BLOCKED');
  const out = path.dirname(f.dir);
  fs.writeFileSync(path.join(f.home, 'NORM.json'), JSON.stringify(norm));
  fs.writeFileSync(path.join(f.home, 'LAATSTE_METING.json'), JSON.stringify(measurement));
  fs.writeFileSync(path.join(out, 'RUN-IDENTITY.json'), JSON.stringify({ diagnosticOnly: true, heapRequested: true, toolingCommit: W }));
  const proof = evaluate(f.home, { RTG_PERFORMANCE_COMMIT: C });
  assert.equal(proof.status, 'BLOCKED'); assert.equal(proof.heapDiagnostic.status, 'INCOMPLETE');
  assert.match(proof.blockers.join(' '), /Profiler is active/);
  const source = fs.readFileSync(require.resolve('../scripts/performance-debt'), 'utf8');
  const module = { exports: {} }, req = require('node:module').createRequire(require.resolve('../scripts/performance-debt'));
  require('node:vm').runInNewContext(source, { module, require: n => n === 'node:child_process'
    ? { execFileSync: () => C } : req(n), process });
  assert.throws(() => module.exports.prepare(f.home, { ...f.env, LEK_RONDES: '2' }), /heap-stale-output/);
  assert.throws(() => module.exports.prepare(f.home, { ...f.env, LEK_RONDES: '3' }), /heap-workload-mode/);
  fs.rmdirSync(f.dir);
  for (const file of ['scripts/beproeving.js', 'scripts/gc-hook.js', 'scripts/heap-profile-hook.js',
    'scripts/lib/heapdiagnose.js', 'scripts/performance-debt.js', '.github/workflows/ronde.yml']) {
    const to = path.join(f.home, file); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(root, file), to);
  }
  const prepared = module.exports.prepare(f.home, { ...f.env, LEK_RONDES: '2' });
  assert.equal(prepared.heapRequested, true); assert.equal(prepared.diagnosticOnly, true);
  assert.equal(Object.keys(prepared.candidateToolingSha256).length, 6);
});

test('echte GC-hook en inspector verwerken drie eigen procespulsen zonder netwerk of server', t => {
  const f = fixture(t);
  const code = `const fs=require('node:fs'),H=require(process.argv[1]),env=process.env,retained=[];
    (async()=>{for(const phase of H.PHASES){const p=H.vraag(process.pid,env.RTG_GC_OUT,phase);
      if(phase!=='start')retained.push(new Array(131072).fill(42));
      process.kill(process.pid,'SIGUSR2');await H.wacht(p,1000);
      if(!(JSON.parse(fs.readFileSync(env.RTG_GC_OUT)).heapUsed>0))throw Error('gc');}
      if(H.verify(env.RTG_HEAP_PROFILE_DIR,H.identity(env)).status!=='COMPLETE')process.exitCode=2;
    })().catch(()=>{process.exitCode=3;});`;
  const run = require('node:child_process').spawnSync(process.execPath, ['--expose-gc', '-r',
    require.resolve('../scripts/gc-hook'), '-e', code, require.resolve('../scripts/lib/heapdiagnose')],
  { env: f.env, encoding: 'utf8', timeout: 10000, maxBuffer: 4096 });
  assert.equal(run.status, 0, run.stderr || String(run.error || run.signal));
  assert.equal(H.verify(f.dir, f.expected).status, 'COMPLETE');
});
