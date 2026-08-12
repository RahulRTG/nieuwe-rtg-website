/* De momentlijn (LIFE.md fase 4): leven in plaats van posts.

   Wat deze toetsen bewaken is niet dat er regels uitkomen, maar de vier
   besluiten waar de lijn op staat:

     1. hij haalt niets zelf op -- hij hergroepeert het beeld van de graaf
     2. geen verleden verder dan vandaag
     3. geen lege vakken
     4. geen afteller, en `later` is een telling en geen staart

   Bij elke toets staat de mutatie die hem hoort te laten zakken; ze zijn alle
   met die mutatie gedraaid en gezien zakken (LAT.md regel 2).

   De klok staat vast waar dat kan: een lijn die op "vandaag" rekent, toetst
   anders elke dag iets anders. Waar dat niet kan (het vak-label hangt aan de
   echte weekdag) rekent de toets mee met dezelfde datums als de code. */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakLijn = require('../server/kern/socialegraaf/lijn');

const VANDAAG = new Date().toISOString().slice(0, 10);
const dag = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const L = maakLijn();

const moment = (o) => Object.assign({ soort: 'bijeenkomst', titel: 'X', wie: '', tijd: null,
  wacht: '', bron: 'Genootschap', link: '/apps/genootschap.html' }, o);

/* DE MUTATIE: geef lijn() de kern in plaats van het beeld en laat hem zelf de
   bronnen uitlezen. Dan bestaan er twee plekken die dezelfde negen domeinen
   ophalen (LAT.md regel 4). Deze toets zakt dan meteen: hij geeft alleen een
   beeld en heeft helemaal geen kern. */
test('de lijn haalt niets op: hij hergroepeert het beeld dat hij krijgt', () => {
  assert.deepEqual(Object.keys(L).sort(), ['WD', 'lijn', 'vakVan']);
  const r = L.lijn({ momenten: [moment({ wanneer: VANDAAG, titel: 'Vandaag' })], vooruit: { komt: [] } });
  assert.equal(r.vakken[0].sleutel, 'vandaag');
  assert.equal(r.vakken[0].regels[0].titel, 'Vandaag');
});

/* Wat gisteren was, is geschiedenis. Een lijn die achteruit blijft groeien is
   een archief -- of erger, een feed.

   EERLIJK OVER WELKE WACHT DIT IS. De eerst opgeschreven mutatie was "haal
   `|| m.wanneer < nu` weg uit het filter", en die is gedraaid en liet deze toets
   NIET zakken: vakVan() geeft al null voor een datum die voorbij is, dus het
   filter was een tweede wacht voor dezelfde regel. Dat filter is daarna weg
   gehaald -- twee kopieen van een regel lopen stil uiteen (LAT.md regel 4) -- en
   dit staat hier in plaats van weggepoetst (regel 6).

   DE MUTATIE DIE HEM WEL LAAT ZAKKEN: laat vakVan() een vak teruggeven voor
   n < 0 in plaats van null. */
test('niets van voor vandaag komt op de lijn', () => {
  const r = L.lijn({
    momenten: [
      moment({ wanneer: dag(-1), titel: 'Gisteren' }),
      moment({ wanneer: dag(-30), titel: 'Vorige maand' }),
      moment({ wanneer: VANDAAG, titel: 'Nu' })
    ],
    vooruit: { komt: [{ id: 't1', wat: 'verjaardag', waarvan: 'Noor', datum: dag(-2), bron: 'Attenties' }] }
  });
  const titels = r.vakken.flatMap(v => v.regels.map(x => x.titel));
  assert.deepEqual(titels, ['Nu']);
});

/* Een verlopen termijn hoort in de cockpit en niet op een tijdlijn: er is geen
   dag meer waarop hij staat. Dat volgt hier uit WELKE BRON gelezen wordt --
   `vooruit.komt` en niet `vooruit.achterstallig` -- en niet uit een
   datumvergelijking.

   Ook hier is de eerst bedachte mutatie ("neem achterstallig er ook bij")
   gedraaid zonder dat deze toets zakte, en om dezelfde reden: die rijen hebben
   een datum in het verleden en vakVan() weigert ze alsnog. De toets staat er
   niettemin, want hij legt het BESLUIT vast: deze lijn leest de komt-lijst. */
test('achterstallige termijnen staan niet op de lijn', () => {
  const r = L.lijn({
    momenten: [],
    vooruit: {
      achterstallig: [{ id: 't0', wat: 'paspoort', waarvan: 'Sam', datum: dag(-9), bron: 'Entourage' }],
      komt: []
    }
  });
  assert.deepEqual(r.vakken, []);
});

/* Een termijn wordt pas een regel als je ziet OVER WIE hij gaat. "verjaardag"
   op een tijdlijn is nietszeggend; "Noor - verjaardag" is een moment.

   DE MUTATIE: laat `waarvan` weg uit uitTermijn(). */
