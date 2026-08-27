/* Master data voor bedrijven en locaties (kern/command/mdm.js en
   kern/command/mdmsamen.js).

   WAT DEZE TOETS VOORAL BEWAAKT zijn de twee kanten waarop een
   dubbelendetector fout kan gaan, en ze zijn niet even erg:

   - TE RUIM is de duurste. "Aguamarina" en "Aguamarina Ibiza" samentrekken maakt
     van twee bedrijven één bedrijf, en dat merkt niemand tot er een factuur bij
     de verkeerde partij ligt. Daarom staat hier een geval dat NIET mag matchen.
   - TE STRENG kost hooguit een gemiste dubbele, en die blijft zichtbaar.

   En het derde: er wordt hier NOOIT vanzelf samengevoegd, en samenvoegen wist
   niets. Verwijderen zou elke bestelling die naar zo'n rij wees tot wees maken
   -- precies wat kwaliteit.js meet -- en het is niet terug te draaien.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - naamNorm ook de losse woorden laten sorteren en dedupliceren
     -> "twee namen die op elkaar lijken zijn nog niet dezelfde" ZAKT (RAAK)
   - voegSamen() de verliezers laten verwijderen in plaats van merken
     -> "samenvoegen wist niets en is terug te draaien" ZAKT (RAAK)
   - de samengevoegde rijen weer meetellen als kandidaat
     -> "wat al is samengevoegd komt niet opnieuw in de lijst" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakMdm, naamNorm } = require('../server/kern/command/mdm');
const maakCmdOpslag = require('../server/kern/command/opslag');
const { plaatsNorm } = require('../server/functies/toegang');

const PARTIJEN = [
  { type: 'zaak', collectie: 'suppliers', sleutel: 'code', naam: 'name', plaats: 'city', loc: 'loc' },
  { type: 'partner', collectie: 'partners', sleutel: 'code', naam: 'name', plaats: 'city' }
];

function maak(extra) {
  const db = { data: Object.assign({
    suppliers: [
      { code: 'A1', name: 'Aguamarina Ibiza B.V.', city: 'Ibiza', loc: { lat: 38.984, lng: 1.537 } },
      { code: 'A2', name: 'aguamarina ibiza', city: 'ibiza', loc: { lat: 38.9841, lng: 1.5371 } },
      /* Lijkt erop en is het NIET: een woord verschil is een ander bedrijf. */
      { code: 'A3', name: 'Aguamarina', city: 'Ibiza' },
      { code: 'B1', name: 'Kikunoi', city: 'Kyoto' }
    ],
    partners: [{ code: 'P1', name: 'Nova van Dijk', city: 'Amsterdam' }]
  }, extra || {}) };
  const regels = [];
  const mdm = maakMdm({ db, opslag: maakCmdOpslag({ db }), save: () => {}, journaal: { noteer: r => regels.push(r) },
    partijen: PARTIJEN, plaatsNorm });
  return { db, mdm, regels };
}

test('dezelfde naam in verschillende schrijfwijzen is één kandidaat', () => {
  const { mdm } = maak();
  const g = mdm.bedrijven();
  assert.equal(g.length, 1, 'precies één groep: ' + JSON.stringify(g.map(x => x.sleutel)));
  assert.deepEqual(g[0].leden.map(l => l.id).sort(), ['A1', 'A2']);
  assert.equal(g[0].zelfdePlaats, true);
  assert.ok(g[0].afstandM != null && g[0].afstandM < 50, 'de afstand staat erbij: ' + g[0].afstandM);
  assert.equal(g[0].zekerheid, 'hoog');
  assert.match(g[0].let, /KUNNEN twee bedrijven zijn/, 'en de twijfel staat er ook bij');
});

test('twee namen die op elkaar lijken zijn nog niet dezelfde', () => {
  /* DE DUURSTE KANT. "Aguamarina" en "Aguamarina Ibiza" samentrekken maakt van
     twee bedrijven één, en dat merkt niemand tot er een factuur bij de
     verkeerde partij ligt. */
  const { mdm } = maak();
  const sleutels = mdm.bedrijven().flatMap(g => g.leden.map(l => l.id));
  assert.ok(!sleutels.includes('A3'), 'Aguamarina hoort niet bij Aguamarina Ibiza');
  assert.notEqual(naamNorm('Aguamarina'), naamNorm('Aguamarina Ibiza'));
  assert.equal(naamNorm('Aguamarina Ibiza B.V.'), naamNorm('aguamarina ibiza'),
    'een rechtsvorm en leestekens tellen wel niet mee');
});

