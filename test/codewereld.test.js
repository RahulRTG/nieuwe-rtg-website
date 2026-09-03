/* DE CODEWERELD TELT INDEXEN NIET ALS GEDRAG.

   Twee keer op rij sprong hier een dekkingsgetal omhoog zonder dat er iets bij
   was gekomen: eerst bij SYMBOLEN.json (bronbereik 33% -> 100%) en daarna bij
   AANROEPGRAAF.json (server 41,9% -> 85,5%). Beide keren kwam dat doordat een
   INDEX per definitie bijna elk bestand noemt, en een teller die dat meerekent
   dus zijn eigen volledigheid meet. Beide keren zag het eruit als vooruitgang.

   Dat is precies het soort fout dat niemand terugvindt zodra het een half jaar
   in een document staat -- een percentage dat te hoog is, klaagt nooit. Vandaar
   deze toets: hij bewaakt de scheiding zelf, niet de waarde.

   Wat hij NIET doet is een norm op de hoogte van de dekking zetten. Dat getal
   mag zakken (een boom groeit sneller dan zijn meters); wat niet mag is dat het
   stijgt doordat er een index bij komt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const lees = naam => JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8'));

/* De registers die structuur en relaties leggen. Ze zeggen WAAR iets woont en
   WAT ermee samenhangt -- nooit of het schrijft, klopt of bewezen is. */
const INDEXEN = ['SYMBOLEN.json', 'AANROEPGRAAF.json', 'SCHERMROUTES.json'];

test('1. elk relatieregister verklaart zichzelf als index', () => {
  for (const naam of INDEXEN) {
    assert.strictEqual(lees(naam).soort, 'index',
      naam + ' hoort `soort: "index"` te dragen. Zonder die verklaring telt hij mee als gedragsbron ' +
      'en blaast hij de dekking op met iets wat over gedrag niets zegt.');
  }
});

test('2. de Codewereld sluit die registers uit van de gedragsteller', () => {
  const cw = lees('CODEWERELD.json');
  const uitgesloten = new Set((cw.bronbereik.indexregisters || []).map(x => x.register || x));
  for (const naam of INDEXEN) {
    assert.ok(uitgesloten.has(naam),
      naam + ' staat niet in bronbereik.indexregisters. Draai `npm run codewereld`; blijft hij weg, ' +
      'dan telt een index weer als gedrag en is het percentage niet meer wat het zegt.');
  }
});

test('3. de gedragsteller is kleiner dan de structuurteller', () => {
  const b = lees('CODEWERELD.json').bronbereik;
  assert.ok(b.gedrag < b.bestanden,
    'de gedragsteller staat op ' + b.gedrag + ' van ' + b.bestanden + '. Volledig is hier verdacht: ' +
    'dit huis meet gedrag per route, en een groot deel van de code is geen route. Zit er een index in?');
  assert.ok(b.gedragPct < b.pct, 'gedrag (' + b.gedragPct + '%) hoort onder structuur (' + b.pct + '%) te liggen');
});

test('4. een register dat over bestanden zwijgt, telt die niet als dekking', () => {
  /* De derde variant van dezelfde fout: niet een index die alles noemt, maar een
     METING die een deel van haar onderwerp niet haalt. SCHERMGEDRAG.json kan over
     137 van de 368 schermen niets zeggen (ze bouwen hun paden op). Die staan er
     met een reden in -- dat hoort -- maar als dekking tellen ze niet mee. Zonder
     die aftrek stond public/ op 26,1% in plaats van 21%. */
  const sg = lees('SCHERMGEDRAG.json');
  assert.ok(Array.isArray(sg.zonderUitspraak) && sg.zonderUitspraak.length > 0,
    'SCHERMGEDRAG.json hoort te declareren over welke bestanden het niets zegt (zonderUitspraak)');
  assert.strictEqual(sg.zonderUitspraak.length, sg.gemeten.zonderGrond,
    'de lijst zonderUitspraak en de teller zonderGrond horen hetzelfde te zeggen');
  const cw = lees('CODEWERELD.json');
  const zwijgend = (cw.bronbereik.zwijgendeRegisters || []).find(x => x.register === 'SCHERMGEDRAG.json');
  assert.ok(zwijgend, 'CODEWERELD.json trekt de zwijgende bestanden van SCHERMGEDRAG.json niet af. ' +
    'Draai `npm run codewereld`; blijft het weg, dan telt een meting die zwijgt toch als dekking.');
  assert.strictEqual(zwijgend.bestanden, sg.zonderUitspraak.length);
});

test('5. elk `niet vast te stellen` in het schermgedrag draagt een reden', () => {
  /* Een lege reden naast een lege uitslag laat de lezer raden of de meter faalde
     of dat er niets te meten viel. Dat zijn twee verschillende dingen. */
  const zonder = lees('SCHERMGEDRAG.json').perScherm.filter(x => x.routesGeraakt === 0 && !x.reden);
  assert.deepStrictEqual(zonder.map(x => x.bestand), [],
    'deze schermen hebben geen uitspraak EN geen reden');
});

test('6. een bevinding van de meters staat op nul -- en dat is een ratel', () => {
  /* Beide meters vonden bij hun bouw honderden "fouten" die alle in de meter
     zaten (587 respectievelijk 118). Nu ze op nul staan, hoort er niet
     ongemerkt eentje bij te komen: of het is een echte vondst in de code, of de
     meter is stuk. Beide verdienen een mens. */
  assert.strictEqual(lees('AANROEPGRAAF.json').gemeten.doelOnbekend, 0,
    'een ingevoerde naam wijst naar een bestand dat hem niet kent. Zie AANROEPGRAAF.json -> doelOnbekend.');
  assert.strictEqual(lees('SCHERMROUTES.json').gemeten.doodPad, 0,
    'een scherm noemt een exact API-pad dat geen route is en ook geen stam ervan. Zie SCHERMROUTES.json -> doodPad.');
});
