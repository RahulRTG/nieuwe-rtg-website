/* DE MUTATIESEMANTIEK -- en of de poort werkelijk dichtgaat.

   kern/mutatie.js draait om een omkering die makkelijk weer terug te draaien is:
   het doel is niet dat alles idempotent IS, maar dat van alles wat publiek
   aanroepbaar is, is UITGESPROKEN wat een tweede aanroep doet. `onbekend` is aan
   die rand een weigering en geen waarde.

   Die omkering sneuvelt op drie manieren, en dit zijn de drie toetsen:

     1. de poort laat een opdracht zonder klasse door ("we vullen het later in");
     2. de poort accepteert `onbekend` als antwoord;
     3. de poort staat er wel, maar hangt nergens -- dan is hij een module die
        niemand aanroept. Daarom toetst 5 en 6 de ECHTE brug.

   Draai los: node --test test/mutatie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../server/kern/mutatie');
const { maakBrug } = require('../server/kern/appstore/brug');

/* Eén staat die blijft staan tussen de aanroepen door. Een S() die elke keer een
   VERSE opslag teruggeeft, laat elke herhaalbaarheidsproef slagen -- er is dan
   immers nooit iets om over te schrijven. Dat is precies de fout die deze toets
   moet kunnen vinden, dus hij mag hem niet zelf maken. */
const bouwBrug = () => {
  const staat = { opslag: {}, bakjes: {} };
  return maakBrug({
    S: () => staat, save() {}, boek() {},
    nu: () => new Date().toISOString(), eigen: (o, k) => o[k]
  });
};

test('1 - een opdracht zonder klasse laat de poort niet door', () => {
  assert.throws(() => M.poort({ 'iets.doen': { doe: () => ({}) } }, 'de proef'),
    /noemt geen mutatieklasse/);
  // en de melding zegt WAAR, want met drie lagen is "een opdracht" geen bericht
  assert.throws(() => M.poort({ 'iets.doen': {} }, 'de proef'), /de proef/);
});

test('2 - onbekend is aan de rand een weigering en geen waarde', () => {
  assert.throws(() => M.poort({ 'iets.doen': { mutatie: 'onbekend' } }, 'de proef'),
    /weigering en geen waarde/);
  // een verzonnen klasse ook, en de melding noemt de echte
  assert.throws(() => M.poort({ 'iets.doen': { mutatie: 'misschien' } }, 'de proef'),
    /bestaat niet/);
});

test('3 - een volledig geclassificeerde verzameling komt er wel door', () => {
  assert.equal(M.poort({
    'a.lees': { mutatie: 'idempotent' },
    'b.bestel': { mutatie: 'sleutelVereist' },
    'c.meld': { mutatie: 'nietHerhaalbaar' }
  }, 'de proef'), true);
});

test('4 - herhalen wordt op EEN plek beantwoord', () => {
  assert.equal(M.magHerhalen('idempotent'), true);
  assert.equal(M.magHerhalen('nietHerhaalbaar'), false);
  assert.equal(M.magHerhalen('hooguitEens'), false);
  assert.equal(M.magHerhalen('compenseerbaar'), false);
  assert.equal(M.magHerhalen('onbekend'), false, 'onbekend is nooit een vrijbrief');
  // sleutelVereist hangt aan de sleutel, en dat is het hele punt van die klasse
  assert.equal(M.magHerhalen('sleutelVereist', false), false);
  assert.equal(M.magHerhalen('sleutelVereist', true), true);
  assert.equal(M.magHerhalen('verzonnen'), false);
});

test('5 - de ECHTE brug is volledig geclassificeerd', () => {
  const brug = bouwBrug();
  /* HIER STOND `=== 6`, EN DAT GETAL WAS HET ENIGE DAT ZAKTE toen de arenalaag
     drie methodes meebracht (arena.bord, arena.mijn, arena.zet). Niets was
     stuk: alle negen dragen een klasse, en dat is ook precies wat deze toets
     hoort te bewijzen -- want een methode ZONDER klasse laat bouwBrug()
     hierboven al knallen, en dat is toets 6 een paar regels verderop.

     Een vast aantal meet de grootte van het huis en niet de eigenschap. Het is
     bovendien de dure soort: hij zakt bij elke uitbreiding, en wie hem drie
     keer heeft opgehoogd leest de volgende keer niet meer of er echt iets mis
     was. Wat er nu staat is de eigenschap zelf plus een ondergrens, en die
     ondergrens is er om te merken dat de LEZING stukging (een verplaatste
     module, een gewijzigde vorm) en niet om het aantal vast te zetten. */
  assert.ok(brug.METHODES.length >= 6,
    'de brug hoort methodes te kennen; gevonden: ' + brug.METHODES.length);
  /* brug.mutaties is een LIJST en geen kaart -- elk element draagt zijn eigen
     naam. Eerst als kaart gelezen, en dan is elke waarde `undefined` en meldt
     deze lus alle negen methodes als onbekend. Dat is de valse uitslag die de
     drukste kant op wijst: negen fouten waar er nul zijn. */
  const perNaam = new Map(brug.mutaties.map(x => [x.naam, x.mutatie]));
  for (const m of brug.METHODES) {
    assert.ok(M.isKlasse(perNaam.get(m)),
      m + ' draagt geen bekende mutatieklasse (gevonden: ' + perNaam.get(m) + ')');
  }
  assert.ok(brug.METHODES.includes('bericht.zet'));
});

