/* De Memory Engine: van leren-toets-vergeten naar onthouden.

   De beloftes die hier hard worden gemaakt:

   - een behaald leerdoel krijgt een herhaalmoment, en dat moment ligt in de
     toekomst (niet vandaag: dan zou alles meteen open staan);
   - een herhaling is DRIE vragen en loopt door dezelfde antwoordweg als een
     oefensessie, zodat een herhaalvraag er hetzelfde uitziet als een nieuwe;
   - herhalen is geen straf: de open lijst draagt geen datum en geen
     achterstand, en een mindere herhaling wist het leerdoel niet;
   - een geslaagde herhaling na een tijd is bewijs (Proof of Learning), een
     mislukte herhaling wordt NIET als bewijs vastgelegd -- dit huis houdt geen
     dossier bij van de missers van een kind;
   - bewijs van school schuift het moment vooruit en nooit naar achteren.
   Draai los: node --experimental-sqlite --test test/geheugen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const { maakGeheugen, begin, uitstel, naOphaling, INTERVALLEN, HERHAAL_VRAGEN } = require('../server/kern/onderwijs-geheugen');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geheugen-'));
const api = (pad, body) => fetch(base + '/api' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const los = (v) => { const m = String(v).match(/^(\d+) x (\d+)/); return m ? String(+m[1] * +m[2]) : 'x'; };

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Leerling Geheugen', email: 'gh' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '2005-04-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
  token = reg.token;
  if (!token) throw new Error('registratie mislukt: ' + JSON.stringify(reg).slice(0, 200));
  const ins = await api('/onderwijs/inschrijf', { fase: 'po-g5' });
  if (ins.status !== 200) throw new Error('inschrijven mislukt: ' + JSON.stringify(ins).slice(0, 200));
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------- de planning los, zonder server: hier zit de regel ---------- */
test('de reeks loopt vooruit bij een geslaagde ophaling en EEN stap terug bij een mindere', () => {
  const rij = {}; const t0 = '2026-01-01T00:00:00.000Z';
  assert.equal(begin(rij, t0), true);
  assert.equal(rij.herhaal.stap, 0);
  assert.ok(rij.herhaal.volgende > t0, 'het eerste moment ligt in de toekomst');
  assert.equal(begin(rij, t0), false, 'een tweede keer beginnen verzet niets');

  naOphaling(rij, true, t0); assert.equal(rij.herhaal.stap, 1);
  naOphaling(rij, true, t0); assert.equal(rij.herhaal.stap, 2);
  const ver = rij.herhaal.volgende;
  naOphaling(rij, false, t0);
  assert.equal(rij.herhaal.stap, 1, 'een mindere dag zet je EEN trede terug, niet naar nul');
  assert.ok(rij.herhaal.volgende < ver, 'en dan komt het eerder terug, want daar is herhalen voor');

  // de bodem: blijven missen zet je nooit onder nul, de top nooit voorbij het einde
  for (let i = 0; i < 5; i++) naOphaling(rij, false, t0);
  assert.equal(rij.herhaal.stap, 0);
  for (let i = 0; i < 20; i++) naOphaling(rij, true, t0);
  assert.equal(rij.herhaal.stap, INTERVALLEN.length - 1);
});

test('bewijs van school schuift het moment vooruit en nooit naar achteren', () => {
  const rij = {}; const t0 = '2026-01-01T00:00:00.000Z';
  begin(rij, t0);
  naOphaling(rij, true, t0); naOphaling(rij, true, t0); // stap 2: ver weg
  const ver = rij.herhaal.volgende;
  assert.equal(uitstel(rij, t0), false, 'op dezelfde dag valt er niets vooruit te schuiven');
  assert.equal(rij.herhaal.volgende, ver);
  const later = new Date(new Date(t0).getTime() + 30 * 86400000).toISOString();
  assert.equal(uitstel(rij, later), true);
  assert.ok(rij.herhaal.volgende > ver, 'wat je op school laat zien, hoef je thuis niet nog eens');
  assert.equal(rij.herhaal.stap, 2, 'uitstel raakt de reeks niet aan');
});

/* ---------- en dezelfde regels door de hele machine heen ---------- */
test('een behaald leerdoel krijgt een moment, en dat staat niet meteen open', async () => {
  let r = (await api('/leerstof/oefen', { doel: 'rekenen.g5.tafels-tot-10' })).body;
  for (let i = 0; i < 5; i++) r = (await api('/leerstof/antwoord', { antwoord: los(r.vraag) })).body;
  assert.equal(r.behaald, true);

  const h = await api('/leerstof/herhalen');
  assert.equal(h.status, 200);
  assert.equal(h.body.vragen, HERHAAL_VRAGEN);
  assert.equal(h.body.open.length, 0, 'wat je net hebt gedaan hoef je vandaag niet te herhalen');
  const later = h.body.later.find(x => x.doel === 'rekenen.g5.tafels-tot-10');
  assert.ok(later, 'maar het staat wel gepland');
  assert.ok(later.volgende > new Date().toISOString());

});

