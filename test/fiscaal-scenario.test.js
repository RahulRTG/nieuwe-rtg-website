/* DE SCENARIO-ENGINE: wat gebeurt er als ik dit doe -- zonder dat er iets gebeurt.

   Zes beweringen, en de eerste is de enige die er echt toe doet.

   1. ER VERANDERT NIETS. Niet aan de landentabel, niet aan de database. Dat is
      hier structureel opgelost en niet met discipline: de module krijgt geen
      `db` en geen `save`, dus hij KAN niet schrijven. Deze toets legt de
      volledige staat voor en na naast elkaar.
   2. HIJ REKENT NIET ZELF maar gebruikt de landentabel -- dus een land met
      andere lasten geeft een ander bedrag, zonder dat hier een getal staat.
   3. DE AANNAMES STAAN IN HET ANTWOORD. Een aanname die je niet ziet, is een
      aanname die je gelooft.
   4. WAT WE NIET WETEN STAAT ER OOK, als eigen lijst.
   5. KAN HET DAAR UBERHAUPT? Een kostenplaatje voor een land zonder
      goedgekeurde loontabel is een plaatje van iets dat niet kan, en dat hoort
      erbij te staan.
   6. EEN DOORREKENING IS ADVIES, nooit vastgesteld.

   Draai los: node --experimental-sqlite --test test/fiscaal-scenario.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakScenario } = require('../server/kern/fiscaal/scenario');
const { canoniek } = require('../server/kern/fiscaal/gateway/zegel');
const { LANDEN } = require('../server/kern/fiscaal');

test('er verandert niets -- niet aan de tabel en niet aan de database', () => {
  /* Een database die er wel IS, zodat "hij raakt hem niet aan" iets betekent.
     De engine krijgt hem niet; dat is precies wat deze toets vastlegt. */
  const db = { data: { facturen: [{ nummer: 'F-1' }], suppliers: [{ code: 'KIKUNOI' }] } };
  const voorDb = canoniek(db.data);
  const voorLanden = canoniek(LANDEN);

  const { scenario } = maakScenario({ LANDEN, dekking: null });
  scenario.personeel({ land: 'DE', aantal: 12, brutoPerMaandCenten: 350000 });
  scenario.omzet({ land: 'NL', omzetCenten: 200000000, categorie: 'eten' });
  scenario.personeel({ land: 'FR', aantal: 3, brutoPerMaandCenten: 500000 });

  assert.equal(canoniek(db.data), voorDb, 'de database is niet aangeraakt');
  assert.equal(canoniek(LANDEN), voorLanden, 'de landentabel is niet aangeraakt');

  /* En structureel: de fabriek accepteert geen schrijvers. Geef ze toch mee,
     dan worden ze genegeerd -- er is geen pad waarlangs ze gebruikt worden. */
  let geschreven = false;
  const { scenario: s2 } = maakScenario({ LANDEN, dekking: null, db, save: () => { geschreven = true; } });
  s2.personeel({ land: 'DE', aantal: 1, brutoPerMaandCenten: 100000 });
  assert.equal(geschreven, false, 'save wordt nooit aangeroepen, ook niet als je hem meegeeft');
  assert.equal(canoniek(db.data), voorDb);
});

test('hij rekent niet zelf maar gebruikt de landentabel', () => {
  const { scenario } = maakScenario({ LANDEN, dekking: null });
  const de = scenario.personeel({ land: 'DE', aantal: 10, brutoPerMaandCenten: 300000 });
  const fr = scenario.personeel({ land: 'FR', aantal: 10, brutoPerMaandCenten: 300000 });

  // DE: 21% lasten, geen vakantiegeld. FR: 42% lasten.
  assert.equal(de.opbouw.brutoCenten, 3000000);
  assert.equal(de.opbouw.lastenCenten, Math.round(3000000 * LANDEN.DE.lasten));
  assert.equal(de.opbouw.vakantiegeldCenten, 0, 'DE kent geen vakantiegeldopbouw in onze tabel');
  assert.ok(fr.perMaandCenten > de.perMaandCenten, 'Frankrijk is duurder, en dat komt uit de tabel');
  assert.equal(fr.opbouw.lastenCenten, Math.round(3000000 * LANDEN.FR.lasten));

  // en de omzetkant haalt het tarief uit dezelfde tabel
  const nl = scenario.omzet({ land: 'NL', omzetCenten: 10900, categorie: 'eten' });
  assert.equal(nl.tarief, LANDEN.NL.tarieven.eten);
  assert.equal(nl.grondslagCenten, 10000);
  assert.equal(nl.btwCenten, 900);
});

