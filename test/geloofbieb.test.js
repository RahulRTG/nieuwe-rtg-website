/* De Geloof & Wijsheid-Bibliotheek: een ECHTE, leesbare kern over alle religies
   en levensbeschouwingen, als gelijken naast elkaar, altijd gratis (cadeau van
   de RTFoundation), met de leeftijdspoort van het profiel. Elk item heeft een
   echte tekst die je kunt openen en lezen. Draai los:
   node --experimental-sqlite --test test/geloofbieb.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { KERN } = require('../server/kern/geloofbieb');

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

test('1. de bibliotheek is een echte, leesbare kern en is ALTIJD gratis', async () => {
  const r = await bieb('', {}, ouder);
  assert.equal(r.status, 200);
  assert.equal(r.body.totaal, KERN.length, 'telt de echte items');
  assert.equal(r.body.gratis, true);
  assert.equal(r.body.leesbaar, true);
  const cat = await bieb('/catalogus', { pagina: 1 }, ouder);
  for (const a of cat.body.items) { assert.equal(a.prijsCenten, 0, a.naam + ' is gratis'); assert.ok(a.uitleg, 'met teaser'); }
});

test('2. elk item is echt te lezen: de volledige tekst komt terug', async () => {
  const item = (await bieb('/catalogus', { pagina: 1 }, ouder)).body.items[0];
  const r = await bieb('/lees', { id: item.id }, ouder);
  assert.equal(r.status, 200);
  assert.ok(r.body.boek.tekst.length > 200, 'een echte, leesbare tekst');
  assert.equal(r.body.boek.naam, item.naam);
});

test('3. alle tradities staan als gelijken naast elkaar; ook het niet-religieuze', async () => {
  const r = await bieb('', {}, ouder);
  const ids = r.body.tradities.map(t => t.id);
  for (const id of ['christendom', 'islam', 'jodendom', 'hindoeisme', 'boeddhisme', 'humanisme', 'twijfel']) {
    assert.ok(ids.includes(id), id + ' hoort erbij');
  }
});

test('4. de leeftijdspoort: een kind ziet en leest nooit een tiener-item, een ouder wel', async () => {
  const tiener = (await bieb('/catalogus', { per: 48 }, ouder)).body.items.find(a => a.doelgroep === 'tiener');
  assert.ok(tiener, 'er bestaat een tiener-item');
  assert.equal((await bieb('/lees', { id: tiener.id }, kind)).status, 403, 'een kind mag het niet lezen');
  const kindItems = (await bieb('/catalogus', { per: 48 }, kind)).body.items;
  assert.ok(!kindItems.some(a => a.id === tiener.id), 'het kind ziet het tiener-item niet in de kast');
  assert.ok(kindItems.some(a => a.doelgroep === 'mini' || a.doelgroep === 'gezin'), 'het kind ziet wel de zachte teksten');
});

test('5. installeren binnen de eigen groep werkt; boven de groep wordt geweigerd', async () => {
  const mini = (await bieb('/catalogus', { per: 48 }, kind)).body.items[0];
  const r = await bieb('/installeer', { id: mini.id }, kind);
  assert.equal(r.status, 200);
  assert.equal(r.body.aantal, 1);
  const tiener = (await bieb('/catalogus', { per: 48 }, ouder)).body.items.find(a => a.doelgroep === 'tiener');
  assert.equal((await bieb('/installeer', { id: tiener.id }, kind)).status, 403, 'boven de groep: dicht');
  const mijn = await bieb('/mijn', {}, kind);
  assert.equal(mijn.body.boeken.length, 1);
  assert.equal(mijn.body.boeken[0].id, mini.id);
});

test('6. verwijderen en idempotent installeren', async () => {
  const mijn = (await bieb('/mijn', {}, kind)).body.boeken;
  const r2 = await bieb('/installeer', { id: mijn[0].id }, kind);
  assert.ok(r2.body.alGeinstalleerd, 'twee keer drukken installeert niet dubbel');
  const weg = await bieb('/weg', { id: mijn[0].id }, kind);
  assert.equal(weg.body.aantal, 0);
});

test('7. zoeken en filteren op een traditie werkt', async () => {
  const r = await bieb('/catalogus', { categorie: 'boeddhisme', per: 48 }, ouder);
  assert.ok(r.body.items.length > 0);
  for (const a of r.body.items) assert.equal(a.traditie, 'boeddhisme');
  const z = await bieb('/catalogus', { zoek: 'mededogen' }, ouder);
  assert.ok(z.body.totaal >= 1, 'zoeken vindt een tekst');
});
