/* Magnaat na 1.0: SAMEN IN EEN OUDWIJK (./server/kern/magnaat-leven/stad.js).
   Twee tot vier spelers in een stad, ieder met een eigen leven en eigen boeken.
   Wat hier vastligt:
   - binnenkomen met een code, alleen zolang de stad wacht; beginnen doet wie hem
     maakte, vanaf twee spelers; hooguit vier; een stad tegelijk;
   - de dag gaat door als iedereen klaar is -- de echte klok telt niet;
   - de andere spelers zijn je concurrenten op de markt, en die koop je niet over;
   - wie vertrekt, laat de rest niet wachten;
   - na de laatste dag staan de verhalen naast elkaar in binnenkomstvolgorde, en
     na afloop verdwijnt de stad met de levens erin;
   - een sessiesleutel verlaat de module nooit, en elk grootboek klopt;
   - de zes routes werken met een ledensessie op een echte server. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { maakLeven } = require('../server/kern/magnaat-leven');
const { maakStad, DUUR, MAX } = require('../server/kern/magnaat-leven/stad');
const { startServer } = require('./helper');
const { aandelen } = require('../server/kern/magnaat-leven/markt');

function wereld() {
  let t = 1e12;
  const db = { data: {} };
  const L = maakLeven({ db, nu: () => t });
  const seinen = [];
  const S = maakStad({ eigen: L.intern.eigen, leven: L, crypto, codenaamVan: (k) => 'Codenaam-' + k.slice(-1), nu: () => t,
    sseToCustomer: (key, soort, data) => seinen.push({ key, soort, data }) });
  return { db, L, S, seinen, tijd: (ms) => { t += ms; } };
}
function samen(w, n = 2, b = {}) {
  const code = w.S.maak('sleutel-A', b).stad.code;
  for (let i = 1; i < n; i++) assert.ok(!w.S.doe('sleutel-' + 'BCD'[i - 1], { code }).error);
  const r = w.S.start('sleutel-A');
  assert.ok(!r.error, r.error);
  return code;
}
const klaarAlle = (w, keys) => keys.map(k => w.S.actie(k, { actie: 'slaap' }));

test('binnenkomen met een code, beginnen vanaf twee, hooguit vier, en een stad tegelijk', () => {
  const w = wereld();
  const r = w.S.maak('sleutel-A', { moeilijkheid: 'zwaar', begin: 'student' });
  const code = r.stad.code;
  assert.match(code, /^[A-Z0-9]{6}$/);
  assert.equal(r.leven, null, 'een wachtende stad heeft nog geen leven');
  assert.match(w.S.start('sleutel-A').error, /vanaf 2 spelers/);
  assert.match(w.S.doe('sleutel-B', { code: 'XXXXXX' }).error, /klopt niet/);
  assert.ok(!w.S.doe('sleutel-B', { code: code.toLowerCase() }).error, 'de code mag in kleine letters');
  assert.equal(w.S.doe('sleutel-B', { code }).stad.spelers.length, 2, 'nog een keer meedoen geeft geen tweede plek');
  assert.match(w.S.maak('sleutel-B', {}).error, /al in een stad/);
  assert.match(w.S.start('sleutel-B').error, /Wie de stad maakte/);
  w.S.doe('sleutel-C', { code }); w.S.doe('sleutel-D', { code });
  assert.match(w.S.doe('sleutel-E', { code }).error, new RegExp('hooguit ' + MAX));
  const s = w.S.start('sleutel-A');
  assert.equal(s.stad.status, 'loopt');
  assert.equal(s.stad.code, null, 'een lopende stad laat zijn code niet meer zien');
  assert.match(w.S.doe('sleutel-E', { code }).error, /al begonnen/);
  const st = w.L.intern.haal('stad:' + code + ':1');
  assert.deepEqual([st.moeilijkheid, st.start, st.stad.plek], ['zwaar', 'student', 1], 'iedereen begint hetzelfde');
  assert.match(w.S.start('sleutel-A').error, /geen stad die op je wacht/);
});

test('de dag gaat door als iedereen klaar is, en de echte klok telt niet', () => {
  const w = wereld();
  samen(w);
  w.tijd(10 * 86400000);
  assert.ok(!w.S.actie('sleutel-A', { actie: 'kies', aanbod: 'foto' }).error);
  assert.equal(w.S.staat('sleutel-A').leven.dag, 1, 'tien echte dagen later, en na een zet, is het nog dag 1');
  const a = w.S.actie('sleutel-A', { actie: 'slaap' });
  assert.deepEqual([a.stad.dag, a.stad.wachtOp, a.leven.dag], [1, 1, 1], 'wie klaar is wacht op de rest');
  assert.equal(w.S.actie('sleutel-A', { actie: 'slaap' }).herhaald, true, 'twee keer afsluiten is geen tweede dag');
  const b = w.S.actie('sleutel-B', { actie: 'slaap' });
  assert.deepEqual([b.stad.dag, b.leven.dag, w.S.staat('sleutel-A').leven.dag], [2, 2, 2], 'de laatste zet de stad verder, voor iedereen');
  assert.equal(b.stad.wachtOp, 2, 'en de nieuwe dag begint niemand klaar');
  for (const actie of ['opnieuw', 'tempo', 'doorspoelen', 'moeilijkheid', 'start']) {
    assert.match(w.S.actie('sleutel-A', { actie, zeker: true }).error, /gedeelde stad/);
  }
  assert.ok(w.seinen.some(x => x.key === 'sleutel-B' && x.data.scope === 'magnaat-stad' && x.data.dag === 2), 'iedereen krijgt een seintje');
});

test('de andere speler is je concurrent op de markt, met zijn eigen naam en prijs, en die koop je niet over', () => {
  const w = wereld();
  const code = samen(w);
  const b = w.L.intern.haal('stad:' + code + ':1');
  w.S.actie('sleutel-B', { actie: 'kies', aanbod: 'foto' });
  w.S.actie('sleutel-A', { actie: 'kies', aanbod: 'foto' });
  b.onderneming = { naam: 'Studio Buurman', sinds: 1 };
  b.handel = Object.assign({}, b.handel, { prijs: 1234 });
  const mk = w.S.staat('sleutel-A').leven.wereld.markt.concurrenten;
  assert.deepEqual(mk.map(c => [c.naam, c.speler]), [['Studio Buurman', true], ['Kader & Co', false], ['Klikfabriek', false]]);
  assert.equal(mk[0].prijs, 1234, 'hij verkoopt voor zijn eigen prijs');
  const aandeel = (prijs) => { b.handel.prijs = prijs; w.S.staat('sleutel-A'); return aandelen(w.L.intern.haal('stad:' + code + ':0')).licht; };
  assert.ok(aandeel(1000) > aandeel(100000), 'en die prijs telt mee in wie de kopers kiezen');
  const a = w.L.intern.haal('stad:' + code + ':0');
  a.zelfstandig = 1;
  assert.match(w.S.actie('sleutel-A', { actie: 'overname', bedrijf: 'licht' }).error, /Een andere speler neem je niet over/);
  const eigen = w.L.intern.haal('stad:' + code + ':0');
  assert.equal(w.L.verifieer('stad:' + code + ':0').ok, true);
  assert.ok(eigen.kas > 0);
});

test('een speler die te laat leverde, laat een klant naar de ander gaan', () => {
  const w = wereld();
  const code = samen(w);
  w.S.actie('sleutel-A', { actie: 'kies', aanbod: 'foto' });
  w.S.actie('sleutel-B', { actie: 'kies', aanbod: 'foto' });
  const a = w.L.intern.haal('stad:' + code + ':0'), b = w.L.intern.haal('stad:' + code + ':1');
  a.onderneming = { naam: 'Studio A', sinds: 1 };
  b.onderneming = { naam: 'Studio Traag', sinds: 1 };
  let voor = 0;
  for (let i = 0; i < 21; i++) {
    b.deals.push({ id: 'dl' + i, klantId: 'x', klant: 'x', fase: 'betaald', laatGeleverd: true, geleverdOp: b.dag, rondes: [], gedaan: 0 });
    for (const d of a.deals) if (d.fase === 'kans') d.fase = 'afgehaakt';
    klaarAlle(w, ['sleutel-A', 'sleutel-B']);
    voor += a.meldingen.filter(m => m.dag === a.dag && /zat bij Studio Traag/.test(m.tekst)).length;
  }
  assert.ok(voor >= 2, 'klanten van een speler die te laat leverde, komen bij de ander: ' + voor);
});

test('wie vertrekt laat de rest niet wachten; de maker die vertrekt voor de start heft de stad op', () => {
  const w = wereld();
  const c1 = w.S.maak('sleutel-A', {}).stad.code;
  w.S.doe('sleutel-B', { code: c1 });
  assert.ok(!w.S.verlaat('sleutel-B').error);
  assert.equal(w.S.staat('sleutel-A').stad.spelers.length, 1);
  w.S.verlaat('sleutel-A');
  assert.equal(w.S.staat('sleutel-A').stad, null, 'opgeheven');
  assert.match(w.S.verlaat('sleutel-A').error, /niet in een stad/);

  const w2 = wereld();
  samen(w2, 3);
  w2.S.actie('sleutel-A', { actie: 'slaap' });
  w2.S.actie('sleutel-B', { actie: 'slaap' });
  const weg = w2.S.verlaat('sleutel-C');
  assert.ok(!weg.error);
  const s = w2.S.staat('sleutel-A').stad;
  assert.equal(s.dag, 2, 'de laatste die ontbrak, vertrok: de dag gaat door');
  assert.deepEqual(s.spelers.map(p => p.weg), [false, false, true]);
  assert.match(w2.S.actie('sleutel-C', { actie: 'slaap' }).error, /niet in een lopende stad/);
});

test('na de laatste dag de verhalen naast elkaar, geen ranglijst, en daarna verdwijnt de stad', () => {
  const w = wereld();
  const code = samen(w);
  for (let i = 0; i < DUUR; i++) klaarAlle(w, ['sleutel-A', 'sleutel-B']);
  const s = w.S.staat('sleutel-B').stad;
  assert.equal(s.status, 'klaar');
  assert.deepEqual(s.verhalen.map(v => v.naam), ['Codenaam-A', 'Codenaam-B'], 'in binnenkomstvolgorde');
  assert.ok(s.verhalen.every(v => v.einde && Array.isArray(v.mijlpalen)));
  assert.match(s.grens, /Geen ranglijst/);
  assert.match(w.S.actie('sleutel-A', { actie: 'plan' }).error, /afgelopen/);
  assert.ok(!w.S.maak('sleutel-A', {}).error, 'na afloop kun je een nieuwe stad maken');
  w.tijd(29 * 86400000);
  w.S.maak('sleutel-C', {});
  assert.equal(w.db.data.magnaatSteden[code], undefined, 'na afloop verdwijnt de stad');
  assert.ok(!Object.keys(w.db.data.magnaatLeven).some(k => k.startsWith('stad:' + code)), 'met de levens erin');
});

test('een sessiesleutel verlaat de module nooit, en elk grootboek klopt', () => {
  const w = wereld();
  const code = samen(w, 3);
  w.S.actie('sleutel-A', { actie: 'kies', aanbod: 'websites' });
  klaarAlle(w, ['sleutel-A', 'sleutel-B', 'sleutel-C']);
  for (const k of ['sleutel-A', 'sleutel-B', 'sleutel-C']) {
    const uit = JSON.stringify(w.S.staat(k)) + JSON.stringify(w.S.actie(k, { actie: 'slaap' }));
    assert.ok(!/sleutel-/.test(uit), 'een sleutel in het antwoord aan ' + k);
  }
  assert.ok(!w.seinen.some(x => /sleutel-/.test(JSON.stringify(x.data))), 'en niet in een seintje');
  for (const p of [0, 1, 2]) assert.equal(w.L.verifieer('stad:' + code + ':' + p).ok, true);
});

test('de zes routes werken met een ledensessie op een echte server', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stad-'));
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const post = (pad, body, tok) => fetch(base + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
      body: JSON.stringify(body || {}) });
    const lid = async (n) => (await (await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Stad Speler ' + n, email: 'stad' + n + '@x.nl', phone: '061234567' + n, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }) })).json()).token;
    assert.equal((await post('/api/member/magnaat/stad/staat')).status, 401);
    const a = await lid(1), b = await lid(2);
    assert.deepEqual(await (await post('/api/member/magnaat/stad/staat', {}, a)).json(), { stad: null, leven: null });
    const code = (await (await post('/api/member/magnaat/stad/maak', {}, a)).json()).stad.code;
    assert.equal((await post('/api/member/magnaat/stad/doe', { code }, b)).status, 200);
    const s = await (await post('/api/member/magnaat/stad/start', {}, a)).json();
    assert.equal(s.stad.status, 'loopt');
    assert.ok(s.leven.geld.bank > 0);
    assert.equal((await post('/api/member/magnaat/stad/actie', { actie: 'slaap' }, a)).status, 200);
    const d = await (await post('/api/member/magnaat/stad/actie', { actie: 'slaap' }, b)).json();
    assert.equal(d.stad.dag, 2);
    assert.equal((await post('/api/member/magnaat/stad/actie', { actie: 'opnieuw', zeker: true }, a)).status, 400);
    const weg = await (await post('/api/member/magnaat/stad/verlaat', {}, b)).json();
    assert.deepEqual(await (await post('/api/member/magnaat/stad/verlaat', {}, b)).json(), Object.assign({ herhaald: true }, weg), 'een dubbeltik krijgt het eerste antwoord terug (de idempotentiepoort)');
    assert.deepEqual(await (await post('/api/member/magnaat/stad/staat', {}, b)).json(), { stad: null, leven: null }, 'en wie vertrok, speelt niet meer mee');
    assert.equal((await (await post('/api/member/magnaat/stad/staat', {}, a)).json()).stad.spelers[1].weg, true);
  } finally {
    try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* Met meer dan een serverproces: elke zet loopt door een collectietransactie op
   magnaatSteden (./server/kern/magnaat-leven/stad-slot.js). De nagemaakte opslag
   hieronder doet wat PostgreSQL doet: wachten op het slot, het werk op een VERSE
   KOPIE draaien, en pas daarna vastleggen -- of niet, als de commit mislukt. */
