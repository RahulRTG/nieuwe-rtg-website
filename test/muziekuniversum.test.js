/* HET MUZIKALE UNIVERSUM: een uitgave die geen opname is maar een REGEL.

   Wat hier bewezen moet worden zijn twee dingen die elkaar in de weg lijken te
   zitten: elke luisteraar hoort iets ANDERS, en toch is elke vertolking exact
   terug te vinden. Zonder dat tweede is "elke keer anders" geen formaat maar
   ruis -- dan kan een maker niet horen wat een luisteraar hoorde.

   En het derde, dat het makkelijkst stil zou sneuvelen: de opname van de MAKER
   blijft bestaan naast het universum. Een formaat dat de maker uit zijn eigen
   werk schrijft, is precies wat het Klankwerk elders weigert.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - het zaad niet doorgeven aan bouw() (altijd hetzelfde stuk)
     -> "twee luisteraars horen niet hetzelfde" ZAKT (RAAK)
   - het zaad per aanroep vers maken in plaats van uit stuk+lid+dag
     -> "dezelfde luisteraar hoort de hele dag hetzelfde" ZAKT (RAAK)
   - de kanalen van de maker weglaten bij een uitgave met universum
     -> "de opname van de maker blijft bestaan" ZAKT (RAAK)
   - een onbekende stijl stil vervangen door house
     -> "een onbekende stijl levert geen universum op" ZAKT (RAAK)

   Draai los: node --experimental-sqlite --test test/muziekuniversum.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const UNI = require('../server/kern/muziek-universum');

let srv, base, maker, luisteraar, uitgaveId;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uni-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  return (await api('/api/auth/register', { name: naam, email: 'mu' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-04-04', geslacht: 'x', tier: 'rtg', pasApp: 'rtg' })).body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  maker = await lid('Componist'); luisteraar = await lid('Luisteraar');
  const trackId = (await api('/api/muziek/maak', {}, maker)).body.track.id;
  await api('/api/muziek/bewaar', { id: trackId, naam: 'Night Drive 01', klaar: true }, maker);
  const u = await api('/api/muziek/uitgeven', { id: trackId, toelichting: 'Een universum, geen opname.',
    universum: { stijl: 'house', ladder: 'mineur', maten: 4, bpmMin: 90, bpmMax: 105 } }, maker);
  assert.equal(u.status, 200, JSON.stringify(u.body).slice(0, 200));
  uitgaveId = u.body.uitgave.id;
  assert.ok(u.body.uitgave.universum, 'de uitgave draagt het universum');
});
test.after(() => stop(srv));

test('een luisteraar hoort een vertolking binnen de grenzen van de maker', async () => {
  const r = await api('/api/muziek/vertolking', { id: uitgaveId }, luisteraar);
  assert.equal(r.status, 200);
  assert.ok(r.body.bpm >= 90 && r.body.bpm <= 105, 'het tempo valt in het bereik (' + r.body.bpm + ')');
  assert.equal(r.body.maten, 4);
  assert.ok((r.body.kanalen || []).length > 0, 'er klinkt werkelijk iets');
  assert.ok(r.body.zaad > 0, 'en de vertolking draagt haar zaad');
});

test('twee luisteraars horen niet hetzelfde', async () => {
  const a = await api('/api/muziek/vertolking', { id: uitgaveId }, luisteraar);
  const b = await api('/api/muziek/vertolking', { id: uitgaveId }, maker);
  assert.notEqual(a.body.zaad, b.body.zaad, 'elk lid krijgt een eigen zaad');
  assert.notDeepEqual(a.body.kanalen, b.body.kanalen, 'en dus een eigen stuk');
});

test('dezelfde luisteraar hoort de hele dag hetzelfde: een stuk verandert niet terwijl je luistert', async () => {
  const a = await api('/api/muziek/vertolking', { id: uitgaveId }, luisteraar);
  const b = await api('/api/muziek/vertolking', { id: uitgaveId }, luisteraar);
  assert.equal(a.body.zaad, b.body.zaad);
  assert.deepEqual(a.body.kanalen, b.body.kanalen, 'twee keer openen geeft hetzelfde stuk');
});

test('met een zaad is elke vertolking tot op de noot terug te vinden', async () => {
  const a = await api('/api/muziek/vertolking', { id: uitgaveId, zaad: 424242 }, luisteraar);
  const b = await api('/api/muziek/vertolking', { id: uitgaveId, zaad: 424242 }, maker);
  assert.equal(a.body.bpm, b.body.bpm, 'ook het tempo hangt aan het zaad');
  assert.deepEqual(a.body.kanalen, b.body.kanalen,
    'hetzelfde zaad geeft hetzelfde stuk, ongeacht wie het opvraagt');
  const anders = await api('/api/muziek/vertolking', { id: uitgaveId, zaad: 424243 }, luisteraar);
  assert.notDeepEqual(a.body.kanalen, anders.body.kanalen, 'een ander zaad geeft een ander stuk');
});

test('de opname van de MAKER blijft bestaan naast het universum', async () => {
  const zaal = await api('/api/muziek/zaal', {}, luisteraar);
  const u = (zaal.body.uitgaven || []).find(x => x.id === uitgaveId);
  assert.ok(u, 'de uitgave staat in de zaal');
  assert.ok(u.universum, 'met zijn universum erbij, zodat een luisteraar weet wat hij hoort');
  const open = await api('/api/muziek/uitgave', { id: uitgaveId }, luisteraar);
  assert.equal(open.status, 200);
  assert.ok((open.body.uitgave.kanalen || []).length > 0 || (open.body.kanalen || []).length > 0,
    'en de eigen opname van de maker is er nog: een universum vervangt hem niet');
});

test('een opname zonder universum valt niet te vertolken, en zegt dat', async () => {
  const t2 = (await api('/api/muziek/maak', {}, maker)).body.track.id;
  await api('/api/muziek/bewaar', { id: t2, naam: 'Gewoon een stuk', klaar: true }, maker);
  const u2 = (await api('/api/muziek/uitgeven', { id: t2 }, maker)).body.uitgave;
  const r = await api('/api/muziek/vertolking', { id: u2.id }, luisteraar);
  assert.equal(r.status, 409);
  assert.match(r.body.error, /opname|universum/i);
  assert.equal(u2.universum, null, 'en zo\'n uitgave draagt er ook geen');
});

/* ---- de regel zelf, zonder server ---- */