test('een termijn draagt de naam waar hij over gaat', () => {
  const r = L.lijn({
    momenten: [],
    vooruit: { komt: [{ id: 't1', wat: 'verjaardag', waarvan: 'Noor', datum: VANDAAG, bron: 'Attenties' }] }
  });
  assert.equal(r.vakken[0].regels[0].titel, 'Noor — verjaardag');
  assert.equal(r.vakken[0].regels[0].soort, 'termijn');
});

/* Vandaag en morgen hebben een eigen naam; de rest van de week heet bij de dag.
   Dat is hoe het in iemands hoofd staat -- niet "over 3 dagen" maar "vrijdag",
   en dat is meteen het verschil met een afteller.

   DE MUTATIE: geef de vakken een label met een aantal dagen erin. */
test('vandaag en morgen bij naam, de rest van de week bij weekdag', () => {
  assert.equal(L.vakVan(VANDAAG, VANDAAG).label, 'Vandaag');
  assert.equal(L.vakVan(dag(1), VANDAAG).label, 'Morgen');
  for (const d of [VANDAAG, dag(1), dag(2), dag(9), dag(40)]) {
    const v = L.vakVan(d, VANDAAG);
    assert.ok(!/\d/.test(v.label), 'geen getal in een vaklabel: ' + v.label);
    assert.ok(!/nog |bijna|straks/i.test(v.label), 'geen afteltaal: ' + v.label);
  }
});

/* Een vaste week, doorgerekend vanaf een maandag, zodat de vakindeling zelf
   getoetst is en niet alleen de labels. */
test('de vakken lopen van vandaag via volgende week naar deze maand en later', () => {
  const MAANDAG = '2026-08-10'; // een maandag
  const v = (d) => L.vakVan(d, MAANDAG).sleutel;
  assert.equal(v('2026-08-10'), 'vandaag');
  assert.equal(v('2026-08-11'), 'morgen');
  assert.equal(v('2026-08-14'), 'wd5', 'vrijdag valt in deze week');
  assert.equal(v('2026-08-16'), 'wd0', 'zondag is de laatste dag van deze week');
  assert.equal(v('2026-08-17'), 'volgendeweek');
  assert.equal(v('2026-08-23'), 'volgendeweek');
  assert.equal(v('2026-08-28'), 'dezemaand');
  assert.equal(v('2026-09-05'), 'later');
  assert.equal(L.vakVan('2026-08-09', MAANDAG), null, 'gisteren is geen vak');
});

/* GEEN LEGE VAKKEN. Een week zonder afspraken is geen gat om op te vullen --
   hetzelfde besluit als de levenslijn van RTFoundation (LEVEN.md par. 1.1): een
   leeg vak leest als iets dat u mist.

   DE MUTATIE: bouw de vakken uit een vaste lijst in plaats van uit wat er is. */
test('een vak zonder regels bestaat niet', () => {
  const r = L.lijn({ momenten: [moment({ wanneer: dag(1), titel: 'Morgen' })], vooruit: { komt: [] } });
  assert.equal(r.vakken.length, 1);
  assert.equal(r.vakken[0].sleutel, 'morgen');
  for (const vak of r.vakken) assert.ok(vak.regels.length, 'leeg vak: ' + vak.sleutel);
});

/* `later` is een TELLING en geen lijst: een tijdlijn die tot in het volgende
   jaar doorloopt is geen lijn meer maar een archief -- en oneindige lijsten zijn
   precies wat CLAUDE.md verbiedt.

   DE MUTATIE: geef `later` als array met de regels erin. */
test('later is een telling en geen staart', () => {
  const r = L.lijn({
    momenten: [dag(60), dag(90), dag(200)].map((d, i) => moment({ wanneer: d, titel: 'V' + i })),
    vooruit: { komt: [] }
  });
  assert.equal(r.later, 3);
  assert.equal(typeof r.later, 'number');
  assert.deepEqual(r.vakken, [], 'wat later is, vult geen vak');
});

/* Binnen een vak op tijd, want een dag met drie dingen leest van vroeg naar
   laat. Dat is de enige sortering die de lijn zelf doet.

   DE MUTATIE: laat de sortering binnen een vak weg. */
test('binnen een vak staat vroeg boven laat', () => {
  const r = L.lijn({
    momenten: [
      moment({ wanneer: VANDAAG, tijd: '20:00', titel: 'Avond' }),
      moment({ wanneer: VANDAAG, tijd: '09:00', titel: 'Ochtend' }),
      moment({ wanneer: VANDAAG, tijd: '13:00', titel: 'Middag' })
    ],
    vooruit: { komt: [] }
  });
  assert.deepEqual(r.vakken[0].regels.map(x => x.titel), ['Ochtend', 'Middag', 'Avond']);
});

/* Een stille bron blijft stil, ook hier: de lijn erft de melding van de graaf.
   Zou hij hem laten vallen, dan ziet een lijn waaruit een bron is weggevallen er
   volkomen normaal uit.

   DE MUTATIE: haal `stil` uit de teruggave van lijn(). */
test('de lijn erft de melding dat een bron stil bleef', () => {
  const r = L.lijn({ momenten: [], vooruit: { komt: [] }, stil: ['gesprekken', 'meet'] });
  assert.deepEqual(r.stil, ['gesprekken', 'meet']);
});
