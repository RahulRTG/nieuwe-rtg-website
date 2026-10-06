/* TOESTEMMING VOOR GEZONDHEIDSGEGEVENS, APART EN BIJ EERSTE GEBRUIK
   (foundation/gezondheidstoestemming.js, kern/welzijn.js, DPIA-GEZIN.md;
   besluit van de eigenaar, 5 oktober 2026, AVG art. 9), op een ECHTE server.

   Wat hier vastligt:
   1. zonder toestemming wordt geen nieuw gezondheidsgegeven bewaard (409, hoe);
   2. alleen een ouder of de beheerder geeft hem voor het gezin;
   3. een ongewijzigde oude allergieregel blokkeert het bijwerken van de rest niet;
   4. vanaf 16 geeft een gezinslid zelf toestemming voor zijn dagboek;
   6. (zonder server) een allergie van VOOR het besluit blokkeert het bijwerken
      van de huisregels niet -- die toestand is langs de API niet te maken,
      want elke nieuwe allergie vraagt de toestemming al;
   5. intrekken vraagt WIS en wist wat erop rust -- ook het dagboek van een
      kind onder 16, en NIET dat van wie zelf toestemming gaf.

   Draai los: node --test test/gezondheidstoestemming.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezondheidstoestemming-'));
let child, base;

const post = async (pad, body) => {
  const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const fn = (pad, body) => post('/api/foundation' + pad, body);
const haal = async (pad, token) => (await fetch(base + '/api/foundation' + pad, { headers: { Authorization: 'Bearer ' + token } })).json();

let G, kind, tiener;

test.before(async () => {
  ({ child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
  const g = (await fn('/gezin/maak', { gezinsnaam: 'Fam Zorg', naam: 'Mam', pin: '2468' })).body;
  G = { code: g.code, token: g.token };
  const maak = async (naam, rol, geboortedatum) => {
    const p = (await fn('/gezin/profiel/maak', Object.assign({ naam, rol, geboortedatum }, G))).body;
    assert.ok(p.profiel, naam + ' bestaat: ' + JSON.stringify(p).slice(0, 120));
    const t = (await fn('/gezin/profiel/kies', { gezinscode: g.gezinscode, profielId: p.profiel.id })).body.token;
    return { code: g.code, token: t, id: p.profiel.id };
  };
  kind = await maak('Noor', 'kind', '2017-03-01');
  tiener = await maak('Sam', 'gezinslid', '2009-06-01'); // 17: tussen de 16 van de AVG en de 18 van een eigen account
});
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. zonder toestemming geen nieuw gezondheidsgegeven, en geen tweede plek die het wel bewaart', async () => {
  const med = await fn('/gezin/gezondheid/medicijn', Object.assign({ voor: kind.id, naam: 'Paracetamol' }, G));
  assert.equal(med.status, 409, JSON.stringify(med.body));
  assert.equal(med.body.hoe, 'toestemming');
  assert.equal(med.body.magGeven, true, 'de ouder hoort dat hij hem kan geven');
  assert.equal((await fn('/gezin/gezondheid/afspraak', Object.assign({ voor: kind.id, wat: 'Tandarts', datum: '2027-01-01' }, G))).status, 409);
  assert.equal((await fn('/gezin/gezondheid/meting', Object.assign({ voor: kind.id, gewicht: 20 }, G))).status, 409);
  assert.equal((await fn('/gezin/oppasinfo', Object.assign({ allergie: 'pinda', huisregels: 'Schoenen uit' }, G))).status, 409);
  assert.equal((await post('/api/rtf/welzijn/stemming', Object.assign({ gevoel: 'bang' }, kind))).status, 409);
  const kaart = await haal('/gezin/' + G.code + '/gezondheid', G.token);
  assert.equal(kaart.toestemming, false);
  assert.ok(!JSON.stringify(kaart).includes('Paracetamol'), 'er is niets bewaard');
  // wat geen gezondheidsgegeven is, gaat gewoon door
  assert.equal((await fn('/gezin/oppasinfo', Object.assign({ huisregels: 'Schoenen uit' }, G))).status, 200);
});

test('2. een kind geeft de toestemming van het gezin niet', async () => {
  const r = await fn('/gezin/toestemming/gezondheid', Object.assign({ aan: true }, kind));
  assert.equal(r.status, 403);
  const med = await fn('/gezin/gezondheid/medicijn', Object.assign({ naam: 'Neusspray' }, kind));
  assert.equal(med.status, 409);
  assert.equal(med.body.magGeven, false, 'het kind hoort dat een ouder hem geeft');
});

test('3. de ouder geeft hem, en daarna gaat alles door; een oude allergie blokkeert niets', async () => {
  assert.equal((await fn('/gezin/toestemming/gezondheid', Object.assign({ aan: true }, G))).status, 200);
  // een dubbeltik geeft hetzelfde antwoord en verandert niets (lib/mutatiecontracten-toestemming.js)
  const tweede = await fn('/gezin/toestemming/gezondheid', Object.assign({ aan: true }, G));
  assert.deepEqual([tweede.status, tweede.body.toestemming], [200, true]);
  assert.equal((await fn('/gezin/gezondheid/medicijn', Object.assign({ voor: kind.id, naam: 'Paracetamol' }, G))).status, 200);
  assert.equal((await fn('/gezin/oppasinfo', Object.assign({ allergie: 'pinda', huisregels: 'Schoenen uit' }, G))).status, 200);
  assert.equal((await post('/api/rtf/welzijn/stemming', Object.assign({ gevoel: 'bang' }, kind))).status, 200,
    'het dagboek van een kind onder 16 rust op de toestemming van de ouder');
  const kaart = await haal('/gezin/' + G.code + '/gezondheid', G.token);
  assert.equal(kaart.toestemming, true);
  assert.equal(kaart.allergie, 'pinda');
});

test('4. vanaf 16 geeft een gezinslid zelf toestemming; die van het gezin geldt voor hem niet', async () => {
  const zonder = await post('/api/rtf/welzijn/stemming', Object.assign({ gevoel: 'moe' }, tiener));
  assert.equal(zonder.status, 409);
  assert.equal(zonder.body.zelf, true);
  assert.equal((await post('/api/rtf/welzijn/toestemming', Object.assign({ aan: true }, kind))).status, 409,
    'een kind onder 16 geeft deze niet zelf');
  assert.equal((await post('/api/rtf/welzijn/toestemming', Object.assign({ aan: true }, tiener))).status, 200);
  const nog = await post('/api/rtf/welzijn/toestemming', Object.assign({ aan: true }, tiener));
  assert.deepEqual([nog.status, nog.body.toestemming], [200, true], 'een dubbeltik verandert niets');
  assert.equal((await post('/api/rtf/welzijn/stemming', Object.assign({ gevoel: 'moe' }, tiener))).status, 200);
});

test('5. intrekken vraagt WIS en wist wat erop rust, niet meer', async () => {
  const zonderWis = await fn('/gezin/toestemming/gezondheid', Object.assign({ aan: false }, G));
  assert.equal(zonderWis.status, 400);
  assert.equal((await haal('/gezin/' + G.code + '/gezondheid', G.token)).toestemming, true, 'zonder WIS verandert er niets');

  assert.equal((await fn('/gezin/toestemming/gezondheid', Object.assign({ aan: false, bevestig: 'WIS' }, G))).status, 200);
  const nogEens = await fn('/gezin/toestemming/gezondheid', Object.assign({ aan: false, bevestig: 'WIS' }, G));
  assert.deepEqual([nogEens.status, nogEens.body.toestemming], [200, false], 'een tweede intrekking vindt niets meer om te wissen');
  const kaart = await haal('/gezin/' + G.code + '/gezondheid', G.token);
  assert.equal(kaart.toestemming, false);
  assert.equal(kaart.allergie, '');
  assert.ok(!JSON.stringify(kaart).includes('Paracetamol'), 'het medicijn is weg');
  const info = await haal('/gezin/' + G.code + '/oppasinfo', G.token);
  assert.equal(info.oppasinfo.huisregels, 'Schoenen uit', 'wat geen gezondheidsgegeven is, blijft staan');

  const dk = (await post('/api/rtf/welzijn/dagboek', kind)).body;
  assert.equal(dk.stemmingen.length, 0, 'het dagboek van het kind onder 16 is gewist');
  const dt = (await post('/api/rtf/welzijn/dagboek', tiener)).body;
  assert.equal(dt.stemmingen.length, 1, 'wie zelf toestemming gaf, houdt zijn dagboek');

  assert.equal((await post('/api/rtf/welzijn/toestemming', Object.assign({ aan: false }, tiener))).status, 200);
  assert.equal((await post('/api/rtf/welzijn/dagboek', tiener)).body.stemmingen.length, 0, 'en wist het zelf');
});

test('6. een oude allergie, van voor het besluit, blokkeert het bijwerken van de rest niet', () => {
  const routes = {};
  const g = { code: 'OUD', profielen: {}, oppasinfo: { allergie: 'pinda' } };
  const s = { g, p: { id: 'a', rol: 'beheerder', naam: 'Mam' } };
  const ctx = { router: { get() {}, post(pad, h) { routes[pad] = h; } }, G: () => ({ OUD: g }), save() {}, nu: () => 'nu',
    schoon: (v) => String(v == null ? '' : v), encS: (v) => v, decS: (v) => v, sessieVan: () => s, familieVan: () => s,
    gezinVan: () => g, profielVan: () => s.p, checkPin: async () => true };
  require('../server/foundation/zorg')(ctx);
  const antwoord = (lijf) => { const res = { code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    routes['/gezin/oppasinfo']({ body: lijf }, res); return res; };
  assert.equal(antwoord({ allergie: 'pinda', huisregels: 'Schoenen uit' }).code, 200, 'ongewijzigd: geen toestemming nodig');
  assert.equal(g.oppasinfo.huisregels, 'Schoenen uit');
  assert.equal(antwoord({ allergie: 'pinda en noten', huisregels: 'Schoenen uit' }).code, 409, 'gewijzigd: wel');
});
