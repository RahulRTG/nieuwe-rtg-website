/* De levenslaag van de levensgraaf: talenten, interesses en bijdrage
   (LEVEN.md par. 1.2), en vooral de twee dingen die daar het werk zijn.

   Waarom dit GEEN servertoets is. De bewering die hier telt gaat niet over een
   route maar over twee velden op een knoop: `gevoelig` en `deel`. Die zijn
   rechtstreeks te voeren en rechtstreeks na te rekenen, en een toets die de
   halve server opstart om er daarna een JSON-veld uit te vissen, kan om tien
   andere redenen zakken -- en dan weet je nog niets (regel 9 van de lat).

   Wat hier bewezen wordt, en welke mutatie het laat zakken:

     de poort         een talent, een interesse en een bijdrage bereiken de
                      Rechterhand NIET en het concierge-bureau NIET.
                      Mutatie: zet `deel: 'rechterhand'` in bronnen-leven.js.
     par. 2.1         een project van een ANDER (waar het lid alleen aan
                      meedoet) levert geen knoop.
                      Mutatie: `p.door !== key` -> `!p.leden.includes(key)`.
     par. 2.4         nergens een som: de hele kamer bijdrage heeft waarde nul.
                      Mutatie: zet `waarde: m.uren` op de bijdrageknoop.
     par. 2.2         een talent of interesse draagt geen vervaldatum en komt
                      dus nooit in de Control Tower als iets wat moet.
                      Mutatie: geef de talentknoop een `vervalt`.
     geen cijfer      de hoogste score van een overhoorlijst komt de graaf niet
                      in. Mutatie: neem `beste` mee in de naam.

   Draai los: node --test test/levensgraafleven.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakGraaf = require('../server/kern/levensgraaf/graaf');
const bronnenLeven = require('../server/kern/levensgraaf/bronnen-leven');

const KEY = 'user-4242';
const ANDER = 'user-9999';
const dag = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/* Een database met precies genoeg erin, en met opzet ook de gevallen die er
   NIET uit horen te komen: het project van een ander en de machtiging die de
   andere kant op staat. Zonder die twee zou de toets alleen bewijzen dat er
   iets uitkomt, en niet dat het juiste eruit blijft. */
function db() {
  return { data: {
    leren: {
      projecten: {
        p1: { id: 'p1', titel: 'Spreekbeurt over dolfijnen', door: KEY, leden: [KEY, 'rtf:ABC123:7a'] },
        p2: { id: 'p2', titel: 'Werkstuk van een ander kind', door: 'rtf:ABC123:7a', leden: ['rtf:ABC123:7a', KEY] }
      },
      lijsten: {
        l1: { id: 'l1', van: KEY, naam: 'Franse woordjes', beste: { goed: 3, totaal: 10 },
          paren: [{ v: 'de hond', a: 'le chien' }] },
        l2: { id: 'l2', van: ANDER, naam: 'Lijst van iemand anders', paren: [] }
      },
      schrijfsels: { [KEY]: [{ id: 's1', opdracht: 'Schrijf een brief aan je zestienjarige zelf.', tekst: 'geheim' }] }
    },
    cvs: { [KEY]: { skills: ['pianospelen', 'Frans'] } },
    rtgid: { machtigingen: [
      { id: 'm1', vanKey: ANDER, naarKey: KEY, dienst: 'apotheek', gemaakt: '2026-03-04T10:00:00.000Z',
        tot: Date.now() + 30 * 86400000, ingetrokken: false },
      { id: 'm2', vanKey: ANDER, naarKey: KEY, dienst: 'gemeente', gemaakt: '2025-01-02T10:00:00.000Z',
        tot: Date.now() - 30 * 86400000, ingetrokken: false },
      { id: 'm3', vanKey: KEY, naarKey: ANDER, dienst: 'bank', gemaakt: '2026-05-05T10:00:00.000Z',
        tot: Date.now() + 30 * 86400000, ingetrokken: false },
      { id: 'm4', vanKey: ANDER, naarKey: KEY, dienst: 'ziekenhuis', gemaakt: '2026-02-02T10:00:00.000Z',
        tot: Date.now() + 30 * 86400000, ingetrokken: true }
    ] }
  } };
}

// alleen deze drie bronnen, en een leeg lifestyle-dossier: wat hier uitkomt
// komt uit bronnen-leven en nergens anders vandaan.
const motor = () => maakGraaf({ db: db(), vandaag: () => dag(0),
  bronnen: bronnenLeven, dossier: () => ({}) });

test('talenten: het eigen project en de eigen cv-vaardigheden, vertrouwelijk en alleen het lid', () => {
  const g = motor().graaf(KEY);
  const talenten = g.knopen.filter(k => k.kamer === 'talenten');
  assert.deepEqual(talenten.map(k => k.naam).sort(), ['Frans', 'Spreekbeurt over dolfijnen', 'pianospelen']);
  for (const k of talenten) {
    assert.equal(k.gevoelig, 2, k.naam + ' hoort vertrouwelijk te zijn');
    assert.equal(k.deel, 'lid', k.naam + ' mag de kring van het lid niet verlaten');
    assert.equal(k.vervalt, '', k.naam + ' mag geen datum dragen: een talent is geen opdracht');
  }
});