test('6 - een nieuwe brugmethode zonder klasse laat de brug niet opbouwen', () => {
  /* Dit is de toets die de poort vasthoudt aan de plek waar hij hangt. Zonder
     hem kan iemand de aanroep in brug.js weghalen en blijft alles groen. */
  const bron = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'server', 'kern', 'appstore', 'brug.js'), 'utf8');
  assert.match(bron, /require\('\.\.\/mutatie'\)\.poort\(METHODES/,
    'brug.js hoort de mutatiepoort over zijn eigen METHODES te halen');
  // en de poort hangt VOOR het teruggeven, niet in een tak die zelden loopt
  const poortOp = bron.indexOf(".poort(METHODES");
  const returnOp = bron.lastIndexOf('return { roep,');
  assert.ok(poortOp > 0 && poortOp < returnOp, 'de poort hoort bij het opbouwen te draaien');
});

test('7 - bericht.zet is niet herhaalbaar, en dat is geen slordigheid', () => {
  /* De interessantste classificatie van de zes: twee keer hetzelfde bericht
     klaarzetten levert TWEE berichten op, en er is een dagmaximum van vijf. Een
     taakloper die dit bij twijfel opnieuw doet, verbrandt het budget van een lid
     aan een dubbel bericht. */
  const brug = bouwBrug();
  const ctx = { key: 'lid1', sleutel: 'app1', codenaam: 'Havik', taal: 'nl', pas: 'rtg',
    verleend: ['bericht.klaarzetten'], vraagt: ['bericht.klaarzetten'] };
  const een = brug.roep(Object.assign({}, ctx, { methode: 'bericht.zet', args: { tekst: 'hallo daar' } }));
  const twee = brug.roep(Object.assign({}, ctx, { methode: 'bericht.zet', args: { tekst: 'hallo daar' } }));
  assert.equal(een.status, 200);
  assert.equal(twee.status, 200);
  const bakje = brug.bakje('lid1', 'app1');
  assert.equal(bakje.length, 2, 'twee keer dezelfde aanroep laat twee berichten achter');

  /* En dan de eigenlijke bewering: het ETIKET op deze methode moet bij dat
     gedrag passen. Toetsen dat magHerhalen('nietHerhaalbaar') false geeft, is de
     tabel toetsen -- dan mag iemand bericht.zet op `idempotent` zetten en blijft
     alles groen. Dit leest de klasse die de brug zelf declareert. */
  const declared = brug.mutaties.find(m => m.naam === 'bericht.zet');
  assert.ok(declared, 'de brug hoort zijn eigen classificatie prijs te geven');
  assert.equal(M.magHerhalen(declared.mutatie), false,
    'bericht.zet staat als ' + declared.mutatie + ' te boek, maar twee aanroepen laten twee berichten achter');
});

test('8 - opslag.zet is WEL idempotent, en dat is te zien', () => {
  const brug = bouwBrug();
  const ctx = { key: 'lid1', sleutel: 'app1', codenaam: 'Havik', taal: 'nl', pas: 'rtg',
    verleend: ['opslag.eigen'], vraagt: ['opslag.eigen'] };
  brug.roep(Object.assign({}, ctx, { methode: 'opslag.zet', args: { sleutel: 'stand', waarde: '7' } }));
  brug.roep(Object.assign({}, ctx, { methode: 'opslag.zet', args: { sleutel: 'stand', waarde: '7' } }));
  const lijst = brug.roep(Object.assign({}, ctx, { methode: 'opslag.lijst' }));
  assert.deepEqual(lijst.uit.sleutels, ['stand'], 'twee keer zetten laat een sleutel achter');
});

test('9 - het overzicht is wat de SDK en een taakloper lezen', () => {
  const r = M.overzicht({ 'b.zet': { mutatie: 'nietHerhaalbaar' }, 'a.lees': { mutatie: 'idempotent' } });
  assert.deepEqual(r.map(x => x.naam), ['a.lees', 'b.zet'], 'op naam gesorteerd, zodat een diff leesbaar is');
  assert.equal(r[0].herhaalbaar, true);
  assert.equal(r[1].herhaalbaar, false);
  assert.ok(r[1].uitleg.length > 20, 'met de uitleg erbij, niet alleen de naam');
  // een opdracht zonder klasse valt in het overzicht terug op onbekend en niet op stilte
  const z = M.overzicht({ 'c.iets': {} });
  assert.equal(z[0].mutatie, 'onbekend');
  assert.equal(z[0].herhaalbaar, false);
});
