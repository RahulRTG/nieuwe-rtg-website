/* ============================================================================
   DE VEILIGHEIDSKERN -- vijf soorten onomkeerbare handelingen, een deur.

   WAAROM DIT HET LAATSTE STUK IS. Alles hiervoor beantwoordt een deelvraag: mag
   deze actor dit, draagt hij daar bewijs van, past het hele plan, gebeurt het
   maar een keer. Wat ontbrak is de plek waar die antwoorden VERPLICHT worden
   gesteld -- want zolang een domein rechtstreeks geld kan verplaatsen, is elk
   van die lagen een aanbeveling.

   DE BEWERINGEN DIE ERTOE DOEN:

     toets 1   geen waarde-, identiteits- of rechtenhandeling zonder een besluit
               dat doorlaat
     toets 4   de kern eet geen fouten op -- dat is precies hoe een mislukte
               betaling ooit een geslaagd antwoord werd
     toets 6   de kern blijft PIEPKLEIN, en dat wordt gemeten
     toets 7   de kern voert niets uit en kent geen domein

   Draai los: node --experimental-sqlite --test test/veiligheidskern.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { maakVeiligheidskern, SOORT, EIST_BESLUIT } = require('../server/kern/commercie/veiligheidskern');
const { UITKOMST } = require('../server/kern/commercie/besluit');

const BRON = path.join(__dirname, '..', 'server', 'kern', 'commercie', 'veiligheidskern.js');
const nu = () => 1_700_000_000_000;

function opstelling() {
  const log = [];
  return { K: maakVeiligheidskern({ journaal: (r) => log.push(r), nu }), log };
}
const goed = { soort: SOORT.WAARDE, wat: 'partneruitbetaling', wie: 'kantoor',
  waarom: 'de maandelijkse afrekening', waardeCenten: 5000 };
const metBesluit = { ...goed, besluit: { uitkomst: UITKOMST.TOESTAAN, beleid: 'v1-2026' } };

/* DE BEWERING. */
test('1. geen waarde, identiteit of rechten zonder een besluit dat doorlaat', async () => {
  const { K } = opstelling();
  let gedaan = 0;
  const doen = async () => { gedaan += 1; return { ok: true }; };

  /* DE DRIE STAAN HIER VOLUIT en niet als `for (const soort of EIST_BESLUIT)`.
     Dat was de eerste versie, en een mutatie die de set terugbracht tot alleen
     WAARDE liep er dwars doorheen: de toets liep over de tabel die hij moest
     controleren, en toetste dus zichzelf. */
  assert.deepEqual([...EIST_BESLUIT].sort(), ['IDENTITEIT', 'RECHTEN', 'WAARDE'],
    'deze drie kun je niet terugnemen door een scherm te verversen');

  for (const soort of [SOORT.WAARDE, SOORT.IDENTITEIT, SOORT.RECHTEN]) {
    const zonder = await K.doe({ ...goed, soort }, doen);
    assert.equal(zonder.status, 403, soort + ' hoort een besluit te vragen');
    assert.match(zonder.error, /besluit nodig dat doorlaat/);

    for (const nee of [UITKOMST.WEIGEREN, UITKOMST.GOEDKEURING, UITKOMST.ONBEKEND, UITKOMST.UITSTELLEN]) {
      const r = await K.doe({ ...goed, soort, besluit: { uitkomst: nee } }, doen);
      assert.equal(r.status, 403, nee + ' laat niet door en hoort dus niet te openen');
    }
  }
  assert.equal(gedaan, 0, 'en er is niets uitgevoerd');

  for (const ja of [UITKOMST.TOESTAAN, UITKOMST.BEPERKT, UITKOMST.OMKEERBAAR]) {
    const r = await K.doe({ ...goed, besluit: { uitkomst: ja } }, doen);
    assert.equal(r.ok, true, ja + ' laat wel door');
  }
  assert.equal(gedaan, 3);
});

test('2. export en AI gaan wel door de kern maar vragen hun poort elders', async () => {
  const { K, log } = opstelling();
  /* Een tweede besluit eisen zou betekenen dat er twee plekken zijn waar die
     grens wordt getrokken -- consent bij export, kern/aipoort.js bij AI. */
  assert.equal(EIST_BESLUIT.has(SOORT.EXPORT), false);
  assert.equal(EIST_BESLUIT.has(SOORT.AI), false);
  assert.equal(EIST_BESLUIT.size, 3, 'en er zijn er precies drie die er wel een vragen');

  const r = await K.doe({ soort: SOORT.EXPORT, wat: 'ledendossier', wie: 'kantoor',
    waarom: 'inzageverzoek van het lid' }, async () => ({ bestand: 'x.csv' }));
  assert.equal(r.ok, true);
  assert.equal(log[0].soort, SOORT.EXPORT, 'maar het spoor staat er wel');
});

