/* DIENSTEN EN TOESTELLEN MET EEN EIGEN IDENTITEIT (AUTHORITY.md fase 7).

   Vier dingen die niet mogen sneuvelen:
   1. de lijst diensten is gesloten en klopt met de bron: elke verklaarde dienst
      wordt ergens als dienst uitgevoerd, en elke aanroep noemt een verklaarde;
   2. wat binnen een dienst gebeurt, draagt op de bus de actor `dienst:<naam>`,
      en een gebeurtenis die daaruit volgt erft hem (de keten);
   3. een onbekende dienst is een fout, geen stille terugval op "het systeem";
   4. een toestel schrijft als `toestel:<id>`, niet als het lid.

   Draai los: node --test test/dienstidentiteit.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { DIENSTEN, AANBIEDERS, alsDienst, alsToestel, alsDoos, alsAanbieder, actorVan } = require('../server/kern/dienstidentiteit');
const envelop = require('../server/kern/envelop');

function bronbestanden(map, uit = []) {
  for (const n of fs.readdirSync(map, { withFileTypes: true })) {
    const p = path.join(map, n.name);
    if (n.isDirectory()) { if (n.name !== 'data' && n.name !== 'node_modules') bronbestanden(p, uit); }
    else if (n.name.endsWith('.js')) uit.push(p);
  }
  return uit;
}

test('1. de lijst diensten is gesloten en klopt met de bron', () => {
  const gebruikt = new Set();
  for (const f of bronbestanden(path.join(__dirname, '..', 'server'))) {
    const bron = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of bron.matchAll(/alsDienst\('([^']+)'/g)) gebruikt.add(m[1]);
  }
  const onverklaard = [...gebruikt].filter(n => !DIENSTEN[n]);
  assert.deepEqual(onverklaard, [], 'een dienst die niet in kern/dienstidentiteit.js staat');
  const ongebruikt = Object.keys(DIENSTEN).filter(n => !gebruikt.has(n));
  assert.deepEqual(ongebruikt, [], 'een verklaarde dienst die nergens als dienst draait');
});

test('2. binnen een dienst draagt de bus de actor, en de keten erft hem', () => {
  let binnen = null, gevolg = null;
  alsDienst('bewaarveger', () => {
    binnen = envelop.huidige();
    gevolg = envelop.maak({ kanaal: 'office' });
  });
  assert.equal(binnen.actor, 'dienst:bewaarveger');
  assert.equal(binnen.kanaal, 'dienst');
  assert.equal(gevolg.actor, 'dienst:bewaarveger', 'een gebeurtenis in de dienst noemt de dienst');
  assert.equal(gevolg.oorzaak, binnen.id, 'en weet waardoor hij ontstond');
  assert.equal(envelop.huidige(), null, 'buiten de dienst is er geen actor meer');
  assert.equal(actorVan('rtgai'), 'dienst:rtgai');
});

test('3. een onbekende dienst is een fout', () => {
  assert.throws(() => alsDienst('systeem', () => {}), /onbekende dienst/);
  assert.throws(() => alsDienst('constructor', () => {}), /onbekende dienst/);
});

test('4. een toestel schrijft als toestel', () => {
  let e = null;
  alsToestel('a1b2c3d4', () => { e = envelop.huidige(); });
  assert.equal(e.actor, 'toestel:a1b2c3d4');
  assert.equal(e.classificatie, 'persoonsgegeven', 'een meting gaat over een herleidbaar mens');
});

test('5. een bewezen doos schrijft als doos', () => {
  let e = null;
  alsDoos('doos-a', () => { e = envelop.huidige(); });
  assert.equal(e.actor, 'doos:doos-a');
});

test('6. een aanbieder heet zo alleen binnen zijn werk, en de lijst is gesloten', async () => {
  const gebruikt = new Set();
  for (const f of bronbestanden(path.join(__dirname, '..', 'server'))) {
    // Hier GEEN commentaarfilter: het mediatype ster-slash-ster van express.raw
    // opent voor een regex een commentaar dat nooit sluit, en dan verdwijnt de
    // rest van het bestand. Een aanroep in commentaar zou hier alleen te veel tellen.
    const bron = fs.readFileSync(f, 'utf8');
    for (const m of bron.matchAll(/alsAanbieder\((?:[^,]*\? *)?'([^']+)'/g)) gebruikt.add(m[1]);
  }
  assert.deepEqual([...gebruikt].filter(n => !AANBIEDERS[n]), [], 'een aanbieder die niet is verklaard');
  assert.deepEqual(Object.keys(AANBIEDERS).filter(n => !gebruikt.has(n)), [], 'een verklaarde aanbieder zonder webhook');
  assert.throws(() => alsAanbieder('iedereen', () => {}), /onbekende aanbieder/);
  let binnen = null;
  await alsAanbieder('mollie', async () => { await null; binnen = envelop.huidige(); });
  assert.equal(binnen.actor, 'aanbieder:mollie', 'ook na een await in het werk');
  assert.equal(envelop.huidige(), null, 'en daarna niet meer: geen lek naar de aanroeper');
  let zonder = 'x';
  alsAanbieder(null, () => { zonder = envelop.huidige(); });
  assert.equal(zonder, null, 'een onbewezen afzender draait zonder actor');
});
