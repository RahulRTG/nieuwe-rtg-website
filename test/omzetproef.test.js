/* DE GELDKETEN BLIJFT KLOPPEN -- de ratel onder scripts/omzetproef.js.

   De proef zelf draait een wegwerpserver op en duurt tientallen seconden; die
   hoort in een meetronde en niet in `npm test`. Wat hier staat is de TAND: het
   ingecheckte OMZETPROEF.json mag niet stil verslechteren, en de twee
   bevindingen die de proef vond mogen niet stil verdwijnen.

   WAAROM DIE TWEEDE HELFT ER IS. Een bevinding die in het register blijft staan
   zonder dat iemand hem afdwingt, verdampt bij de eerste meting die "toevallig"
   anders uitvalt -- en dan is de conclusie "het is opgelost" terwijl niemand
   iets heeft besloten. Deze toets houdt daarom vast DAT ze er zijn, met hun
   reden. Worden ze echt opgelost, dan zakt deze toets en dat is precies goed:
   dan hoort iemand hier te lezen welk besluit er genomen is en de tand
   omhoog te zetten.

   Draai los: node --test test/omzetproef.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORTEL = path.join(__dirname, '..');
const lees = (n) => JSON.parse(fs.readFileSync(path.join(WORTEL, n), 'utf8'));

test('1. de geldketen loopt door: geen open en geen stukke schakel', () => {
  const u = lees('OMZETPROEF.json');
  assert.equal(u.telling.stuk, 0, 'een schakel is stuk -- draai npm run omzetproef');
  assert.equal(u.telling.open, 0, 'een schakel staat open zonder reden');
  assert.equal(u.telling.gebroken, 0, 'een storing houdt haar belofte niet meer');
  assert.ok(u.telling.schakels >= 7, 'er zijn schakels verdwenen: ' + u.telling.schakels);
  assert.ok(u.telling.gehouden >= 8, 'er zijn storingen verdwenen: ' + u.telling.gehouden);
  assert.equal(u.sluitMetBevinding, true);
});

test('2. het bedrag komt ONGESCHONDEN aan: dit is de kernbewering', () => {
  /* Schakel 4 is de hele reden dat deze keten bestaat. Verkoopt het lid voor
     45 euro, dan hoort de maand van de zaak met exact 45 euro te stijgen. Niet
     44,99 door een afronding, en niet 90 door een dubbeltelling. */
  const u = lees('OMZETPROEF.json');
  const s4 = u.schakels.find(s => s.nr === 4);
  assert.ok(s4, 'schakel 4 bestaat niet meer');
  assert.equal(s4.stand, 'gesloten', 'de omzet stijgt niet meer met exact het verkochte bedrag: ' + s4.ziet);
  assert.equal(u.bruto, 45);
});

test('3. de btw valt uiteen in potten MET een tarief per pot', () => {
  const u = lees('OMZETPROEF.json');
  assert.ok(Array.isArray(u.potten) && u.potten.length >= 2,
    'er is nog maar een btw-pot; dan bewijst de verdeling niets');
  for (const p of u.potten) assert.ok(Number.isFinite(p.tarief), 'een pot zonder tarief: ' + JSON.stringify(p));
  const s6 = u.schakels.find(s => s.nr === 6);
  assert.equal(s6.stand, 'gesloten', 'het tarief hangt niet meer per pot uitgeschreven aan de transactiedag');
});

test('4. de tenant-naad: zaak B ziet geen cent van zaak A', () => {
  /* De duurste fout die deze keten kan verbergen. Hij staat apart van toets 1
     omdat een tellingsregressie hem daar zou kunnen overschaduwen. */
  const u = lees('OMZETPROEF.json');
  const st = u.storingen.find(s => /zaak B vraagt/.test(s.naam));
  assert.ok(st, 'de tenant-storing is uit de proef verdwenen');
  assert.equal(st.stand, 'gehouden', 'zaak B ziet omzet van zaak A: ' + st.wat);
});

/* ==========================================================================
   DE TWEE BEVINDINGEN. Ze zijn GEMETEN en niet beweerd, en ze vragen allebei
   een besluit van de eigenaar -- geen van beide is een defect dat ik hier even
   omzet.
   ========================================================================== */

test('B1. de btw-categorie hangt nog aan de WERKPLEK en niet aan het product', () => {
  /* kern/fiscaal/tarief.js leidt af: station 'bar' -> drank (21%). De
     landentabel zegt er zelf bij dat in NL "eten en NIET-ALCOHOLISCHE dranken
     9%" zijn en alleen alcohol 21%. Een Flat White uit de bar valt dus op 21%.

     De scheidslijn bestaat al in kern/lidacties/bestellen.js ("de werkplek zegt
     waar iets wordt gemaakt, niet wat erin zit") -- alleen niet aan de fiscale
     kant. Besluit van de eigenaar: is de bron van het tarief de werkplek of het
     product? */
  const u = lees('OMZETPROEF.json');
  const s5 = u.schakels.find(s => s.nr === 5);
  assert.equal(s5.stand, 'openBekend',
    'schakel 5 staat niet meer op `openBekend` -- is de bevinding opgelost, of alleen weggepoetst? ' +
    'Is hij opgelost, zet deze toets dan op `gesloten` en noteer in de commit welk besluit er is genomen.');
  assert.match(String(s5.bekend), /werkplek|station/i, 'de bevinding beschrijft zichzelf niet meer');
  assert.ok(u.bevindingen.some(b => b.schakel === 5), 'de bevinding staat niet meer in de lijst');
});