test('3. een onomkeerbare handeling draagt een naam en een reden', async () => {
  const { K } = opstelling();
  const doen = async () => 1;
  assert.match((await K.doe({ ...metBesluit, wie: '' }, doen)).error, /draagt een naam/);
  assert.match((await K.doe({ ...metBesluit, waarom: '' }, doen)).error, /draagt een reden/);
  assert.match((await K.doe({ ...metBesluit, waarom: 'x' }, doen)).error, /draagt een reden/,
    'een letter is geen reden');
  assert.match((await K.doe({ ...metBesluit, soort: 'VERZONNEN' }, doen)).error, /Onbekende soort/);
  assert.match((await K.doe(metBesluit, null)).error, /niets om uit te voeren/);
});

/* DE TWEEDE BEWERING. Een kern die fouten opeet, maakt van een mislukte betaling
   een geslaagd antwoord -- precies de fout die kern/bank/overboeken.js ooit had. */
test('4. de kern eet geen fouten op, en juist die laten een spoor', async () => {
  const { K, log } = opstelling();
  await assert.rejects(
    () => K.doe(metBesluit, async () => { throw new Error('de rail is onbereikbaar'); }),
    /onbereikbaar/);

  assert.equal(log.length, 1);
  assert.equal(log[0].gelukt, false);
  assert.match(log[0].fout, /onbereikbaar/,
    'een handeling die halverwege afbreekt is de interessantste rij in het journaal');
  assert.equal(log[0].wie, 'kantoor');
  assert.equal(log[0].waarom, 'de maandelijkse afrekening');
});

test('5. een kapot journaal blokkeert de handeling niet', async () => {
  const K = maakVeiligheidskern({ journaal: () => { throw new Error('schijf vol'); }, nu });
  const r = await K.doe(metBesluit, async () => ({ ok: true }));
  assert.equal(r.ok, true, 'het spoor is belangrijk, maar niet belangrijker dan de handeling zelf');
});

/* DE DERDE BEWERING. Een veiligheidskern van vijfhonderd regels is geen kern
   maar een tweede applicatie, en niemand leest hem meer in een keer. */
test('6. de kern blijft piepklein, en dat wordt gemeten', () => {
  const bron = fs.readFileSync(BRON, 'utf8');
  const code = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const regels = code.split('\n').filter(r => r.trim()).length;
  assert.ok(regels <= 60, 'de kern telt ' + regels + ' regels code; boven de 60 is het geen kern meer. ' +
    'Wie hier iets bij wil zetten, hoort eerst te vragen of het niet ERBUITEN kan.');
});

/* DE VIERDE BEWERING. De kern voert niets uit; hij krijgt een functie mee en
   roept die aan. Zo blijft hij klein, en zo kan hij nooit een domein worden. */
test('7. de kern kent geen domein en beslist niets zelf', () => {
  const bron = fs.readFileSync(BRON, 'utf8');
  const code = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const requires = [...code.matchAll(/require\('([^']+)'\)/g)].map(m => m[1]);
  assert.deepEqual(requires.sort(), ['../../lib/klok', './besluit'],
    'alleen de klok en de uitkomsten van het besluit; al het andere is een domein');

  /* Hij LEEST de uitkomsten en rekent er geen nieuwe uit: zou hij dat doen, dan
     is er een negende autorisatiesysteem bij in plaats van een minder. */
  assert.doesNotMatch(code, /\bbeslis\s*\(/);
  assert.doesNotMatch(code, /\bmaakBesluit\b/);
  // en hij schrijft nergens zelf
  assert.doesNotMatch(code, /\bsave\s*\(/);
  assert.doesNotMatch(code, /\bdb\./);
});

test('8. het spoor draagt wat er nodig is om achteraf te verantwoorden', async () => {
  const { K, log } = opstelling();
  await K.doe({ ...metBesluit, bewijs: 'een-token' }, async () => ({ ok: true }));
  const r = log[0];
  assert.equal(r.soort, SOORT.WAARDE);
  assert.equal(r.wat, 'partneruitbetaling');
  assert.equal(r.waardeCenten, 5000);
  assert.equal(r.besluit.uitkomst, UITKOMST.TOESTAAN);
  assert.equal(r.besluit.beleid, 'v1-2026');
  assert.equal(r.bewijs, true, 'dat er bewijs was, niet welk -- het token zelf hoort niet in een logboek');
  assert.equal(r.at, nu());
});
