/* DE CRASHPROEF -- wat hier bewaakt wordt, en waarom juist dit.

   scripts/crashproef.js doet een dure meting: hij laat per geldroute het proces
   sterven op een crashgrens en kijkt wat er van de uitkomst overblijft. De
   meting zelf staat hier NIET -- die vraagt negentig serverstarts en hoort in
   een register, niet in een toets die bij elke commit draait.

   Wat hier wel staat is de VERTAALSLAG van meting naar oordeel, en dat is de
   plek waar deze proef stuk kan gaan zonder dat iemand het merkt:

     1. `ongemeten` dat als `niet idempotent` wordt gelezen. Die fout is hier
        gemaakt: de eerste versie stuurde alles wat niet `beschermd` heet naar
        PROVEN_PARTIAL met de reden "deze route hoort bij een tweede oproep werk
        te doen". Dat is `onbekend` lezen als `nee`, en het zou /api/pay/saldo
        -- een route waarvan factuurproef.js de idempotentie HEEFT bewezen --
        eeuwig op half bewijs hebben gehouden.
     2. een grens die wordt beproefd zonder injectiepunt. Dan draait de proef
        wel maar meet hij niets, en dat leest als dekking.
     3. `in-de-opslag` die stilletjes terugkomt in de lijst. crashgrenzen.js
        heeft gemeten dat die grens op een transactionele opslag geen eigen
        moment heeft; hem toch draaien meet sterf-na-commit nog een keer.

   Draai los: node --test test/crashproef.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const cp = require('../scripts/crashproef.js');
const verraad = require('../server/lib/verraad.js');
const tax = require('../scripts/lib/crashtaxonomie.js');

test('elke grens die deze proef draait, heeft een injectiepunt dat ECHT is ingebouwd', () => {
  for (const g of cp.GRENZEN) {
    const v = verraad.CATALOGUS.find(x => x.naam === g.modus);
    assert.ok(v, g.modus + ' staat niet in de verraadscatalogus');
    assert.ok(v.waar, g.modus + ' is ontworpen maar niet ingebouwd -- een proef die hem toch ' +
      'draait, meet niets en levert een dekkingscijfer op dat er niet is');
  }
});

test('de grenzen komen uit de gesloten taxonomie en zijn niet verzonnen', () => {
  const bekend = Object.keys(tax.GRENZEN);
  for (const g of cp.GRENZEN) assert.ok(bekend.includes(g.grens), g.grens + ' kent de taxonomie niet');
});

/* `in-de-opslag` is een GEMETEN afwezigheid en geen vergeten regel. Zonder deze
   toets kan hij terugglijden in de lijst en dan meet de proef sterf-na-commit
   twee keer onder twee namen -- precies wat crashgrenzen.js is gaan uitsluiten. */
test('`in-de-opslag` wordt NIET gedraaid: hij heeft op deze opslag geen eigen moment', () => {
  assert.ok(!cp.GRENZEN.some(g => g.grens === 'in-de-opslag'),
    'die grens hoort hier niet bij: de opslag commit heel of rolt heel terug, ' +
    'dus een injectie ertussen is een tweede sterf-na-commit met een andere naam');
  const v = verraad.CATALOGUS.find(x => x.naam === 'sterf-in-de-opslag');
  assert.equal(v && v.waar, null, 'en de catalogus hoort hem als niet-ingebouwd te tonen');
});

test('elke grens draagt een uitgeschreven belofte -- anders is de uitslag niet te lezen', () => {
  for (const g of cp.GRENZEN) assert.ok(g.belofte && g.belofte.length > 30,
    g.grens + ' zegt niet welke belofte hier op het spel staat');
});

/* DE KERN VAN DIT BESTAND: de drie uitkomsten van de na-commit-grens.

   De regel wordt AANGEROEPEN en niet overgeschreven. Een toets die de logica
   naast de bron nog eens opschrijft, blijft groen als de bron verandert -- dat
   is precies hoe achttien groene toetsen eerder een kapotte functie hebben
   gedekt: de fixture hield zich aan de vorm die de code aannam in plaats van
   aan de echte. Vandaar dat scripts/crashproef.js `weegHerhaling` exporteert. */
const oordeel = (bijgekomen, idempotentie) => cp.weegHerhaling(bijgekomen, idempotentie).stand;