test('locaties: schrijfwijzen vallen samen, buren worden alleen gemeld', () => {
  const { mdm } = maak();
  const l = mdm.locaties();
  const ibiza = l.plaatsen.find(p => p.plaats === 'ibiza');
  assert.ok(ibiza, 'Ibiza en ibiza zijn één plaats');
  assert.equal(ibiza.meerdereSchrijfwijzen, true);
  assert.ok(ibiza.schrijfwijzen.includes('Ibiza') && ibiza.schrijfwijzen.includes('ibiza'),
    'met beide schrijfwijzen erbij: ' + ibiza.schrijfwijzen);
  assert.ok(l.plaatsen.some(p => p.plaats === 'kyoto'));
  for (const d of l.dichtbij) assert.match(d.let, /vraag, geen samenvoeging/);
});

test('het gouden record kiest per veld en zegt waar het strijdig is', () => {
  const { mdm } = maak();
  const g = mdm.bedrijven()[0];
  const goud = mdm.gouden(g.sleutel);
  assert.equal(goud.leden.length, 2);
  assert.equal(goud.velden.city.waarde, 'Ibiza');
  assert.ok(goud.velden.city.alternatieven.some(a => a.waarde === 'ibiza'),
    'de andere schrijfwijze staat als alternatief');
  assert.ok(goud.strijdig.includes('code'), 'de codes spreken elkaar tegen, en dat is het punt');
  assert.equal(goud.aard.kandidaten, 'gemeten');
  assert.match(goud.aard.velden, /aangegeven/);
  assert.equal(mdm.gouden('bestaatniet').status, 404);
});

test('samenvoegen wist niets en is terug te draaien', () => {
  const { db, mdm, regels } = maak();
  const r = mdm.voegSamen({ soort: 'zaak', id: 'A1' }, [{ soort: 'zaak', id: 'A2' }], 'ik', 'zelfde zaak');
  assert.equal(r.geraakt.length, 1);
  assert.equal(db.data.suppliers.length, 4, 'er is geen enkele rij verdwenen');
  assert.equal(db.data.suppliers.find(x => x.code === 'A2').mdmSamengevoegdIn.id, 'A1');
  assert.ok(regels.some(x => x.actie === 'partijen samengevoegd'), 'het staat in het journaal');
  assert.equal(r.terugDraaibaar, true);

  const t = mdm.terug([{ soort: 'zaak', id: 'A2' }], 'ik');
  assert.equal(t.geraakt.length, 1);
  assert.equal(db.data.suppliers.find(x => x.code === 'A2').mdmSamengevoegdIn, undefined);
  assert.equal(mdm.terug([{ soort: 'zaak', id: 'A2' }], 'ik').status, 400, 'twee keer terug kan niet');
});

test('wat al is samengevoegd komt niet opnieuw in de lijst', () => {
  const { mdm } = maak();
  assert.equal(mdm.bedrijven().length, 1);
  mdm.voegSamen({ soort: 'zaak', id: 'A1' }, [{ soort: 'zaak', id: 'A2' }], 'ik', 'zelfde zaak');
  assert.equal(mdm.bedrijven().length, 0, 'de groep is afgehandeld en hoort niet elke week terug te komen');
  assert.equal(mdm.meet().samengevoegd, 1);
});

test('samenvoegen gaat nooit vanzelf, en een onbekend doel is een fout', () => {
  const { mdm } = maak();
  const m = mdm.meet();
  assert.match(m.let, /nooit vanzelf samengevoegd/);
  assert.equal(mdm.voegSamen({ soort: 'zaak', id: 'BESTAATNIET' }, [{ soort: 'zaak', id: 'A2' }], 'ik').status, 404);
  assert.equal(mdm.voegSamen({ soort: 'zaak', id: 'A1' }, [], 'ik').status, 400);
  assert.ok(m.bronnen.some(b => b.collectie === 'suppliers' && b.naamVeld === 'name'),
    'en de uitslag zegt welke tabel gebruikt is: ' + JSON.stringify(m.bronnen));
});
