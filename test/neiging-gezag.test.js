/* EEN NEIGING IS GEEN BEVOEGDHEID -- en dat staat hier als toets, niet als zin.

   kern/neiging/ bewaart wat iemand leuk vindt of naartoe neigt (NEIGING.md),
   met een grond: `gezegd`, `gekozen` of `afgeleid`. Dat mag bepalen wat RTG
   iemand LAAT ZIEN. Het mag nooit bepalen wat iemand MAG: dat iemand zegt
   ondernemer te zijn, mag het Ondernemers-OS naar voren halen, maar opent geen
   administratie; dat RTG raadt dat iemand docent is, opent geen
   leerlinggegevens.

   Vandaag houdt de bedrading dat al: geen enkel gezagsbestand noemt de laag.
   Maar een bedrading die niemand bewaakt, is een toevalligheid -- morgen
   schrijft iemand `kern.neiging.lees(key, 'tonen')` in een poort, omdat het
   handig is. Deze toets maakt van die nul een grens. Gemeten op 11 oktober
   2026: 178 gezagsbestanden, 0 treffers.

   TWEE HELFTEN, en ze vangen verschillende fouten:

   1. DE BRON. Geen bestand op een gezagspad noemt `neiging` in zijn CODE.
      Commentaar telt niet (kern/stuur/lusstap.js spreekt van "de neiging om
      toch maar iets te doen" -- gewoon Nederlands), en daarom gaat de tekst
      eerst door scripts/lib/bron.js en niet door een eigen regex.
   2. DE KERN-TAS. GRENZEN.json zegt per routedomein welke kernnamen het mag
      lezen. Alleen het domein `neiging` zelf mag `neiging` lezen. Een tweede
      domein erbij is een BESLUIT -- dan zakt deze toets, en hoort de reden in
      de toets te komen te staan in plaats van dat de lijst stil groeit.

   WAT DEZE TOETS NIET ZEGT: dat er nergens op neigingen gestuurd mag worden.
   Een persoonlijke volgorde in kern/experience/projections.js mag er wel op
   leunen (NEIGING.md, "een stap weg") -- dat is tonen, en geen gezag.

   Draai los: node --test test/neiging-gezag.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('../scripts/lib/bron');

const WORTEL = path.join(__dirname, '..');

/* De plekken waar dit huis beslist of iets MAG: de poorten, het beleid van het
   stuur, de bevoegdheden, de identiteit, het kantoor, de machtigingen, de
   leeftijds- en paspoortgrenzen. Een map telt met alles erin. */
const GEZAG = [
  'server/middleware', 'server/webauthn',
  'server/kern/stuur', 'server/kern/stuur.js',
  'server/kern/beleidsmotor', 'server/kern/bevoegdheid', 'server/kern/identiteit',
  'server/kern/kantoor', 'server/kern/vertegenwoordiging',
  'server/kern/volwassen.js', 'server/kern/onvervreemdbaar.js', 'server/kern/ontmoetpoort.js',
  'server/kern/persoonseis.js', 'server/kern/persoonseis-lijst.js',
  'server/kern/commercie/lidpoort.js', 'server/kern/commercie/rechten.js',
  'server/kern/spellen/grens.js'
];

function bestanden(rel, uit = []) {
  const p = path.join(WORTEL, rel);
  /* Een pad dat verdwijnt laat de toets zakken in plaats van stil te krimpen:
     een gezagspad dat hier niet meer wordt gelezen, wordt nergens meer bewaakt. */
  assert.ok(fs.existsSync(p), rel + ' bestaat niet meer; zet het nieuwe gezagspad in GEZAG');
  if (fs.statSync(p).isDirectory()) {
    for (const naam of fs.readdirSync(p)) bestanden(path.join(rel, naam), uit);
  } else if (rel.endsWith('.js')) uit.push(rel);
  return uit;
}

const NOEMT = /neiging/i;

test('1. geen gezagsbestand noemt de neiginglaag in zijn code', () => {
  const alle = GEZAG.flatMap((g) => bestanden(g));
  /* Een lege meting is geen geslaagde meting. */
  assert.ok(alle.length > 100, 'de gezagspaden leveren maar ' + alle.length + ' bestanden; leest de toets nog wat hij denkt?');
  const treffers = alle.filter((rel) => NOEMT.test(zonderCommentaar(fs.readFileSync(path.join(WORTEL, rel), 'utf8'))));
  assert.deepEqual(treffers, [],
    'een gezagspad leest de neiginglaag. Een neiging bepaalt wat iemand ZIET en nooit wat hij MAG (NEIGING.md, ' +
    'ADAPT-05). Wie hier een voorkeur laat meebeslissen, maakt van een aangeklikt vinkje een bevoegdheid.');
});

test('2. alleen het domein neiging mag de kernnaam neiging lezen', () => {
  const g = JSON.parse(fs.readFileSync(path.join(WORTEL, 'GRENZEN.json'), 'utf8')).domeinen;
  const lezers = Object.entries(g).filter(([, namen]) => namen.some((n) => NOEMT.test(n))).map(([d]) => d);
  assert.deepEqual(lezers, ['neiging'],
    'een tweede routedomein mag nu neigingen lezen. Dat is een besluit (NEIGING.md par. 4, "vraagt een besluit"); ' +
    'schrijf hier welk domein en waarom, en of het tonen is of gezag.');
});

test('3. de toets ziet een overtreding -- een meter die niet kan uitslaan is geen meter', () => {
  /* De ijking: dezelfde regel op een nagemaakte overtreding, en op een
     commentaar dat het woord noemt. De eerste moet raak zijn, de tweede niet. */
  const overtreding = "const { neiging } = kern;\nif (neiging.lees(key, 'tonen').length) return volgende();";
  const alleenCommentaar = '/* de neiging om toch maar iets te doen */\nconst x = 1;';
  assert.ok(NOEMT.test(zonderCommentaar(overtreding)));
  assert.ok(!NOEMT.test(zonderCommentaar(alleenCommentaar)));
});
