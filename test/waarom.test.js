/* ============================================================================
   "ONGEMETEN" MOET ZEGGEN WAT ERAAN ONTBREEKT.

   De staatproef beproeft 3364 routes en bewijst er 252. De andere 3112 dragen
   allemaal hetzelfde woord: ongemeten. Dat is eerlijk en onbruikbaar -- het
   noemt geen voorwaarde, dus er valt geen werk van te maken, alleen een getal
   om je zorgen over te maken.

   scripts/lib/waarom.js deelt ze in naar de ONTBREKENDE VOORWAARDE, in de
   woorden van de route zelf. Deze toets bewaakt de twee dingen die daarbij mis
   kunnen gaan, en beide zijn in de eerste ronde echt misgegaan:

     1. EEN BOODSCHAP DIE IN DE VERKEERDE BAK VALT. "De RTG Bank is nog niet
        live voor leden" (32 routes) kwam binnen als `conflict`, waarop iemand
        een beginstand zou gaan zoeken die niet bestaat. Op de STATUS (403) zou
        hij nog verder mis zijn: `rol-te-laag`, waarop je een andere rol gaat
        proberen die er ook niet in mag. Twee bakken diep fout op een zin die
        volkomen duidelijk is.

     2. EEN INDELING DIE HARDER KLINKT DAN ZE IS. De status is grof: 404 is
        zowel "bestaat niet" als "niet van jou", en dat zijn twee verschillende
        karweien. Daarom draagt elke indeling `door`, en telt de ronde hoeveel
        er op de boodschap en hoeveel er alleen op de statuscode is ingedeeld.

   MUTATIEBEWIJS (LAT.md regel 2 en 10). Drie keer gebroken, en dit is wat er
   WERKELIJK omviel:

     "nog niet live" uit dienst-uit halen        -> 1 gezakt (2)
     de boodschap NA de status laten komen       -> 4 gezakt (2, 3, 4, 5)
     `door` altijd op 'boodschap'                -> 2 gezakt (4, 5)

   Dat de tweede mutatie er vier omgooit is geen ruis: de volgorde IS het
   instrument. Zet de status vooraan en er blijft een indeling over die je met
   acht statuscodes ook had gekregen.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const w = require('../scripts/lib/waarom.js');

test('1. elke soort zegt WAT het is en WAT ERVOOR NODIG IS', () => {
  /* Zonder `nodig` is dit een etiket en geen opdracht. Precies het verschil
     tussen "3112 ongemeten" en een lijst werkzaamheden. */
  assert.ok(w.SOORTEN.length >= 7);
  for (const s of w.SOORTEN) {
    assert.ok(s.id && s.wat && s.nodig, s.id + ' is geen bruikbare soort');
    assert.ok(s.nodig.length > 30, s.id + ' zegt niet echt wat eraan te doen is: "' + s.nodig + '"');
  }
});

test('2. een dienst die nog niet live is, is geen toestandsconflict', () => {
  /* Het geval van de RTG Bank, 32 routes. Op status alleen zou het rol-te-laag
     heten; op de oude zinnenlijst conflict. Beide sturen je verkeerd. */
  const u = w.deel(403, 'De RTG Bank is nog niet live voor leden.');
  assert.strictEqual(u.soort, 'dienst-uit',
    'een dienst die uit staat vraagt om aanzetten, niet om een andere beginstand of een andere rol');
  assert.strictEqual(u.door, 'boodschap');
});

test('3. de boodschap wint van de status, want de status is grof', () => {
  /* Dezelfde 404, twee verschillende karweien. Zolang de status wint zijn ze
     niet uit elkaar te houden en telt dit huis 1136 keer hetzelfde werk. */
  assert.strictEqual(w.deel(404, 'Zaak niet gevonden.').soort, 'object-ontbreekt');
  assert.strictEqual(w.deel(404, 'Deze pas staat niet op uw naam.').soort, 'niet-van-jou');
  assert.notStrictEqual(w.deel(404, 'Zaak niet gevonden.').soort,
    w.deel(404, 'Deze pas staat niet op uw naam.').soort);
});

test('4. zonder bruikbare boodschap valt hij terug op de status, en zegt dat', () => {
  const u = w.deel(404, '');
  assert.strictEqual(u.soort, 'object-ontbreekt');
  assert.strictEqual(u.door, 'status');
  const v = w.deel(400, 'Kies een geldig datumvenster.');
  assert.strictEqual(v.soort, 'veld-ontbreekt');
  assert.strictEqual(v.door, 'status', 'deze zin staat in geen enkel patroon; dat hoort zichtbaar te zijn');
  assert.match(v.omdat, /valt in geen bekende vorm/);
});

test('5. elke indeling zegt WIE hem bepaalde', () => {
  /* Zonder dit veld klinkt "1136 willen een bestaand object" even stellig of het
     nu uit hun mond kwam of uit een statuscode. */
  const gevallen = [[200, ''], [404, 'Zaak niet gevonden.'], [404, ''], [418, 'iets vreemds']];
  const door = gevallen.map(([s, b]) => w.deel(s, b).door);
  assert.deepStrictEqual(door, ['status', 'boodschap', 'status', 'niets']);
});

test('6. onbekend blijft onbekend, en dat is de bak die leeg hoort te blijven', () => {
  /* LAT.md regel 3: waar we het niet weten, verzinnen we geen soort. */
  const u = w.deel(418, '');
  assert.strictEqual(u.soort, 'onbekend');
  assert.match(u.omdat, /418/);
});

test('7. de telling toont ALLE soorten, ook die op nul staan', () => {
  /* Een telling die alleen toont wat voorkomt, verbergt wat is opgelost -- en
     dan lijkt een soort die naar nul is gewerkt op een soort die nooit bestond. */
  const t = w.telling([{ route: 'POST /a', soort: 'bereikt', omdat: 'status 200' }]);
  assert.strictEqual(t.length, w.SOORTEN.length);
  assert.strictEqual(t.find(s => s.id === 'bereikt').aantal, 1);
  assert.strictEqual(t.find(s => s.id === 'conflict').aantal, 0);
  for (const s of t) assert.ok('aantal' in s && 'nodig' in s);
});

test('8. de boodschap komt uit het antwoord en wordt niet verzonnen', () => {
  assert.strictEqual(w.boodschapVan({ error: 'Zaak niet gevonden.' }, '{}'), 'Zaak niet gevonden.');
  assert.strictEqual(w.boodschapVan({ melding: 'iets' }, '{}'), 'iets');
  assert.strictEqual(w.boodschapVan(null, 'kale tekst'), 'kale tekst');
  assert.strictEqual(w.boodschapVan({}, ''), '');
});