test('onder een slot: twee spelers die tegelijk als laatste klaar zijn, zetten de stad precies een dag verder', async () => {
  let t = 1e12;
  const db = { data: {} };
  /* Zoals server/opzet/kernlaag7-ruimtes.js: binnen het slot onthoudt het leven alleen dat er bewaard moet worden. */
  const opslag = { inSlot: false, nodig: false, bewaard: 0, naSlot() { if (this.nodig) { this.nodig = false; this.bewaard++; } } };
  const L = maakLeven({ db, nu: () => t, save: () => { if (opslag.inSlot) opslag.nodig = true; } });
  const log = [];
  let rij = Promise.resolve(), faal = false;
  const bewerkCollectie = (sleutel, werk) => {
    const beurt = rij.then(async () => {
      await new Promise(r => setImmediate(r));
      const kopie = JSON.parse(JSON.stringify(db.data[sleutel] || {}));
      const uit = werk(kopie);
      if (faal) throw new Error('commit mislukt');
      db.data[sleutel] = kopie;
      log.push('commit');
      return uit;
    });
    rij = beurt.catch(() => {});
    return beurt;
  };
  const S = maakStad({ eigen: L.intern.eigen, leven: L, crypto, nu: () => t, bewerkCollectie, opslag,
    sseToCustomer: (key, soort, data) => log.push('sein:' + key + ':' + data.dag) });
  const code = (await S.maak('sleutel-A', {})).stad.code;
  await S.doe('sleutel-B', { code });
  assert.equal((await S.start('sleutel-A')).stad.status, 'loopt');
  log.length = 0;
  const [a, b] = await Promise.all([S.actie('sleutel-A', { actie: 'slaap' }), S.actie('sleutel-B', { actie: 'slaap' })]);
  assert.deepEqual([a.stad.dag, b.stad.dag].sort(), [1, 2], 'de een wacht nog, de ander zet de stad verder');
  assert.equal(db.data.magnaatSteden[code].dag, 2, 'precies een dag verder, niet twee');
  assert.equal(L.intern.haal('stad:' + code + ':0').dag, 2);
  assert.ok(log.indexOf('commit') < log.findIndex(x => x.startsWith('sein:')), 'een seintje gaat pas na de commit uit');
  assert.ok(opslag.bewaard > 0, 'de levens zijn bewaard na het slot, niet erin');
  faal = true; log.length = 0;
  await assert.rejects(S.actie('sleutel-A', { actie: 'slaap' }));
  assert.deepEqual(log, [], 'mislukt de commit, dan gaat er geen seintje uit');
  assert.equal(db.data.magnaatSteden[code].klaar[0], undefined, 'en is er niets vastgelegd');
});