test('de aannames staan in het antwoord', () => {
  const { scenario } = maakScenario({ LANDEN, dekking: null });
  const r = scenario.personeel({ land: 'DE', aantal: 12, brutoPerMaandCenten: 350000 });
  const tekst = r.aannames.join(' | ');
  assert.match(tekst, /12 medewerkers/);
  assert.match(tekst, /3500/, 'het aangenomen brutoloon');
  assert.match(tekst, /21%/, 'het lastenpercentage waarmee is gerekend');
  assert.match(tekst, /geen vakantiegeldopbouw/);
});

test('wat we niet weten staat er ook', () => {
  const { scenario } = maakScenario({ LANDEN, dekking: null });
  const r = scenario.omzet({ land: 'NL', omzetCenten: 200000000, categorie: 'eten' });
  const watten = r.onbekend.map(o => o.wat).sort();
  assert.deepEqual(watten, ['aftrek', 'categorie', 'drempels']);
  assert.match(r.onbekend.find(o => o.wat === 'drempels').let, /verschillen per land/i);
  /* De categorie-toewijzing is dezelfde grens als in het bronnenregister: geen
     enkele tabel zegt welke categorie een verkoop krijgt. */
  assert.match(r.onbekend.find(o => o.wat === 'categorie').let, /juridische toewijzing/i);
});

test('kan het daar uberhaupt -- de loondekking hoort erbij', () => {
  const draait = { voorLand: () => ({ stand: 'draait', opDemoTabellen: false, pakket: { versie: 'de-2026.1' } }) };
  const nee = { voorLand: () => ({ stand: 'geen_tabel', opDemoTabellen: false }) };

  const goed = maakScenario({ LANDEN, dekking: draait }).scenario
    .personeel({ land: 'DE', aantal: 12, brutoPerMaandCenten: 350000 });
  assert.equal(goed.loondekking.stand, 'draait');
  assert.ok(!goed.onbekend.some(o => o.wat === 'loondekking'), 'geen melding als het wel kan');

  const slecht = maakScenario({ LANDEN, dekking: nee }).scenario
    .personeel({ land: 'DE', aantal: 12, brutoPerMaandCenten: 350000 });
  const m = slecht.onbekend.find(o => o.wat === 'loondekking');
  assert.ok(m, 'een land zonder tabel levert een melding');
  assert.match(m.let, /kloppen als rekensom, maar de uitvoering kan nog niet/i);
  assert.equal(slecht.perMaandCenten, goed.perMaandCenten, 'het bedrag blijft hetzelfde -- alleen de uitvoerbaarheid verschilt');
});

test('een doorrekening is advies, nooit vastgesteld', () => {
  const { scenario } = maakScenario({ LANDEN, dekking: null });
  for (const r of [scenario.personeel({ land: 'NL', aantal: 2, brutoPerMaandCenten: 300000 }),
    scenario.omzet({ land: 'NL', omzetCenten: 12100 })]) {
    assert.equal(r.zekerheid.klasse, 'advies');
    assert.equal(r.zekerheid.term, 'ADVISORY');
    assert.match(r.let, /niets vastgelegd en niets gewijzigd/i);
  }
});

/* ------------------------------------------------------- door de API heen ---
   Een scenario verklapt wat een onderneming overweegt; dat is geen antwoord
   voor de buurman en geen antwoord voor een gast. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scenario-'));
let srv, base, zaak;
const post = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  zaak = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de scenario-routes rekenen door en laten niets achter', async () => {
  assert.ok(zaak, 'de zaak is ingelogd');

  const p = await post('/api/supplier/scenario/personeel',
    { land: 'DE', aantal: 12, brutoPerMaandCenten: 350000 }, zaak);
  assert.equal(p.status, 200, p.body.error);
  assert.equal(p.body.land, 'DE');
  assert.ok(p.body.perMaandCenten > 0);
  assert.ok(p.body.aannames.length >= 3, 'de aannames reizen mee door de API');
  assert.equal(p.body.zekerheid.klasse, 'advies');

  const o = await post('/api/supplier/scenario/omzet',
    { land: 'NL', omzetCenten: 200000000, categorie: 'eten' }, zaak);
  assert.equal(o.status, 200);
  assert.equal(o.body.tarief, 9);
  assert.ok(o.body.onbekend.some(x => x.wat === 'drempels'));

  /* De verbintenis over een periode: een wortel en een totaal, en GEEN
     factuurlijst -- dat is het hele punt van die laag. */
  const v = await post('/api/supplier/verbintenis', { periode: '2026K3' }, zaak);
  assert.equal(v.status, 200, v.body.error);
  assert.ok(!v.body.feiten, 'de feiten gaan niet mee naar buiten');
  assert.ok(!JSON.stringify(v.body).includes('nummer'), 'en er staat geen factuurnummer in');

  for (const pad of ['/api/supplier/scenario/personeel', '/api/supplier/scenario/omzet', '/api/supplier/verbintenis']) {
    assert.equal((await post(pad, {})).status, 401, pad + ' zonder token');
    assert.equal((await post(pad, {}, 'nep-token')).status, 401, pad + ' met een verzonnen token');
  }
});
