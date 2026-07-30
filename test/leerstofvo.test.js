/* RTG School golf 3: het voortgezet en vervolgonderwijs op de leerstof-motor.
   Vakken per fase (vmbo t/m wo), examentraining die pas aan het eind
   terugkijkt (zoals een echt examen), en het niveau-advies dat adviseert
   en nooit beslist.
   Draai los: node --experimental-sqlite --test test/leerstofvo.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leerstofvo-'));

const api = (pad, body) => fetch(base + '/api' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const r = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Havist Volwassen', email: 'vo' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1992-03-10', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' }) });
  token = (await r.json()).token;
  await api('/onderwijs/inschrijf', { fase: 'havo', reden: 'schooladvies' });
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

// lost 'p% van basis =' op; alle andere vormen geven we bewust fout terug
const reken = (v) => { const m = String(v).match(/^(\d+)% van (\d+) =/); return m ? String(+m[1] * +m[2] / 100) : 'x'; };

test('1. de leerlijn per fase: havo heeft echte vakken, een les en een oefensessie die het paspoort vult', async () => {
  const vak = await api('/leerstof/vakken', { fase: 'havo' });
  assert.equal(vak.status, 200);
  const namen = vak.body.vakken.map(v => v.vak);
  for (const v of ['wiskunde', 'nederlands', 'engels', 'economie']) assert.ok(namen.includes(v), 'havo heeft ' + v);
  // havo bouwt op de vmbo-basis EN heeft eigen doelen
  const wiskunde = vak.body.vakken.find(v => v.vak === 'wiskunde').doelen.map(d => d.id);
  assert.ok(wiskunde.includes('wiskunde.vo.procenten'), 'de gedeelde basis doet mee');
  assert.ok(wiskunde.includes('wiskunde.havo.lineair'), 'en het eigen havo-niveau erbovenop');
  // vwo weer een laag erop; groep 3 (PO) blijft gewoon werken
  const vwo = await api('/leerstof/vakken', { fase: 'vwo' });
  assert.ok(vwo.body.vakken.find(v => v.vak === 'wiskunde').doelen.some(d => d.id === 'wiskunde.vwo.vergelijkingen'));
  assert.equal((await api('/leerstof/vakken', { groep: 3 })).status, 200);
  // de les leest als een les, en oefenen schrijft het paspoort bij
  const les = await api('/leerstof/les', { doel: 'wiskunde.havo.lineair' });
  assert.ok(les.body.doel.les.length > 60);
  let r = await api('/leerstof/oefen', { doel: 'wiskunde.vo.procenten' });
  for (let i = 0; i < 5; i++) r = await api('/leerstof/antwoord', { antwoord: reken(r.body.vraag) });
  assert.equal(r.body.behaald, true);
  const pas = await api('/onderwijs/mijn');
  assert.ok(pas.body.doelen['wiskunde.vo.procenten'], 'het leerdoel staat in het levenslange paspoort');
  assert.doesNotMatch(JSON.stringify(vak.body) + JSON.stringify(r.body), /streak|ranglijst|score/i);
});

test('2. examentraining: tien vragen dwars door de fase, geen verklikker halverwege, terugblik aan het eind', async () => {
  let r = await api('/leerstof/examen', { fase: 'havo' });
  assert.equal(r.status, 200);
  assert.equal(r.body.totaal, 10);
  assert.match(r.body.faseNaam, /havo/i);
  for (let i = 0; i < 9; i++) {
    r = await api('/leerstof/examen-antwoord', { antwoord: reken(r.body.vraag) });
    if (i < 8) {
      assert.equal(r.body.goed, undefined, 'een examen verklikt niet halverwege');
      assert.equal(r.body.juisteAntwoord, undefined);
      assert.ok(r.body.vraag, 'alleen de volgende vraag');
    }
  }
  r = await api('/leerstof/examen-antwoord', { antwoord: reken(r.body.vraag) });
  assert.equal(r.body.klaar, true);
  assert.equal(r.body.terugblik.length, 10, 'de volledige terugblik komt aan het eind');
  assert.ok(r.body.terugblik.every(x => x.juisteAntwoord), 'met per vraag het juiste antwoord om van te leren');
  assert.ok(r.body.cijferIndicatie >= 1 && r.body.cijferIndicatie <= 10);
  assert.match(r.body.advies, /advies/i, 'de indicatie is een advies, geen echt cijfer');
  assert.match(r.body.advies, /officiele instellingen/i);
  // een onbekende fase wordt netjes geweigerd
  assert.equal((await api('/leerstof/examen', { fase: 'po-g3' })).status, 400);
});

test('3. het niveau-advies adviseert en beslist nooit', async () => {
  const a = await api('/onderwijs/advies');
  assert.equal(a.status, 200);
  assert.equal(a.body.fase.id, 'havo');
  assert.ok(a.body.doelenTotaal > 0);
  assert.ok(a.body.doelenBehaald >= 1, 'het behaalde procenten-doel telt mee');
  assert.ok(a.body.examens.length >= 1, 'de examentraining telt mee');
  assert.match(a.body.advies, /advies, geen besluit/i);
  assert.match(a.body.advies, /mensen en de officiele instellingen/i);
  assert.match(a.body.eerlijk, /geen school of examenbureau/i);
});
