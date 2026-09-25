/* HET BEDRIJFSMAATREGISTER EN ZIJN MEETER (server/kern/bedrijfsmaat/,
   scripts/bedrijfsmaat.js, BEDRIJFSMAAT.json).

   Wat hier vastligt:
   1. de groepspoort: onder de grens geen waarde, geen nul, en ook het aantal niet;
      zonder groepsgrootte ook niets; een maat kan strenger zijn dan zijn klasse,
      nooit soepeler;
   2. de vorm: elke maat draagt precies een economische wereld (C1), elk ontbrekend
      element een reden, en elk domein van de eigenaar heeft een maat;
   3. de afleiding: een citaat dat niet klopt maakt het element afwezig en komt
      op de lijst `verworpen`; een afgeleide bron erft het gat van wat eronder ligt;
   4. een bron, projectie of bewijs die alleen in COMMENTAAR staat, telt niet;
   5. de catalogus klopt tegen de code, en BEDRIJFSMAAT.json is gelijk aan een
      verse meting;
   6. de besluiten C1 en C2 reizen mee in het register.

   Draai los: node --test test/bedrijfsmaat.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const B = require('../server/kern/bedrijfsmaat');
const P = require('../server/kern/bedrijfsmaat/poort');
const M = require('../scripts/bedrijfsmaat');

const lid = { id: 't', privacy: 'leden', minGroep: 10 };

test('1. de groepspoort laat onder de grens geen waarde en geen aantal door', () => {
  const klein = P.toon(lid, { waarde: 4200, n: 3 });
  assert.equal(klein.stand, P.TE_KLEINE_GROEP);
  assert.deepEqual(Object.keys(klein).sort(), ['grens', 'reden', 'stand'], 'alleen stand, grens en reden -- geen waarde, geen n');
  assert.equal(klein.grens, 10);
  assert.ok(!JSON.stringify(klein).includes('4200') && !/\b3\b/.test(JSON.stringify(klein)), 'de waarde en het aantal lekken niet via de reden');
  const onbekend = P.toon(lid, { waarde: 4200 });
  assert.equal(onbekend.stand, P.GROEP_ONBEKEND, 'zonder groepsgrootte geen waarde');
  assert.ok(!('waarde' in onbekend));
  assert.equal(P.toon(lid, { waarde: 4200, n: 10 }).waarde, 4200, 'op de grens mag het');
  assert.equal(P.toon({ privacy: 'huis', minGroep: null }, { waarde: 7 }).waarde, 7, 'over RTG zelf is geen groep nodig');
  assert.equal(P.toon({ privacy: 'leden', minGroep: 25 }, { waarde: 1, n: 20 }).stand, P.TE_KLEINE_GROEP, 'een maat mag strenger zijn');
  assert.equal(P.toon({ privacy: 'leden', minGroep: 2 }, { waarde: 1, n: 5 }).stand, P.TE_KLEINE_GROEP, 'maar niet soepeler dan zijn klasse');
  assert.equal(P.toon({ privacy: 'verzonnen' }, { waarde: 1, n: 99 }).stand, P.GROEP_ONBEKEND, 'een onbekende klasse toont niets');
});

test('2. de vorm: een wereld per maat (C1), een reden per gat, elk domein gedekt', () => {
  assert.deepEqual(B.vormfouten(), []);
  const werelden = new Set(require('../server/kern/economie/werelden').WERELDEN.map(w => w.id));
  for (const m of B.MATEN) assert.ok(werelden.has(m.wereld), m.id + ' draagt geen economische wereld');
  for (const d of B.DOMEINEN) assert.ok(B.MATEN.some(m => m.domein === d), 'domein zonder maat: ' + d);
  /* De vormregels moeten zelf uitslaan: een maat zonder wereld en zonder reden. */
  const kapot = Object.assign({}, B.MATEN[0], { wereld: undefined, definitie: null, waarom: {} });
  B.MATEN.push(kapot);
  try {
    const f = B.vormfouten().join(' | ');
    assert.match(f, /C1: geen of een onbekende economische wereld/);
    assert.match(f, /dubbele id/);
  } finally { B.MATEN.pop(); }
});

