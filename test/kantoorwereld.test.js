/* RTG Kantoor, de samenhanglaag. Wat hier getoetst wordt is niet of de lijst
   klopt -- dat weten de vier domeinen zelf -- maar of deze laag zich aan zijn
   eigen belofte houdt: hij bezit niets, hij verzint niets, en hij doet nooit
   alsof hij compleet is terwijl een bron zweeg.

   Dezelfde toetsen als test/reiswereld.test.js, en met opzet dezelfde vorm:
   twee samenhanglagen die anders redeneren zijn twee producten. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakKantoorwereld } = require('../server/kern/kantoorwereld');

const VANDAAG = new Date().toISOString().slice(0, 10);
const dagen = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

// een kern met vier meegevende domeinen; per toets naar wens uitgekleed
function kernMet(over) {
  const k = {
    agenda: { lijst: () => [] },
    notities: { notitiesLijst: () => ({ eigen: [], gedeeld: [] }) },
    bestanden: { bestandenLijst: () => ({ gedeeld: [] }) },
    officeMijn: () => ({ docs: [], gedeeld: [] })
  };
  Object.assign(k, over || {});
  return k;
}
const wereld = (over) => maakKantoorwereld({ kern: kernMet(over) }).kantoorwereld;

test('bezit niets: er is geen enkele manier om iets te schrijven', () => {
  /* De belofte uit PLATFORM.md is dat een super app orkestreert en niet
     vervangt. Die belofte is te toetsen: als deze module ooit een tweede
     administratie wordt, komt daar een schrijffunctie bij.

     DE MUTATIE DIE HEM HOORT TE LATEN ZAKKEN: voeg `bewaar` toe aan het
     teruggegeven object. Dat lijkt onschuldig en is precies het begin van de
     vijfde administratie naast vier die het al bijhouden. */
  const w = wereld();
  assert.deepEqual(Object.keys(w), ['werkdag'],
    'de kantoorwereld hoort ALLEEN te kunnen lezen; elke extra functie is een ' +
    'administratie die hier niet hoort te ontstaan');
});

test('een afspraak van vandaag krijgt aandacht, een van later niet', () => {
  const w = wereld({ agenda: { lijst: () => [
    { id: 'a1', titel: 'Bestuur', datum: VANDAAG, tijd: '10:00', gedaan: false },
    { id: 'a2', titel: 'Later', datum: dagen(5), gedaan: false }
  ] } });
  const r = w.werkdag('k');
  const vandaag = r.regels.find(x => x.kenmerk === 'a1');
  const later = r.regels.find(x => x.kenmerk === 'a2');
  assert.equal(vandaag.sig, 'aandacht');
  assert.equal(vandaag.teken, '!', 'kleur alleen is niet genoeg (ONTWERP.md par. 5)');
  assert.equal(later.sig, 'actief');
});

test('een afgeronde afspraak en een afspraak uit het verleden staan er niet in', () => {
  const w = wereld({ agenda: { lijst: () => [
    { id: 'a1', titel: 'Klaar', datum: VANDAAG, gedaan: true },
    { id: 'a2', titel: 'Gisteren', datum: dagen(-3), gedaan: false }
  ] } });
  assert.equal(w.werkdag('k').regels.length, 0);
});

test('een notitie zonder open punten en zonder herinnering is geen taak', () => {
  /* Anders wordt dit beeld ongemerkt een tweede notitie-app: alles wat iemand
     ooit opschreef zou hier komen te staan. */
  const w = wereld({ notities: { notitiesLijst: () => ({
    eigen: [
      { id: 'n1', titel: 'Aantekening', items: [], vanMij: true },
      { id: 'n2', titel: 'Boodschappen', items: [{ t: 'brood', af: false }], vanMij: true }
    ], gedeeld: [] }) } });
  const r = w.werkdag('k');
  assert.equal(r.regels.length, 1);
  assert.equal(r.regels[0].kenmerk, 'n2');
});

test('een taak met een verlopen herinnering is een incident', () => {
  const w = wereld({ notities: { notitiesLijst: () => ({
    eigen: [{ id: 'n1', titel: 'Aangifte', items: [{ t: 'x', af: false }],
      herinnerOp: dagen(-2), vanMij: true }], gedeeld: [] }) } });
  const r = w.werkdag('k');
  assert.equal(r.regels[0].sig, 'incident');
  assert.equal(r.telling.aandacht, 1);
});

test('een gedeelde taak zegt op wie gewacht wordt', () => {
  const w = wereld({ notities: { notitiesLijst: () => ({
    eigen: [], gedeeld: [{ id: 'n9', titel: 'Van Sam', items: [{ t: 'x', af: false }],
      vanMij: false, door: 'Sam' }] }) } });
  const r = w.werkdag('k');
  assert.equal(r.regels[0].wacht, 'de ander');
  assert.equal(r.regels[0].door, 'Sam');
  assert.equal(r.telling.wachtend, 1);
});

/* DE BELANGRIJKSTE TOETS VAN DEZE LAAG.

   DE MUTATIE DIE HEM HOORT TE LATEN ZAKKEN: vang de fout in bron() op en doe
   er niets mee (stil.push weghalen). Het scherm toont dan drie van de vier
   domeinen en ziet er volkomen normaal uit -- en iemand mist zijn vergadering
   omdat de agenda toevallig stuk was. */