test('B2. een terugstorting is een TEGENBOEKING en wist de verkoop niet', () => {
  /* DIT WAS EEN BEVINDING EN IS NU EEN EIS. De eigenaar heeft besloten: een
     eenmaal geboekte verkoop is historische waarheid, en een terugbetaling is
     een nieuwe economische gebeurtenis die ernaar verwijst. Netto kan het nul
     worden; de geschiedenis blijft heel.

     Daarvoor gold `o.paid = false` en verdween de verkoop uit zijn eigen maand,
     ook als die maand al was aangegeven. Gemeten: 45,00 -> 0,00. */
  const u = lees('OMZETPROEF.json');
  assert.ok(u.refund, 'de refund-meting is uit de proef verdwenen');
  assert.equal(u.refund.vorm, 'tegenboeking',
    'een terugstorting is weer iets anders dan een tegenboeking geworden: ' + u.refund.vorm);
  assert.equal(u.refund.verkoopBlijft, true, 'de verkoop staat niet meer in de boeken na een terugstorting');
  assert.equal(u.refund.eigenDatum, true, 'de terugstorting draagt geen eigen datum; dan is hij niet in zijn EIGEN maand te boeken');
  assert.equal(u.refund.nettoEffect, u.bruto, 'netto daalt de maand niet met het verkochte bedrag');
  assert.ok(!u.bevindingen.some(b => b.schakel === 'storing 2'),
    'de refund staat weer als open bevinding genoteerd terwijl er een besluit over is genomen');

  /* De duurste bijwerking van dat besluit: de grendel op een tweede
     terugstorting hing aan `paid`, en die blijft nu staan. */
  const tweede = u.storingen.find(x => /tweede keer terugstorten/.test(x.naam));
  assert.ok(tweede, 'de storing op een dubbele terugstorting is verdwenen');
  assert.equal(tweede.stand, 'gehouden', 'dezelfde bon kan twee keer geld terugsturen: ' + tweede.wat);
});

test('B3. wat deze proef over de terugstorting NIET bewijst', () => {
  /* Verkoop en terugstorting vallen in deze proef in DEZELFDE maand. Daarmee is
     bewezen dat de verkoop blijft staan en dat er een tegenboeking naast komt --
     maar niet dat die tegenboeking in de JUISTE maand landt wanneer hij in een
     andere valt. Die zaak is het hele punt van het besluit (een afgesloten maand
     mag niet meer bewegen) en hij is hier niet te meten zonder de klok te
     verzetten tegen een draaiende server.

     Deze toets houdt die grens vast in plaats van hem te laten verdampen: de
     grens hoort in het register te staan, en wie hem oplost hoort deze toets
     tegen te komen. */
  const u = lees('OMZETPROEF.json');
  assert.match(u.grens, /maand/,
    'de grens van de proef noemt de maandbeperking niet meer');
});

test('C. de categorie van een verkochte regel beweegt NIET meer', () => {
  /* Dit WAS een derde bevinding en is gerepareerd: de bestelregel draagt sinds
     13 september zijn eigen `station`, zoals hij zijn eigen `price` draagt.
     Daarvoor verhuisde al verkochte drankomzet naar de etenpot zodra de zaak
     het item van de kaart haalde -- gemeten: drankpot 20,00 -> 0,00.

     De tand staat hier en niet bij de bevindingen, want dit is geen besluit
     meer maar een eis. */
  const u = lees('OMZETPROEF.json');
  const st = u.storingen.find(s => /van de kaart halen/.test(s.naam));
  assert.ok(st, 'de storing over de menuwijziging is verdwenen');
  assert.equal(st.stand, 'gehouden',
    'al verkochte omzet verhuist weer van btw-pot bij een menuwijziging: ' + st.wat);
  assert.ok(u.categorieVerschuiving, 'de meting eronder is weg');
  assert.equal(u.categorieVerschuiving.verschoven, false);
  assert.equal(u.categorieVerschuiving.bevinding, null);
});

test('D. de grens van de proef staat er, en hij noemt wat hij NIET bewijst', () => {
  /* Een ketenproef zonder grens leest als een dekkende garantie op de hele
     boekhouding. Deze meet EEN maand, EEN genre, en een PROJECTIE -- geen
     grootboekregel. Dat hoort in het register te staan en niet in iemands
     hoofd. */
  const u = lees('OMZETPROEF.json');
  assert.ok(typeof u.grens === 'string' && u.grens.length > 80, 'de grens ontbreekt of is te dun');
  for (const woord of ['maand', 'projectie', 'genre']) {
    assert.match(u.grens.toLowerCase(), new RegExp(woord),
      'de grens zegt niets over `' + woord + '`, terwijl de proef daarop beperkt is');
  }
});
