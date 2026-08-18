/* ============================================================================
   GEEN GROOTBOEK, GEEN PRODUCTIE.

   Zonder rij-voor-rij grootboek is er maar een vangnet voor een collectie die
   haar grens raakt: db/tx/index.js schrijft de staart naar archief/ en kapt pas
   als dat gelukt is. Beter dan verlies, maar er is geen index, geen paginering,
   en herstel is handwerk met een jsonl-bestand. Voor betalingen en boekingen is
   dat te mager, dus de productiekeuring blokkeert zo'n stand.

   WAT HIER MIS WAS, EN WAAROM HET STIL WAS. Er stond alleen een waarschuwing, op
   de voorwaarde `!DATABASE_URL && RTG_STORE !== 'sqlite'`. Die voorwaarde is
   niet dezelfde regel die de opslag zelf hanteert: db/keuze.js kiest json alleen
   als er OOK een db.json ligt, en anders sqlite. De keuring wees dus een verse
   installatie ten onrechte aan (die krijgt sqlite MET grootboek) en liet juist
   de installatie lopen die ooit met een db.json begon en waar DATABASE_URL later
   wegviel. Precies het geval dat niemand ziet gebeuren.

   Ik heb daar zelf ook naast gezeten: in LAT.md schreef ik dat de json- en
   geheugen-stand "de ontwikkel- en toetsstanden zijn en niet de productiestand".
   Dat was aangenomen, niet nagetrokken, en het klopte niet. Deze toets maakt het
   waar in plaats van beweerd.

   Draai los: node --test test/opslagpoort.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { kiesStore, heeftGrootboek } = require('../server/db/keuze');
const { keur } = require('../server/config/productie');

// een omgeving die verder helemaal in orde is, zodat alleen de opslag overblijft
const LEEG = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-opslagpoort-'));
const gezond = (extra) => Object.assign({
  RTG_ENC_KEY: 'x'.repeat(40), RTG_VAULT_KEY: 'y'.repeat(40), RTG_SECRET_KEY: 'z'.repeat(40),
  RTG_OWNER_EMAIL: 'eigenaar@voorbeeld.test', RTG_DATA_DIR: LEEG
}, extra || {});

function keuring(env) {
  const fouten = [], waarschuwingen = [];
  keur(env, fouten, waarschuwingen);
  return { fouten, waarschuwingen, geblokkeerd: fouten.some(f => /grootboek/.test(f)) };
}

test.after(() => { try { fs.rmSync(LEEG, { recursive: true, force: true }); } catch (e) {} });

/* De opslagkeuze zelf, als tabel. Dit is de regel waar zowel de opslaglaag als
   de keuring op leunt; staat hij hier fout, dan staan ze allebei fout. */
test('1. de opslagkeuze: wanneer wordt het welke stand, en draagt die een grootboek', () => {
  assert.equal(kiesStore({}, false), 'sqlite', 'een VERSE installatie krijgt sqlite');
  assert.equal(kiesStore({}, true), 'json', 'een BESTAANDE installatie houdt zijn db.json');
  assert.equal(kiesStore({ DATABASE_URL: 'postgres://x' }, true), 'postgres', 'een DATABASE_URL wint van db.json');
  assert.equal(kiesStore({ RTG_STORE: 'geheugen', DATABASE_URL: 'postgres://x' }, true), 'geheugen',
    'RTG_STORE is altijd de baas');

  assert.equal(heeftGrootboek({}, 'postgres'), true);
  assert.equal(heeftGrootboek({}, 'sqlite'), true);
  assert.equal(heeftGrootboek({ TX_LEDGER_SQLITE: '0' }, 'sqlite'), false, 'sqlite met het grootboek uit telt niet mee');
  assert.equal(heeftGrootboek({}, 'json'), false);
  assert.equal(heeftGrootboek({}, 'geheugen'), false);
});

test('2. postgres en sqlite mogen productie in', () => {
  assert.equal(keuring(gezond({ DATABASE_URL: 'postgres://x' })).geblokkeerd, false, 'postgres draagt altijd een grootboek');
  assert.equal(keuring(gezond({ RTG_STORE: 'sqlite' })).geblokkeerd, false, 'sqlite ook');
  /* En de verse installatie zonder db.json: die valt op sqlite en hoort dus
     gewoon te starten. De oude waarschuwing wees juist HIER, en dat was de
     verkeerde kant op. */
  assert.equal(keuring(gezond()).geblokkeerd, false, 'een verse installatie zonder db.json valt op sqlite en mag starten');
});

test('3. de standen zonder grootboek worden geweigerd, met een bruikbare tekst', () => {
  for (const stand of ['json', 'geheugen']) {
    const r = keuring(gezond({ RTG_STORE: stand }));
    assert.equal(r.geblokkeerd, true, 'de stand "' + stand + '" hoort productie niet in te mogen');
    const melding = r.fouten.find(f => /grootboek/.test(f));
    assert.match(melding, new RegExp(stand), 'de melding noemt de stand die het betreft');
    assert.match(melding, /DATABASE_URL|RTG_STORE=sqlite/, 'en zegt hoe het wel moet');
  }
});

/* Sqlite MET het grootboek uitgezet is de gemeenste: de stand heet sqlite, dus
   wie op de naam afgaat denkt dat het goed zit. */
test('4. sqlite met TX_LEDGER_SQLITE=0 telt niet als grootboek', () => {
  const r = keuring(gezond({ RTG_STORE: 'sqlite', TX_LEDGER_SQLITE: '0' }));
  assert.equal(r.geblokkeerd, true, 'een uitgezet grootboek is geen grootboek');
  assert.match(r.fouten.find(f => /grootboek/.test(f)), /TX_LEDGER_SQLITE/,
    'en de melding wijst de schakelaar aan die het veroorzaakt');
});

/* DE VERGETEN INSTALLATIE. Een db.json in de datamap, geen DATABASE_URL: dat is
   de stand waarin dit vroeger alleen een waarschuwing gaf. */
test('5. een achtergebleven db.json zonder DATABASE_URL blokkeert de start', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-oudeinstall-'));
  try {
    fs.writeFileSync(path.join(map, 'db.json'), '{}');
    const r = keuring(gezond({ RTG_DATA_DIR: map }));
    assert.equal(r.geblokkeerd, true,
      'de installatie die ooit met json begon en DATABASE_URL kwijtraakte, start niet meer stilletjes door');
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

/* Sqlite blijft een geldige productiestand: een enkele bak met sqlite mag. Dat
   het niet deelt tussen instances is een aanbeveling, geen blokkade -- anders
   zou deze reparatie stiekem Postgres verplicht stellen. */
test('6. sqlite krijgt een waarschuwing over meerdere instances, geen blokkade', () => {
  const r = keuring(gezond({ RTG_STORE: 'sqlite' }));
  assert.equal(r.geblokkeerd, false);
  assert.ok(r.waarschuwingen.some(w => /DATABASE_URL/.test(w) && /instances/.test(w)),
    'wel gemeld dat het niet deelt tussen instances');
});