test('een bron die stukgaat wordt gemeld en neemt de andere niet mee', () => {
  const w = wereld({
    agenda: { lijst: () => { throw new Error('agenda stuk'); } },
    notities: { notitiesLijst: () => ({
      eigen: [{ id: 'n1', titel: 'Taak', items: [{ t: 'x', af: false }], vanMij: true }], gedeeld: [] }) }
  });
  const r = w.werkdag('k');
  assert.deepEqual(r.stil, ['agenda'], 'een stille bron hoort met naam gemeld te worden');
  assert.equal(r.regels.length, 1, 'de andere bronnen horen gewoon door te lopen');
});

test('elke toestand die deze laag kan maken, kent hij ook', () => {
  /* Hier ligt een verschil met kern/reiswereld.js dat de moeite van het
     opschrijven waard is. Daar KOMT de status uit het domein, dus daar kan een
     onbekende toestand echt binnenkomen en telt de laag hem apart. Hier zet
     deze module de status ZELF, dus onbekend hoort onmogelijk te zijn.

     De teller `onbekend` blijft staan als vangnet voor precies dat: schrijft
     iemand later een nieuw woord in regel() zonder het in BETEKENIS te zetten,
     dan valt dat hier om. Een eerdere versie van deze toets deed alsof hij een
     onbekende toestand kon opwekken en bewees dus niets.

     DE MUTATIE DIE HEM HOORT TE LATEN ZAKKEN: geef een afspraak van later de
     status 'binnenkort' in plaats van 'open' zonder BETEKENIS uit te breiden. */
  const w = wereld({
    agenda: { lijst: () => [
      { id: 'a1', titel: 'Nu', datum: VANDAAG, gedaan: false },
      { id: 'a2', titel: 'Straks', datum: dagen(4), gedaan: false }] },
    notities: { notitiesLijst: () => ({ eigen: [
      { id: 'n1', titel: 'Open', items: [{ t: 'x', af: false }], vanMij: true },
      { id: 'n2', titel: 'Te laat', items: [{ t: 'x', af: false }], herinnerOp: dagen(-1), vanMij: true }
    ], gedeeld: [{ id: 'n3', titel: 'Van Sam', items: [{ t: 'x', af: false }], vanMij: false }] }) },
    officeMijn: () => ({ docs: [{ id: 'd1', titel: 'Nota', gewijzigd: VANDAAG }],
      gedeeld: [{ id: 'd2', titel: 'Samen', gewijzigd: VANDAAG, door: 'Sam' }] }),
    bestanden: { bestandenLijst: () => ({ gedeeld: [{ id: 'b1', naam: 'plan.pdf', gewijzigd: VANDAAG }] }) }
  });
  const r = w.werkdag('k');
  assert.equal(r.regels.length, 8, 'alle acht regels uit vier bronnen horen mee te komen');
  const zonder = r.regels.filter(x => !x.sig).map(x => x.status);
  assert.deepEqual(zonder, [], 'deze statussen staan niet in BETEKENIS: ' + zonder.join(', '));
  assert.equal(r.telling.onbekend, 0);
});

test('wat aandacht vraagt staat boven wat rustig is', () => {
  const w = wereld({
    agenda: { lijst: () => [{ id: 'a1', titel: 'Vandaag', datum: VANDAAG, gedaan: false }] },
    notities: { notitiesLijst: () => ({ eigen: [
      { id: 'n1', titel: 'Verlopen', items: [{ t: 'x', af: false }], herinnerOp: dagen(-1), vanMij: true }
    ], gedeeld: [] }) },
    officeMijn: () => ({ docs: [{ id: 'd1', titel: 'Nota', gewijzigd: VANDAAG }], gedeeld: [] })
  });
  const s = w.werkdag('k').regels.map(r => r.sig);
  assert.deepEqual(s, ['incident', 'aandacht', 'gezond'],
    'de rangorde hoort op dringendheid te staan en niet op datum');
});

test('elke regel wijst naar de specialist waar het werk gebeurt', () => {
  const w = wereld({
    agenda: { lijst: () => [{ id: 'a1', titel: 'X', datum: VANDAAG, gedaan: false }] },
    officeMijn: () => ({ docs: [{ id: 'd1', titel: 'Nota', gewijzigd: VANDAAG }], gedeeld: [] }),
    bestanden: { bestandenLijst: () => ({ gedeeld: [{ id: 'b1', naam: 'plan.pdf', gewijzigd: VANDAAG }] }) }
  });
  for (const r of w.werkdag('k').regels) {
    assert.match(r.link, /^\/apps\/[a-z]+\.html$/, 'elke regel hoort een weg naar zijn app te hebben');
    assert.ok(r.app, 'en te zeggen welke app dat is');
  }
});

test('de bronnen worden bij naam genoemd, zodat het scherm niet hoeft te raden', () => {
  assert.deepEqual(wereld().werkdag('k').bronnen,
    ['agenda', 'taken', 'documenten', 'bestanden']);
});
