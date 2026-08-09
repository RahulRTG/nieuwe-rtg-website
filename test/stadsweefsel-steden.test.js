/* Het stadsweefsel draagt meer dan één stad (kern/stadsweefsel/steden.js).

   DE BOOM HAD ALTIJD AL EEN STAD-NIVEAU ALS WORTEL, dus meerdere wortels
   pasten er in. Wat ontbrak waren drie dingen, en deze toets houdt ze alle
   drie vast:

   1. NIEMAND BOUWDE ER EEN TWEEDE. zorgGeografie() stopte zodra er iets stond.
   2. DE BEVRAGINGEN KENDEN GEEN STAD. `namen('zone')` gaf de zones van alles
      bij elkaar. Dat leest als één stad zolang er één is, en is stilzwijgend
      fout zodra er twee zijn -- een veldploeg ziet dan zones die duizend
      kilometer verderop liggen. Dit is het gevaarlijkste van de drie, want er
      gaat niets kapot: er staat gewoon te veel.
   3. DE GRENZEN WAREN DIE VAN IBIZA. Elk punt werd getoetst aan de vaste
      rechthoek uit kern/navigatie, dus een gebied in een tweede stad viel per
      definitie buiten de stadsgrenzen.

   EN TWEE STEDEN MOGEN ELKAAR NIET OVERLAPPEN. Dan hoort een punt bij allebei
   en gaan er twee ploegen naar dezelfde lantaarn -- precies de reden die in de
   kop van geografieseed.js al stond voor de zones onderling.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de stad-as uit namen()/opNiveau() halen (weer alles teruggeven)
     -> "elke stad heeft haar eigen zones" ZAKT (RAAK)
   - de overlaptoets uit stadErbij() halen
     -> "twee steden mogen elkaar niet overlappen" ZAKT (RAAK)
   - het voorvoegsel weglaten, zodat de ids van de tweede stad botsen
     -> "de eerste stad houdt haar eigen ids" ZAKT (RAAK)
   - een onbekende stad weer als "geen stad" behandelen (alles teruggeven)
     -> "elke stad heeft haar eigen zones" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

function maak() {
  const db = { data: {} };
  const { weefsel } = require('../server/kern/stadsweefsel')({
    db, save: () => {}, crypto, sseToOffice: () => {}, melderSeintje: () => {},
    log: { uitzondering: () => {} }
  });
  return { db, w: weefsel };
}

test('er staat één stad, en er kan er een bij', () => {
  const { w } = maak();
  assert.deepEqual(w.weefselSteden().steden.map(s => s.naam), ['RTG Stad']);

  const r = w.weefselStadErbij({ naam: 'Antwerpen', lat: 51.22, lng: 4.40 });
  assert.equal(r.status, 200);
  assert.equal(r.stad.id, 'G-antwerpen-stad');
  assert.equal(r.zones.length, 6, 'met het hele startraster eronder');
  assert.ok(r.gebieden >= 25, 'zones, straatsegmenten, buurten, wijken en de stad zelf: ' + r.gebieden);
  assert.match(r.let, /generieke namen/, 'en er staat bij dat die namen hernoemd horen te worden');
  assert.match(r.let, /geen wegennet/, 'en dat er geen wegennet onder ligt');

  assert.deepEqual(w.weefselSteden().steden.map(s => s.naam), ['RTG Stad', 'Antwerpen']);
});

test('elke stad heeft haar eigen zones', () => {
  /* DE KERN, en de gevaarlijkste van de drie: er gaat niets kapot als dit
     misgaat, er staat alleen te veel. */
  const { w } = maak();
  w.weefselStadErbij({ naam: 'Antwerpen', lat: 51.22, lng: 4.40 });

  assert.equal(w.weefselZones('Antwerpen').length, 6);
  assert.equal(w.weefselZones('RTG Stad').length, 6);
  assert.equal(w.weefselZones().length, 12, 'zonder stad zijn het de zones van alles');

  /* EEN STAD DIE NIET BESTAAT GEEFT NIETS, en niet "alles". Dat verschil is
     een echte fout geweest: de stadsstart vroeg de zones van een stad die nog
     niet gebouwd was, kreeg die van alle steden terug, en meldde de
     weefselstap groen terwijl er niets stond. */
  assert.deepEqual(w.weefselZones('Bestaat Niet'), []);
  assert.deepEqual(w.weefselSteden().steden.map(s => s.zones), [6, 6]);
});

