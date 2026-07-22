/* De Geloof & Wijsheid-Bibliotheek: een miljoen boeken/apps over alle religies
   en levensbeschouwingen, als gelijken naast elkaar, altijd gratis (cadeau van
   de RTFoundation), met de leeftijdspoort van het profiel. Draai los:
   node --experimental-sqlite --test test/geloofbieb.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
function fnd(pad, body) {
  return fetch(base + '/api/foundation' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
function bieb(pad, body, sess) {
  return fetch(base + '/api/rtf/geloof' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ code: sess.code, token: sess.token }, body || {})) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let ouder, kind;
// een thema dat alleen voor tiener/volwassene is (Heilige teksten & bronnen = nr 6)
const TIENER_THEMA = 6;
// een thema voor de kleinsten (Verhalen voor de kleinsten = nr 0)
const MINI_THEMA = 0;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geloofbieb-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const t = Date.now().toString().slice(-6);
  const g = (await fnd('/gezin/maak', { gezinsnaam: 'Geloof ' + t, naam: 'Ouder ' + t, pin: '1234' })).body;
  ouder = { code: g.code, token: g.token };
  const kp = (await fnd('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind ' + t, rol: 'kind', groep: 'kind' })).body;
  const kies = (await fnd('/gezin/profiel/kies', { code: g.code, profielId: kp.profiel.id })).body;
  kind = { code: g.code, token: kies.token };
});
test.after(() => stop(srv && srv.child));

test('1. de bibliotheek telt een miljoen boeken en is ALTIJD gratis en respectvol', async () => {
  const r = await bieb('', {}, ouder);
  assert.equal(r.status, 200);
  assert.equal(r.body.totaal, 1000000);
  assert.equal(r.body.gratis, true);
  const cat = await bieb('/catalogus', { pagina: 1 }, ouder);
  for (const a of cat.body.items) {
    assert.equal(a.prijsCenten, 0, a.naam + ' is gratis');
    assert.ok(a.winkelwaardeCenten >= 799 && a.winkelwaardeCenten <= 2599, 'winkelwaarde van een boek');
    assert.match(a.uitleg, /zonder rangorde en zonder oordeel/, 'geen enkele traditie staat boven een andere');
    assert.match(a.uitleg, /Geen aankopen, geen reclame/, 'de huisregel staat bij elk boek');
  }
});

test('2. alle tradities staan als gelijken naast elkaar (40, elk even groot)', async () => {
  const r = await bieb('', {}, ouder);
  assert.equal(r.body.tradities.length, 40, 'veertig tradities');
  const eerste = r.body.tradities[0].aantal;
  for (const t of r.body.tradities) assert.equal(t.aantal, eerste, t.label + ' is even groot als de rest (geen rangorde)');
  // ook het niet-religieuze heeft een plek
  const ids = r.body.tradities.map(t => t.id);
  for (const id of ['christendom', 'islam', 'jodendom', 'hindoeisme', 'boeddhisme', 'humanisme', 'twijfel']) {
    assert.ok(ids.includes(id), id + ' hoort erbij');
  }
});

test('3. de leeftijdspoort: een kind ziet nooit een tiener-thema, een ouder wel', async () => {
  const o = await bieb('/catalogus', { thema: TIENER_THEMA, per: 24 }, ouder);
  assert.ok(o.body.items.length > 0, 'de ouder ziet het tiener-thema');
  assert.ok(o.body.items.every(a => a.doelgroep === 'tiener'), 'het zijn tiener-boeken');
  const k = await bieb('/catalogus', { thema: TIENER_THEMA, per: 24 }, kind);
  assert.equal(k.body.totaal, 0, 'een kind ziet dat thema niet');
  // het kind ziet wel de zachte verhalen
  const kMini = await bieb('/catalogus', { thema: MINI_THEMA, per: 24 }, kind);
  assert.ok(kMini.body.items.length > 0, 'het kind ziet wel de verhalen voor de kleinsten');
});

test('4. installeren binnen de eigen groep werkt; boven de groep wordt geweigerd', async () => {
  const cat = await bieb('/catalogus', { thema: MINI_THEMA, pagina: 1 }, kind);
  const boek = cat.body.items[0];
  const r = await bieb('/installeer', { id: boek.id }, kind);
  assert.equal(r.status, 200);
  assert.equal(r.body.aantal, 1);
  // een tiener-boek via de ouder, en dat als kind proberen te installeren
  const oc = await bieb('/catalogus', { thema: TIENER_THEMA, per: 24 }, ouder);
  const tienerBoek = oc.body.items[0];
  assert.ok(tienerBoek, 'er bestaat een tiener-boek');
  assert.equal((await bieb('/installeer', { id: tienerBoek.id }, kind)).status, 403, 'boven de groep: dicht');
  const mijn = await bieb('/mijn', {}, kind);
  assert.equal(mijn.body.boeken.length, 1);
  assert.equal(mijn.body.boeken[0].id, boek.id);
});

test('5. verwijderen en idempotent installeren', async () => {
  const mijn = (await bieb('/mijn', {}, kind)).body.boeken;
  const r2 = await bieb('/installeer', { id: mijn[0].id }, kind);
  assert.ok(r2.body.alGeinstalleerd, 'twee keer drukken installeert niet dubbel');
  const weg = await bieb('/weg', { id: mijn[0].id }, kind);
  assert.equal(weg.body.aantal, 0);
});

test('6. zoeken werkt en de catalogus is deterministisch', async () => {
  const a = await bieb('/catalogus', { zoek: 'lantaarn', pagina: 1 }, ouder);
  assert.ok(a.body.totaal > 0);
  for (const x of a.body.items) assert.match(x.naam.toLowerCase(), /lantaarn/);
  const b = await bieb('/catalogus', { zoek: 'lantaarn', pagina: 1 }, ouder);
  assert.deepEqual(a.body.items.map(x => x.id), b.body.items.map(x => x.id));
});

test('7. filteren op een traditie levert alleen die traditie', async () => {
  const r = await bieb('/catalogus', { categorie: 'boeddhisme', per: 24 }, ouder);
  assert.ok(r.body.items.length > 0);
  for (const a of r.body.items) assert.equal(a.traditie, 'boeddhisme');
});

test('8. zonder geldig gezin blijft de bibliotheek dicht', async () => {
  const r = await bieb('', {}, { code: 'NEPPERT', token: 'nep' });
  assert.equal(r.status, 403);
});