test('par. 2.1: het project van een ander kind komt niet in het dossier van dit lid', () => {
  const g = motor().graaf(KEY);
  const namen = g.knopen.map(k => k.naam);
  assert.ok(namen.includes('Spreekbeurt over dolfijnen'), 'het eigen project hoort er wel te staan');
  assert.ok(!namen.includes('Werkstuk van een ander kind'),
    'meedoen aan het project van een ander maakt het niet tot uw gegeven');
});

test('interesses: de naam van de lijst, en niet de score en niet de inhoud', () => {
  const g = motor().graaf(KEY);
  const inter = g.knopen.filter(k => k.kamer === 'interesses');
  assert.deepEqual(inter.map(k => k.naam), ['Franse woordjes']);
  assert.equal(inter[0].gevoelig, 2);
  assert.equal(inter[0].deel, 'lid');
  // het cijfer (3 van de 10) en het vraag-antwoordpaar staan nergens in de graaf
  const alles = JSON.stringify(g.knopen);
  assert.ok(!alles.includes('le chien'), 'de inhoud van de lijst hoort de graaf niet in');
  assert.ok(!/\b3\b\s*(van|\/)\s*10/.test(alles), 'de score hoort de graaf niet in');
  assert.ok(!alles.includes('zestienjarige'), 'de schrijfopdracht verraadt de leeftijdsband');
});

test('bijdrage: alleen wat u gaf, met een datum, en zonder som', () => {
  const m = motor();
  const g = m.graaf(KEY);
  const bij = g.knopen.filter(k => k.kamer === 'bijdrage');
  // m1 loopt, m2 is afgelopen, m3 staat de andere kant op, m4 is ingetrokken
  assert.equal(bij.length, 2);
  const namen = bij.map(k => k.naam).sort();
  assert.deepEqual(namen, ['mantelzorg · apotheek · sinds 2026-03-04',
    'mantelzorg · gemeente · sinds 2025-01-02']);
  for (const k of bij) {
    assert.equal(k.gevoelig, 1, 'bijdrage is persoonlijk');
    assert.equal(k.deel, 'lid', 'zonder toestemming per onderdeel gaat een bijdrage nergens heen');
    assert.equal(k.waarde, 0, 'een bijdrage draagt geen bedrag: een som is de eerste stap naar een score');
  }
  // de lopende machtiging is een termijn, de afgelopene is een kaal feit
  assert.equal(bij.find(k => k.naam.includes('apotheek')).vervalt, dag(30));
  assert.equal(bij.find(k => k.naam.includes('gemeente')).vervalt, '');

  const sam = m.samenvatting(KEY, g);
  assert.equal(sam.perKamer.bijdrage.waarde, 0, 'de kamer bijdrage mag geen totaal kunnen tonen');
  assert.equal(sam.waarde, 0, 'deze hele laag telt nergens iets op');
});

test('de poort: niets van deze drie bronnen bereikt de Rechterhand of het bureau', () => {
  const m = motor();
  const g = m.graaf(KEY);
  assert.ok(g.knopen.length >= 6, 'er valt hier iets te verbergen, anders bewijst het filter niets');
  for (const kring of ['rechterhand', 'kantoor']) {
    const zicht = m.graafVoor(KEY, kring, g);
    assert.equal(zicht.knopen.length, 0, kring + ' hoort hier niets van te zien');
    assert.equal(zicht.verborgen, g.knopen.length, kring + ': elke knoop hoort geteld te zijn als verborgen');
  }
  assert.equal(m.graafVoor(KEY, 'lid', g).knopen.length, g.knopen.length, 'het lid ziet zijn eigen leven wel');
});

/* Een onzinnige einddatum mag hooguit die ene datum kosten, niet de hele bron.
   Zonder de grendel in dagVan() gooit toISOString() op een Invalid Date, vangt
   ./graaf.js dat op als `__stuk` en verdwijnt de bijdrage van dit lid in zijn
   geheel -- met een melding, maar wel weg. Gezien zakken voor de grendel er
   was: stuk was [ 'bijdrage' ] en er stond nul knopen. */
test('een machtiging met een onmogelijke einddatum dooft de bijdrage niet', () => {
  const raar = maakGraaf({ db: { data: { rtgid: { machtigingen: [
    { id: 'x', vanKey: ANDER, naarKey: KEY, dienst: 'apotheek', gemaakt: '2026-01-01T00:00:00.000Z', tot: 1e20 }
  ] } } }, vandaag: () => dag(0), bronnen: bronnenLeven, dossier: () => ({}) });
  const g = raar.graaf(KEY);
  assert.deepEqual(g.stuk, [], 'de bron hoort overeind te blijven');
  assert.equal(g.knopen.length, 1, 'het feit blijft staan');
  assert.equal(g.knopen[0].vervalt, '', 'alleen de onleesbare datum valt weg');
});

test('geen enkele bron valt om op een lege database', () => {
  const leeg = maakGraaf({ db: { data: {} }, vandaag: () => dag(0),
    bronnen: bronnenLeven, dossier: () => ({}) });
  const g = leeg.graaf(KEY);
  assert.deepEqual(g.stuk, [], 'een lege database is leeg en niet stuk');
  assert.equal(g.knopen.length, 0);
});
