/* ============================================================================
   DE SPLITSING VAN `handhaver` -- en de reden dat twee kolommen niet genoeg zijn.

   LAT.md regel 14 zegt dat een bewijsveld een bewijsrelatie draagt. `handhaver`
   droeg er twee: wat ROOD WORDT en wat de regel in het PRODUCT uitvoert. Sinds
   die splitsing heten ze `bewaaktDoor` en `draagt`.

   MAAR TWEE KOLOMMEN SLUITEN DE FOUTKLASSE NIET. Wie een servermodule onder
   `bewaaktDoor` zet, heeft de oude verwarring terug -- alleen netter opgemaakt,
   en met een getal eronder dat nu officieel "wachters" heet. Deze toets bestaat
   om precies die twee omkeringen af te wijzen:

     een DRAGER onder bewaaktDoor   -> rood
     een WACHTER onder draagt       -> rood

   Beide zijn met de hand nagetrokken en zakken. Zonder die twee zou de splitsing
   kosmetisch zijn.

   Draai los: node --test test/wetrelatie.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const R = require('../scripts/lib/wetrelatie.js');
const { wetten } = require('../WETTEN.json');

/* MUTATIE GEZIEN ZAKKEN: bij merk-pearl-is-warm `bewaaktDoor` hernoemd naar
   `handhaver`; zakte met de naam van de wet erbij. */
test('1. geen enkele wet draagt nog het oude veld `handhaver`', () => {
  const legacy = wetten.filter(w => w.handhaver !== undefined).map(w => w.id);
  assert.deepEqual(legacy, [],
    'deze wetten dragen nog `handhaver`, een veld met twee betekenissen. Splits hem in `bewaaktDoor` ' +
    '(wat rood wordt) en `draagt` (waar de regel in het product staat) -- LAT.md regel 14: ' + legacy.join(', '));
});

/* MUTATIE GEZIEN ZAKKEN: public/shared/rtg-materiaal.css van `draagt` naar
   `bewaaktDoor` verplaatst; zakte. Dit is de belangrijkste bewering van dit
   bestand -- zonder hem is de splitsing twee kolommen zonder betekenis. */
test('2. onder `bewaaktDoor` staat alleen wat uit zichzelf rood kan worden', () => {
  const fout = [];
  for (const w of wetten) {
    for (const p of (w.bewaaktDoor || [])) {
      const kant = R.kantVan(p);
      if (kant !== 'bewaaktDoor') fout.push(w.id + ': ' + p + ' (' + kant + ')');
    }
  }
  assert.deepEqual(fout, [],
    'deze paden staan als wachter maar kunnen nooit uit zichzelf rood worden -- een css-bestand, een ' +
    'servermodule of een bibliotheek wordt door een ander aangeroepen. Dat is de oude verwarring terug, ' +
    'alleen met een nettere kop: ' + fout.join(', '));
});

/* MUTATIE GEZIEN ZAKKEN: test/materiaal.test.js van `bewaaktDoor` naar `draagt`
   verplaatst; zakte. De andere kant van dezelfde fout. */
test('3. onder `draagt` staat niets dat zelf een wachter is', () => {
  const fout = [];
  for (const w of wetten) {
    for (const p of (w.draagt || [])) {
      const kant = R.kantVan(p);
      if (kant !== 'draagt') fout.push(w.id + ': ' + p + ' (' + kant + ')');
    }
  }
  assert.deepEqual(fout, [],
    'deze paden staan als drager maar zijn een wachter: een toets voert de regel niet uit in het product, ' +
    'hij wordt er rood van. Wie ze bij de dragers telt, telt zijn eigen meetapparaat als implementatie: ' +
    fout.join(', '));
});

/* MUTATIE GEZIEN ZAKKEN: bij techniek-meter-kent-zijn-grens de `bewaaktDoor`
   leeggemaakt terwijl er een sabotage-recept staat; zakte hier. */
test('4. een wet zonder wachter is mensenwerk, of noemt hem in zijn sabotage', () => {
  const zwevend = [];
  for (const w of wetten) {
    if ((w.bewaaktDoor || []).length) continue;
    const uitRecept = (w.sabotage && w.sabotage.wachters) || [];
    if (!w.sabotage && w.mensenwerk) continue;      // eerlijke stand, staat zo in het register
    if (uitRecept.length) continue;                 // de wachter staat in het recept
    zwevend.push(w.id);
  }
  assert.deepEqual(zwevend, [],
    'deze wetten hebben geen wachter in `bewaaktDoor`, geen wachter in hun sabotage-recept, en zijn niet ' +
    'als mensenwerk verklaard. Dan staat er een wet die niemand tegenhoudt zonder dat iemand dat heeft ' +
    'opgeschreven: ' + zwevend.join(', '));

  /* En de vindplaats zelf is een bevinding: concern-juridisch-gegeven-heeft-een-bron
     noemt zijn wachter ALLEEN in het sabotage-recept. Dat is geen overbelasting
     van een veld maar een tweede vindplaats voor dezelfde relatie, en het hoort
     zichtbaar te blijven in plaats van stil te worden gerepareerd. */
  const alleenInRecept = wetten.filter(w => !(w.bewaaktDoor || []).length &&
    ((w.sabotage && w.sabotage.wachters) || []).length).map(w => w.id);
  assert.ok(alleenInRecept.length <= 1,
    'er zijn ' + alleenInRecept.length + ' wetten die hun wachter alleen in het sabotage-recept noemen ' +
    '(was 1 op 13 september 2026). Twee vindplaatsen voor dezelfde relatie lopen een keer uiteen: ' +
    alleenInRecept.join(', '));
});

/* MUTATIE GEZIEN ZAKKEN: in kantVan() de test/-tak weggehaald; toets 5 zakte op
   de zelfijking voordat toets 2 en 3 iets konden zeggen. */
test('5. zelfijking: de indeler herkent de twee kanten echt', () => {
  assert.equal(R.kantVan('test/materiaal.test.js'), 'bewaaktDoor', 'een toetsbestand is een wachter');
  assert.equal(R.kantVan('scripts/check.js'), 'bewaaktDoor',
    'scripts/check.js staat in package.json als opdracht en is de keuring van dit huis');
  assert.equal(R.kantVan('server/kern/pay/poort.js'), 'draagt', 'een servermodule voert de regel uit');
  assert.equal(R.kantVan('public/shared/rtg-materiaal.css'), 'draagt', 'een stijlblad wordt nooit uit zichzelf rood');
  assert.equal(R.kantVan('scripts/lib/ijking.js'), 'draagt',
    'een bibliotheek wordt door een ander aangeroepen; dit was de tweede keer dat deze fout werd gemaakt');
  assert.equal(R.kantVan('test/helper.js'), 'draagt', 'een helper in test/ is geen toets');

  /* Een indeler die ALLES een kant op stuurt, zou toets 2 en 3 vanzelf groen
     maken. Daarom moet hij ook iets NIET kunnen plaatsen. */
  assert.equal(R.kantVan('iets/onbekends.txt'), 'onbeslist',
    'de indeler hoort onbeslist te kunnen zeggen; een indeler die alles plaatst, keurt niets af');

  for (const [pad, b] of Object.entries(R.BESLOTEN)) {
    assert.ok(String(b.waarom || '').length > 30,
      'het besluit over ' + pad + ' draagt geen reden; dan is het een uitzondering zonder grond');
  }
});