test('een onbekende stijl levert GEEN universum op', () => {
  assert.equal(UNI.schoonUniversum({ stijl: 'polka' }), null,
    'stil vervangen door house zou de maker iets anders laten uitgeven dan hij bedoelde');
  assert.equal(UNI.schoonUniversum(null), null);
  assert.ok(UNI.schoonUniversum({ stijl: 'ambient' }), 'een bekende stijl wel');
});

test('een omgekeerd tempobereik wordt rechtgezet in plaats van geweigerd', () => {
  const u = UNI.schoonUniversum({ stijl: 'house', bpmMin: 130, bpmMax: 100 });
  assert.equal(u.bpmMin, 100);
  assert.equal(u.bpmMax, 130);
});

test('het tempo is over veel zaden gelijkmatig verdeeld en nooit buiten het bereik', () => {
  /* Twee steekproeven landden bij het bouwen allebei op de bovengrens; dat leek
     een klemmende generator. Over tweehonderd zaden gemeten was het toeval --
     en die meting hoort in een toets en niet in een herinnering. */
  const regel = { stijl: 'house', maten: 4, bpmMin: 90, bpmMax: 105 };
  const gezien = new Set();
  for (let z = 1; z <= 200; z++) {
    const bpm = UNI.vertolk(regel, z).bpm;
    assert.ok(bpm >= 90 && bpm <= 105, 'zaad ' + z + ' gaf ' + bpm);
    gezien.add(bpm);
  }
  assert.ok(gezien.size >= 12, 'het tempo klemt niet op een waarde (gezien: ' + gezien.size + ' van 16)');
});
