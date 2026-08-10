/* RTG Reizen: de samenhanglaag over de reisdomeinen (PLATFORM.md, laag 2).

   Wat hier bewezen moet worden is niet "er komt een lijst uit" maar de twee
   dingen die een orkestratielaag kapot kunnen maken:

   1. Hij bezit niets. Elke regel komt uit het domein zelf, via de functie die
      dat domein al had. Zou deze laag een eigen collectie krijgen, dan is
      "waar staat mijn boeking echt" binnen een maand niet meer te beantwoorden.
   2. Hij liegt niet als een bron stilvalt. Een reiswereld die na een storing
      drie in plaats van vier reizen toont, LIJKT compleet -- en dat is precies
      hoe iemand een vlucht mist. Een onvolledig reisschema moet zichzelf
      onvolledig noemen.

   Deze toets draait op nagebootste domeinen en niet op een echte server: het
   gaat om het samenvoegen, en een echte vlucht boeken om daarna te kijken of
   hij in een lijst staat, bewijst iets anders (dat de luchthaven werkt) en veel
   trager. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakReiswereld } = require('../server/kern/reiswereld');

const morgen = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };

function wereldMet(over) {
  const kern = Object.assign({
    mijnVerblijven: () => [],
    reisbureau: { mijn: () => [] },
    lucht: { mijn: () => ({ boekingen: [], charters: [] }) }
  }, over || {});
  return maakReiswereld({ kern }).reiswereld;
}

test('de drie domeinen komen samen in een tijdlijn, op datum', () => {
  const w = wereldMet({
    mijnVerblijven: () => [{ id: 'v1', roomName: 'Suite', aankomst: morgen(20), vertrek: morgen(24), status: 'bevestigd' }],
    reisbureau: { mijn: () => [{ ref: 'R1', titel: 'Toscane', bestemming: 'Florence', vertrek: morgen(10), status: 'aangevraagd' }] },
    lucht: { mijn: () => ({ boekingen: [{ code: 'B1', status: 'geboekt', vlucht: { nummer: 'RT101', bestemming: 'Nice', datum: morgen(3) } }], charters: [] }) }
  });
  const r = w.komend('k');
  assert.deepEqual(r.komend.map(x => x.soort), ['vlucht', 'reis', 'verblijf'],
    'de tijdlijn hoort op datum te lopen en niet op bron');
  assert.deepEqual(r.stil, [], 'zonder storing is er niets stil');
  // elke regel wijst naar de app die het echte werk doet
  assert.deepEqual(r.komend.map(x => x.link),
    ['/apps/vluchten.html', '/apps/reisbureau.html', '/apps/hotels.html']);
});

test('een charter telt mee, en wijst naar de Hangar', () => {
  const w = wereldMet({
    lucht: { mijn: () => ({ boekingen: [], charters: [{ code: 'C1', soort: 'jet', bestemming: 'Ibiza', datum: morgen(5), status: 'bevestigd' }] }) }
  });
  const r = w.komend('k');
  assert.equal(r.komend.length, 1);
  assert.equal(r.komend[0].app, 'Hangar');
  assert.equal(r.komend[0].link, '/apps/hangar.html');
});

test('wat voorbij is of geannuleerd, staat er niet bij', () => {
  const w = wereldMet({
    mijnVerblijven: () => [
      { id: 'oud', roomName: 'Vorig jaar', aankomst: morgen(-40), vertrek: morgen(-35), status: 'bevestigd' },
      { id: 'af', roomName: 'Afgezegd', aankomst: morgen(9), vertrek: morgen(11), status: 'geannuleerd' },
      { id: 'nu', roomName: 'Loopt nu', aankomst: morgen(-1), vertrek: morgen(2), status: 'bevestigd' }
    ]
  });
  const r = w.komend('k');
  assert.deepEqual(r.komend.map(x => x.titel), ['Loopt nu'],
    'een verblijf dat vandaag loopt telt mee; voorbij en geannuleerd niet');
});

/* DE BELANGRIJKSTE TOETS VAN DIT BESTAND.

   DE MUTATIE DIE HEM HOORT TE LATEN ZAKKEN: vervang in kern/reiswereld.js de
   functie bron() door een variant die de fout opeet zonder de naam in `stil` te
   zetten (dus alleen `catch (e) {}`). De lijst is dan nog steeds netjes
   gesorteerd, de app toont nog steeds reizen, en niets klaagt -- terwijl de
   vlucht van morgen ontbreekt. Dat is de stille storing waar deze laag het
   meest gevoelig voor is, want hij hangt per definitie aan drie andere
   domeinen. */
test('een bron die stilvalt neemt de andere niet mee, en verzwijgt zichzelf niet', () => {
  const w = wereldMet({
    mijnVerblijven: () => [{ id: 'v1', roomName: 'Suite', aankomst: morgen(20), vertrek: morgen(24), status: 'bevestigd' }],
    reisbureau: { mijn: () => { throw new Error('reisbureau ligt plat'); } },
    lucht: { mijn: () => ({ boekingen: [{ code: 'B1', status: 'geboekt', vlucht: { nummer: 'RT101', bestemming: 'Nice', datum: morgen(3) } }], charters: [] }) }
  });
  const r = w.komend('k');
  assert.deepEqual(r.komend.map(x => x.soort), ['vlucht', 'verblijf'],
    'de twee gezonde bronnen horen er gewoon te staan');
  assert.deepEqual(r.stil, ['reisbureau'],
    'de stille bron hoort met naam gemeld te worden, niet stil te verdwijnen');
});

test('alle drie stil: dan is het een storing en geen lege agenda', () => {
  const stuk = () => { throw new Error('plat'); };
  const w = wereldMet({
    mijnVerblijven: stuk, reisbureau: { mijn: stuk }, lucht: { mijn: stuk }
  });
  const r = w.komend('k');
  assert.deepEqual(r.komend, []);
  assert.deepEqual(r.stil, ['verblijven', 'reisbureau', 'vluchten'],
    'drie stille bronnen horen alle drie genoemd te worden');
});

/* De laag bezit niets: hij leest de kern LAAT en heeft geen eigen opslag. Deze
   toets bewijst het door de domeinen te veranderen NADAT de wereld is
   samengesteld. Zou de module bij het opzetten de gegevens overnemen (of een
   eigen collectie bijhouden), dan bleef het oude antwoord staan. */
test('de wereld leest bij elke vraag opnieuw, en bewaart niets van zichzelf', () => {
  let reizen = [];
  const kern = {
    mijnVerblijven: () => [],
    reisbureau: { mijn: () => reizen },
    lucht: { mijn: () => ({ boekingen: [], charters: [] }) }
  };
  const w = maakReiswereld({ kern }).reiswereld;
  assert.deepEqual(w.komend('k').komend, [], 'eerst is er niets');

  reizen = [{ ref: 'R9', titel: 'Later geboekt', bestemming: 'Lissabon', vertrek: morgen(6), status: 'aangevraagd' }];
  assert.deepEqual(w.komend('k').komend.map(x => x.titel), ['Later geboekt'],
    'een reis die na het opzetten in het domein verschijnt, hoort hier meteen te staan');

  // en er is geen enkele schrijfweg: de laag biedt alleen komend()
  assert.deepEqual(Object.keys(maakReiswereld({ kern }).reiswereld), ['komend'],
    'de samenhanglaag hoort alleen te kunnen lezen; boeken en annuleren blijft in de specialist');
});