test('3. een citaat dat niet klopt maakt het element afwezig, en een afgeleide bron erft het gat', () => {
  const echt = B.beoordeel(M.maakKlopt());
  const doel = echt.maten.find(m => m.status === 'bestaat' && Array.isArray(B.opId().get(m.id).projectie));
  assert.ok(doel, 'er is een bestaande maat met een projectiecitaat');
  const citaat = B.opId().get(doel.id).projectie[0];
  const klopt = M.maakKlopt();
  const nep = B.beoordeel((x, e) => (x === citaat ? false : klopt(x, e)));
  const na = nep.maten.find(m => m.id === doel.id);
  assert.equal(na.status, 'half', 'zonder projectie bestaat de maat niet meer');
  assert.ok(na.gaten.includes('PROJECTIE_ONTBREEKT'));
  assert.ok(nep.verworpen.some(v => v.maat === doel.id && v.element === 'projectie'), 'en het citaat staat op de lijst verworpen');
  const runway = echt.maten.find(m => m.id === 'runway.rtg');
  assert.equal(runway.elementen.bron.afgeleid, true);
  assert.equal(runway.elementen.bron.aanwezig, false, 'runway erft het ontbrekende banksaldo');
  assert.equal(runway.status, 'ontbreekt');
});

test('4. wat alleen in commentaar staat, is geen bron, projectie of bewijs', () => {
  const klopt = M.maakKlopt();
  const kop = { bestand: 'server/kern/fiscaal/btwaangifte.js', citaat: 'De BTW-AANGIFTE van een zaak' };
  assert.equal(klopt(kop, 'definitie'), true, 'als definitie mag proza');
  assert.equal(klopt(kop, 'projectie'), false, 'als projectie niet: een kop rekent niets uit');
  assert.equal(klopt({ bestand: '../buiten.js', citaat: 'x' }, 'bron'), false, 'buiten de repository wordt niet gelezen');
});

test('5. de catalogus klopt tegen de code, en het register loopt niet achter', () => {
  const vers = M.meet();
  assert.deepEqual(vers.verworpen, [], 'een citaat in de catalogus staat niet in zijn bestand');
  assert.equal(vers.telling.maten, B.MATEN.length);
  const pad = path.join(__dirname, '..', 'BEDRIJFSMAAT.json');
  const vast = JSON.parse(fs.readFileSync(pad, 'utf8'));
  assert.ok(vast.stempel && vast.stempel.commit, 'het register draagt een stempel');
  assert.equal(M.dragend(vast), M.dragend(vers),
    'BEDRIJFSMAAT.json loopt achter op de catalogus of de code -- draai: npm run bedrijfsmaat:vast');
});

test('6. de besluiten C1 en C2 reizen mee, met hun herkomst', () => {
  const vast = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'BEDRIJFSMAAT.json'), 'utf8'));
  const ids = vast.besluiten.map(b => b.id);
  assert.deepEqual(ids, ['C1', 'C2']);
  for (const b of vast.besluiten) {
    assert.equal(b.herkomst, 'mens');
    assert.match(b.besloten, /25 september 2026/);
  }
  const { LEZEN, KLEIN, VOORSTEL } = require('../server/kern/stuur/beleid-lijsten');
  assert.ok(LEZEN.office && KLEIN.office.length === 0 && VOORSTEL.office.length === 0, 'C2 staat in het stuur zoals het besluit zegt');
});

test('7. een telling per categorie: samenvoegen waar de naam iets verraadt, secundair onderdrukken waar niet', () => {
  const benoemd = P.groepeer([{ naam: 'RTG Pass', aantal: 40 }, { naam: 'Lifestyle', aantal: 3 }, { naam: 'Business', aantal: 12 }], { benoemd: true });
  assert.equal(benoemd.find(r => r.naam === 'Lifestyle').aantal, null, 'de kleine pas houdt zijn naam en verliest zijn aantal');
  assert.equal(benoemd.find(r => r.naam === 'Business').aantal, null,
    'een enkele verborgen groep is terug te rekenen uit het totaal, dus de kleinste zichtbare gaat ook dicht');
  assert.equal(benoemd.find(r => r.naam === 'RTG Pass').aantal, 40);
  const steden = P.groepeer([{ naam: 'Amsterdam', aantal: 40 }, { naam: 'Maastricht', aantal: 3 }, { naam: 'Delft', aantal: 2 }]);
  assert.ok(!steden.some(r => r.naam === 'Maastricht' || r.naam === 'Delft'), 'de naam van een kleine stad verdwijnt');
  const overig = steden.find(r => r.samengevoegd);
  assert.equal(overig.aantal, null, 'en de samengevoegde rest onder de grens draagt ook geen aantal');
  const groot = P.groepeer([{ naam: 'A', aantal: 40 }, { naam: 'B', aantal: 6 }, { naam: 'C', aantal: 7 }]);
  assert.equal(groot.find(r => r.samengevoegd).aantal, 13, 'samen boven de grens: het totaal van de rest mag');
});
