/* LUISTERAARS EN HAKEN DIE NIET MEEGROEIEN.

   Een MaxListenersExceededWarning is in dit huis geen ruis maar een meetpunt:
   hij betekent dat er per verzoek of per opstart een luisteraar bijkomt die
   nooit weggaat. Twee plekken zijn hier beproefd, en bij beide staat de
   grens van Node gewoon op tien -- er wordt niets opgehoogd om de waarschuwing
   stil te krijgen.

   1. scripts/lib/wegwerpserver.js hing bij ELKE start process.on('exit') en
      haalde hem nooit weg. Twaalf wegwerpservers na elkaar (en netjes
      opgeruimd) gaven twaalf exit-luisteraars en de waarschuwing. Nu is er een
      haak per proces, en ruimt die bij het afsluiten op wat nog loopt.
   2. Een echte server: een reeks verzoeken met een Idempotency-Key op leden-
      en kantoorroutes, plus live-stromen die open- en dichtgaan, mag op
      stderr geen enkele MaxListenersExceededWarning opleveren (herkeuring N11
      en N22: de naverwerkers van een antwoord hangen samen aan EEN
      'finish'-luisteraar, server/lib/antwoord-einde.js).

   Draai los: node --test test/luisteraarlek.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { startServer, stop, kantoorAlsPersoon, stroomAdres } = require('./helper');

const STUB = path.join(os.tmpdir(), 'rtg-luisteraarlek-stub-' + process.pid + '.js');
fs.writeFileSync(STUB, "require('http').createServer((q, s) => s.end('ok'))" +
  ".listen(Number(process.env.PORT), '127.0.0.1');\n");
test.after(() => { try { fs.unlinkSync(STUB); } catch (e) {} });

test('1. twaalf wegwerpservers na elkaar laten het aantal exit-luisteraars niet groeien', async () => {
  const wegwerp = require('../scripts/lib/wegwerpserver');
  const waarschuwingen = [];
  const vang = w => { if (w && w.name === 'MaxListenersExceededWarning') waarschuwingen.push(w.message); };
  process.on('warning', vang);
  const voor = process.listenerCount('exit');
  const mappen = [];
  try {
    for (let i = 0; i < 12; i++) {
      const s = await wegwerp.start({ programma: STUB, wachtMs: 20000 });
      mappen.push(s.datamap);
      s.klaar();
      s.klaar(); // tweemaal opruimen mag, en doet de tweede keer niets
    }
  } finally { process.removeListener('warning', vang); }
  await new Promise(r => setImmediate(r)); // een waarschuwing komt in een volgende tik
  const groei = process.listenerCount('exit') - voor;
  assert.ok(groei <= 1, 'er kwamen ' + groei + ' exit-luisteraars bij voor twaalf servers; hoogstens een (de ene haak)');
  assert.deepEqual(waarschuwingen, [], 'geen MaxListenersExceededWarning');
  assert.equal(mappen.filter(m => fs.existsSync(m)).length, 0, 'elke datamap is opgeruimd');
});

test('2. een server die NIET is opgeruimd, gaat bij het afsluiten van het proces toch weg', async () => {
  /* De ene haak moet doen wat de twaalf deden: wat nog loopt bij exit opruimen.
     In een eigen proces, want dit proces mag niet stoppen. */
  const code = "const w = require(" + JSON.stringify(path.join(__dirname, '..', 'scripts', 'lib', 'wegwerpserver')) + ");" +
    "(async () => { const a = await w.start({ programma: " + JSON.stringify(STUB) + ", wachtMs: 20000 });" +
    "const b = await w.start({ programma: " + JSON.stringify(STUB) + ", wachtMs: 20000 });" +
    "console.log(JSON.stringify({ pids: [a.kind.pid, b.kind.pid], mappen: [a.datamap, b.datamap], " +
    "haken: process.listenerCount('exit') })); process.exit(0); })();";
  const r = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8', timeout: 60000 });
  assert.equal(r.status, 0, r.stderr);
  const uit = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.equal(uit.haken, 1, 'twee servers, een exit-haak');
  const leeft = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
  const eind = Date.now() + 5000;
  while (uit.pids.some(leeft) && Date.now() < eind) await new Promise(k => setTimeout(k, 50));
  assert.deepEqual(uit.pids.filter(leeft), [], 'beide kindprocessen zijn gestopt');
  assert.deepEqual(uit.mappen.filter(m => fs.existsSync(m)), [], 'beide datamappen zijn weg');
});

test('3. een echte server: herhaalde verzoeken met een Idempotency-Key en live-stromen geven geen MaxListenersExceededWarning', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  let stderr = '';
  srv.child.stderr.on('data', d => { stderr += d; });
  const post = (pad, body, tok, extra) => fetch(srv.base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}, extra || {}),
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  try {
    const lid = (await post('/api/login', { tier: 'business' })).body.token;
    const kantoor = await kantoorAlsPersoon(srv.base);
    assert.ok(lid && kantoor, 'een lid en een kantoormens staan klaar');
    let n = 0;
    for (let i = 0; i < 15; i++) {
      for (const [pad, tok] of [['/api/notifications/read', lid], ['/api/state', lid],
        ['/api/office/incident/beslis', kantoor], ['/api/office/state', kantoor]]) {
        const r = await post(pad, { id: 'bestaat-niet' }, tok, { 'Idempotency-Key': 'lek-' + i + '-' + (++n) });
        assert.ok(r.status < 500, pad + ' gaf ' + r.status);
      }
      // en een live-stroom die open- en dichtgaat
      const ac = new AbortController();
      const s = await fetch(await stroomAdres(srv.base, '/api/stream', lid), { signal: ac.signal });
      assert.equal(s.status, 200);
      await s.body.getReader().read();
      ac.abort();
    }
    await new Promise(r => setTimeout(r, 300));
    assert.doesNotMatch(stderr, /MaxListenersExceededWarning/, 'de server meldde een groeiende luisteraar:\n' +
      stderr.split('\n').filter(l => /MaxListeners/.test(l)).slice(0, 3).join('\n'));
  } finally { await stop(srv); }
});