test('de eerste stad houdt haar eigen ids', () => {
  /* Er wordt niets verhuisd om een functie toe te voegen. Botsen de ids van de
     tweede stad met de eerste, dan raken de gebieden door elkaar en wijst een
     bestaande melding ineens naar een straat in een andere stad. */
  const { db, w } = maak();
  w.weefselZones();
  const voor = db.data.weefsel.gebieden.map(g => g.id);
  assert.ok(voor.includes('G-stad') && voor.includes('G-marina') && voor.includes('G-marina-laan'));

  w.weefselStadErbij({ naam: 'Antwerpen', lat: 51.22, lng: 4.40 });
  const na = db.data.weefsel.gebieden.map(g => g.id);
  for (const id of voor) assert.ok(na.includes(id), 'de oude id ' + id + ' staat er nog');
  assert.equal(new Set(na).size, na.length, 'en geen enkele id komt twee keer voor');
  assert.ok(na.includes('G-antwerpen-marina'), 'de tweede stad draagt haar eigen voorvoegsel');
});

test('twee steden mogen elkaar niet overlappen', () => {
  const { w } = maak();
  w.weefselStadErbij({ naam: 'Antwerpen', lat: 51.22, lng: 4.40 });

  const dichtbij = w.weefselStadErbij({ naam: 'Bijna-Antwerpen', lat: 51.221, lng: 4.401 });
  assert.equal(dichtbij.status, 409);
  assert.match(dichtbij.error, /laten een punt bij allebei horen/);

  /* En op het middelpunt van de eerste stad ook niet. */
  assert.equal(w.weefselStadErbij({ naam: 'Naast RTG', lat: 38.91, lng: 1.43 }).status, 409);
  assert.equal(w.weefselSteden().steden.length, 2, 'er is niets halfs blijven staan');
});

test('een stad heeft een naam, een middelpunt en een unieke naam nodig', () => {
  const { w } = maak();
  assert.equal(w.weefselStadErbij({ lat: 51.22, lng: 4.40 }).status, 400);
  assert.equal(w.weefselStadErbij({ naam: 'Zonder punt' }).status, 400);
  assert.equal(w.weefselStadErbij({ naam: 'RTG Stad', lat: 51.22, lng: 4.40 }).status, 409,
    'dezelfde naam twee keer kan niet');
});

test('een punt in de tweede stad landt in de tweede stad', () => {
  const { w } = maak();
  w.weefselStadErbij({ naam: 'Antwerpen', lat: 51.22, lng: 4.40 });

  const p = w.weefselPlaats({ lat: 51.222, lng: 4.401 });
  assert.equal(p.binnenStad, true);
  assert.ok(p.zone.id.startsWith('G-antwerpen-'), 'de zone hoort bij Antwerpen: ' + p.zone.id);
  assert.equal(p.pad[0].niveau, 'stad');
  assert.equal(p.pad[0].naam, 'Antwerpen', 'en het kruimelpad begint bij de juiste stad');

  /* En een punt in de eerste stad nog steeds in de eerste. */
  const q = w.weefselPlaats({ lat: 38.915, lng: 1.435 });
  assert.equal(q.binnenStad, true);
  assert.equal(q.pad[0].naam, 'RTG Stad');
});

test('een gebied hangt onder een gebied, en een stad maak je niet zo', () => {
  const { w } = maak();
  w.weefselZones();
  const wees = w.weefselGebiedMaak({ niveau: 'buurt', naam: 'Zwevend', punten: [{ lat: 52.34, lng: 4.87 }] });
  assert.equal(wees.status, 400);
  assert.match(wees.error, /hangt onder een gebied/);

  const kaal = w.weefselGebiedMaak({ niveau: 'stad', naam: 'Losse stad', punten: [{ lat: 52.34, lng: 4.87 }] });
  assert.equal(kaal.status, 400);
  assert.match(kaal.error, /stadErbij/);
});

test('een gebied in de tweede stad mag daar liggen en niet in de eerste', () => {
  /* DIT KON VOOR DE VERBOUWING NIET. Elk punt werd getoetst aan de rechthoek
     van Ibiza, dus een straat in Antwerpen viel per definitie buiten de
     stadsgrenzen en die stad kon nooit gevuld worden. */
  const { w } = maak();
  w.weefselStadErbij({ naam: 'Antwerpen', lat: 51.22, lng: 4.40 });
  const zone = w.weefselGebieden({ niveau: 'zone' }).gebieden.find(g => g.id === 'G-antwerpen-centrum');

  const goed = w.weefselGebiedMaak({ niveau: 'straatsegment', naam: 'Scheldekaai', ouder: zone.id,
    punten: [zone.geometrie.punten[0], zone.centrum] });
  assert.equal(goed.ok, true, JSON.stringify(goed));

  /* En een punt uit de andere stad hoort er niet bij. */
  const fout = w.weefselGebiedMaak({ niveau: 'straatsegment', naam: 'Verdwaald', ouder: zone.id,
    punten: [{ lat: 38.915, lng: 1.435 }] });
  assert.equal(fout.status, 400);
  assert.match(fout.error, /binnen de grenzen van Antwerpen/);
});