/* Herhalen is geen straf, en dat wordt in de SERVER afgedwongen en niet in het
   scherm: de open lijst draagt geen datum en geen achterstand, dus er kan er
   ook geen op een scherm belanden. Met een gemaakt paspoort, want alleen zo
   staat er echt iets open -- een lege lijst bewijst niets. */
test('een openstaande herhaling draagt geen datum en geen achterstand', () => {
  const nu = '2026-06-01T00:00:00.000Z';
  const paspoort = () => ({ doelen: {
    'oud.doel': { op: '2026-01-01T00:00:00.000Z', herhaal: { stap: 2, volgende: '2026-03-01T00:00:00.000Z' } },
    'verse.doel': { op: nu, herhaal: { stap: 0, volgende: '2026-12-01T00:00:00.000Z' } }
  } });
  const g = maakGeheugen({ paspoort, save: () => {}, nu: () => nu });
  const r = g.herhalingen('sleutel');

  assert.deepEqual(r.open, [{ doel: 'oud.doel' }], 'wat openstaat is het doel en verder niets');
  assert.equal(r.aantal, 1);
  assert.deepEqual(Object.keys(r.open[0]), ['doel'], 'geen datum, geen aantal dagen, geen achterstand');
  // wat er nog aankomt mag wel een datum dragen: een vooruitzicht is geen verwijt
  assert.equal(r.later.length, 1);
  assert.equal(r.later[0].volgende, '2026-12-01T00:00:00.000Z');
  assert.equal(g.staatOpen('sleutel', 'oud.doel'), true);
  assert.equal(g.staatOpen('sleutel', 'verse.doel'), false);
});

test('een herhaling is drie vragen door dezelfde weg, en een mindere ronde wist niets', async () => {
  const start = await api('/leerstof/herhaal', { doel: 'rekenen.g5.tafels-tot-10' });
  assert.equal(start.status, 200);
  assert.equal(start.body.totaal, HERHAAL_VRAGEN, 'drie vragen, niet de hele les opnieuw');
  // niets in de vraag zelf verraadt dat dit een herhaling is
  assert.doesNotMatch(JSON.stringify(start.body), /herhaling|opnieuw|vergeten/i);

  // alles fout: het leerdoel blijft staan, en er komt geen verwijt
  let r = start.body;
  for (let i = 0; i < HERHAAL_VRAGEN; i++) r = (await api('/leerstof/antwoord', { antwoord: 'fout' })).body;
  assert.equal(r.klaar, true);
  assert.equal(r.herhaald, true);
  assert.equal(r.gelukt, false);
  assert.doesNotMatch(r.slot, /fout|jammer|helaas|vergeten|achterstand|had je moeten/i);

  const mijn = (await api('/onderwijs/mijn')).body;
  assert.ok(mijn.doelen['rekenen.g5.tafels-tot-10'], 'een mindere herhaling wist het leerdoel niet');

  // en een mislukte herhaling wordt niet als bewijs vastgelegd
  const b = (await api('/onderwijs/bewijs', { doel: 'rekenen.g5.tafels-tot-10' })).body;
  assert.equal(b.bewijs.filter(x => x.soort === 'herhaling').length, 0);
});

test('een geslaagde herhaling is bewijs, en het moment schuift naar achteren', async () => {
  let r = (await api('/leerstof/herhaal', { doel: 'rekenen.g5.tafels-tot-10' })).body;
  for (let i = 0; i < HERHAAL_VRAGEN; i++) r = (await api('/leerstof/antwoord', { antwoord: los(r.vraag) })).body;
  assert.equal(r.gelukt, true);
  assert.ok(r.volgende > new Date().toISOString());

  const b = (await api('/onderwijs/bewijs', { doel: 'rekenen.g5.tafels-tot-10' })).body;
  const herh = b.bewijs.filter(x => x.soort === 'herhaling');
  assert.equal(herh.length, 1, 'een geslaagde ophaling na een tijd is beter bewijs dan de eerste keer');
  assert.match(herh[0].detail, /na een tijd/);
  assert.equal(b.beheersing.woord, 'stevig', 'twee soorten eigen bewijs: stevig, en zonder school niet sterk');
});

test('een doel dat je niet behaald hebt, kun je niet herhalen', async () => {
  const r = await api('/leerstof/herhaal', { doel: 'rekenen.g5.delen' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /oefen het eerst/i);
});