test('de weegregel wordt uit de bron gehaald en niet hier overgeschreven', () => {
  assert.equal(typeof cp.weegHerhaling, 'function',
    'zonder deze export zou dit bestand een kopie van de regel toetsen in plaats van de regel');
  for (const inv of [[0, 'beschermd'], [3, 'beschermd'], [3, 'ongemeten']]) {
    const w = cp.weegHerhaling(inv[0], inv[1]);
    assert.ok(w.reden && w.reden.length > 30, 'elke uitkomst draagt een uitgeschreven reden');
  }
});

test('een herhaling die NIETS toevoegt is bewezen, wat het register ook nog niet wist', () => {
  assert.equal(oordeel(0, 'beschermd'), 'PROVEN');
  assert.equal(oordeel(0, 'ongemeten'), 'PROVEN',
    'de meting is er al: legt de herhaling niets bovenop, dan is de belofte gehouden. ' +
    'Dat IDEMPROEF.json deze route niet kent, maakt de meting niet minder waard');
});

test('een herhaling die WEL werk deed, weegt verschillend -- en `ongemeten` is nooit `nee`', () => {
  assert.equal(oordeel(3, 'beschermd'), 'FAILED',
    'een route die zich beschermd noemt en toch dubbelt, breekt zijn eigen belofte');
  assert.equal(oordeel(3, 'ongemeten'), 'PROVEN_PARTIAL',
    'bij een ongemeten route kan deze proef niet zeggen of dat een defect is of de bedoeling');
  assert.notEqual(oordeel(3, 'ongemeten'), 'FAILED',
    'ONGEMETEN LEZEN ALS NIET-IDEMPOTENT is precies de fout die hier is gemaakt');
});

/* EEN STAND DIE NOOIT EERLIJK KAN WORDEN TOEGEKEND, HOORT NIET TE BESTAAN.

   De eerste volledige ronde gaf 16 keer `BLINDE_INJECTIE`: de modus stond
   scherp, de route gaf 200 en het proces leefde door. Dat las als zestien
   defecten en het waren er nul -- acht routes (pas/bevries en broers) schrijven
   met de gewone write-behind save(), na te lezen in server/kern/bank/passen.js,
   en raken `bijeen()` noch `saveDuurzaam()`.

   Het woord is daarom weg, en niet hernoemd-en-bewaard. Van BUITEN is een echte
   blinde injectie namelijk niet te onderscheiden van een route die het
   injectiepunt niet raakt: allebei geven ze 200. Een stand die je nooit eerlijk
   kunt toekennen, is dekking die er niet is.

   Wat ervoor in de plaats kwam zegt alleen wat er gemeten IS, en het is geen
   geruststelling: deze route loopt niet langs de bundel, dus wat hem bedreigt
   is een VERLOREN schrijfactie -- een andere modus, die deze proef niet draait. */
test('`BLINDE_INJECTIE` bestaat niet meer als uitslag, en dat is een besluit', () => {
  const bron = require('fs').readFileSync(require('path').join(__dirname, '..',
    'scripts', 'crashproef.js'), 'utf8');
  const toegekend = /stand: 'BLINDE_INJECTIE'|\? 'BLINDE_INJECTIE'/.test(bron);
  assert.ok(!toegekend, 'geen enkele tak mag deze stand nog toekennen: van buiten is hij niet ' +
    'te onderscheiden van een route die het injectiepunt simpelweg niet raakt');
  assert.match(bron, /GEEN_DUURZAME_WEG/, 'de stand die hem vervangt hoort er wel te zijn');
});

test('GEEN_DUURZAME_WEG wijst naar de modus die hem WEL zou raken', () => {
  const bron = require('fs').readFileSync(require('path').join(__dirname, '..',
    'scripts', 'crashproef.js'), 'utf8');
  assert.match(bron, /schrijf-verloren/,
    'een route zonder duurzame weg is niet veilig maar anders bedreigd, en de uitslag ' +
    'hoort te zeggen welke modus dat wel meet -- anders leest hij als een vrijspraak');
});

/* DE ZELFIJKING. Een toets die je niet hebt zien zakken is geen toets: de regel
   hierboven MOET op verschillende invoer verschillend uitvallen. Geeft hij
   overal hetzelfde, dan rekent dit bestand niets na. */
test('zelfijking: de drie uitkomsten zijn werkelijk drie', () => {
  const alle = new Set([oordeel(0, 'beschermd'), oordeel(3, 'beschermd'), oordeel(3, 'ongemeten')]);
  assert.equal(alle.size, 3, 'de regel valt niet uiteen in drie uitkomsten en weegt dus niets');
});
