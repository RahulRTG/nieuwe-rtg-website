/* HET SNELLE ANTWOORD MOET HETZELFDE ANTWOORD ZIJN.

   scripts/keuring.js meet welke endpoints in een toets voorkomen. Dat deed hij
   met zeven `testTekst.includes(...)` per route, over de samengeplakte inhoud
   van alle toetsbestanden -- tientallen megabytes, ruim vierduizend routes,
   bijna dertigduizend volledige scans. Met --cpu-prof gemeten zat 64% van de
   hele keuring in die ene functie: 21 van de 33 seconden. En de keuring is geen
   eenmalig ding -- scripts/norm.js roept hem aan, en test/meterijk.test.js
   roept norm aan voor ELKE meter; die toets liep daardoor tegen de twaalf
   minuten aan en viel in de reeks om op zijn tijdslot.

   Sinds die omkering bouwt maakDekkingsIndex() de hooiberg EEN keer om tot een
   register. Dat is sneller, en snelheid is precies waar een meter stilletjes
   van kan gaan liegen: een register dat net iets anders antwoordt dan de lus
   verschuift dekkingPct en endpointsZonderTest, en dat zijn RATELTANDEN in
   NORM.json. Een cijfer dat "beter" wordt omdat de meter anders telt, is geen
   vooruitgang maar een leugen met een groen randje.

   Daarom staat de TRAGE VORM hier als tegenspeler, letterlijk overgeschreven
   uit de versie van voor de omkering, en moeten de twee het op elk pad eens
   zijn. Niet op een handvol voorbeelden, maar op de echte routekaart tegen de
   echte toetsen -- plus een reeks gevallen die met opzet lastig is.

   Draai los: node --experimental-sqlite --test test/keuringsindex.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { maakDekkingsIndex, DEKKING_KAP } = require('../scripts/lib/dekkingsindex');

const WORTEL = path.join(__dirname, '..');

/* DE TRAGE VORM, precies zoals hij was. Dit is met opzet een KOPIE en geen
   aanroep van iets gedeelds: een tegenspeler die dezelfde code draait als de
   speler bewijst niets (LAT-regel 9). Wijzigt de index, dan moet hij het hier
   nog steeds mee eens zijn -- en verandert er iets aan de BEDOELING, dan hoort
   iemand deze kopie bewust aan te passen en niet per ongeluk mee te slepen. */
function traagGedekt(testTekst, route) {
  if (testTekst.includes(route)) return true;
  const staart = route.slice(5);
  for (const vorm of [staart, '/' + staart]) {
    if (testTekst.includes("'" + vorm + "'") ||
        testTekst.includes('"' + vorm + '"') ||
        testTekst.includes('`' + vorm + '`')) return true;
  }
  return false;
}

test('1. op elk verzonnen geval geeft de index hetzelfde antwoord als de lus', () => {
  const tekst = [
    "const api = (p) => fetch(base + '/api/' + p);",
    "await api('bank/overzicht', {});",
    "l.call('/member/boardroom/zetveel');",
    'const pad = "/api/school/factuur/maak";',
    'fetch(base + `/api/supplier/horeca/betaal`);',
    "// een route in commentaar: /api/dit/telt/toch/mee",
    "const raar = 'bank/overzicht/verder';",
    "iets('  /api/spaties/erin  ')"
  ].join('\n');

  const snel = maakDekkingsIndex(tekst);
  const paden = [
    '/api/bank/overzicht',            // via de afgeknipte vorm tussen quotes
    '/api/bank/overzicht/verder',     // en de langere variant daarvan
    '/api/member/boardroom/zetveel',  // met leidende slash, zonder /api
    '/api/school/factuur/maak',       // voluit tussen dubbele quotes
    '/api/supplier/horeca/betaal',    // voluit in een sjabloon
    '/api/dit/telt/toch/mee',         // in commentaar -- telt mee, en dat is bekend
    '/api/spaties/erin',              // met witruimte eromheen
    '/api/bestaat/echt/niet',         // hoort ongedekt te zijn
    '/api/bank',                      // voorvoegsel van een ander pad
    '/api/bank/overzich'              // net niet
  ];
  for (const p of paden) {
    assert.equal(snel(p), traagGedekt(tekst, p),
      'index en lus zijn het oneens over ' + p + ' (index: ' + snel(p) + ')');
  }
});

test('2. DE TEGENPROEF: de index zegt niet overal hetzelfde', () => {
  /* Zonder deze bewering zou een index die altijd `false` teruggeeft toets 1
     halen zodra de trage vorm dat toevallig ook doet. Er moet dus aantoonbaar
     licht tussen de antwoorden zitten. */
  const tekst = "await api('bank/overzicht', {});";
  const snel = maakDekkingsIndex(tekst);
  assert.equal(snel('/api/bank/overzicht'), true, 'wat er staat is gedekt');
  assert.equal(snel('/api/bank/bestaatniet'), false, 'wat er niet staat is dat niet');
});

test('3. EN OP DE ECHTE ROUTEKAART TEGEN DE ECHTE TOETSEN, route voor route', () => {
  /* Dit is de bewering die telt. Verzonnen gevallen dekken af wat ik heb
     bedacht; de echte 4000+ routes tegen de echte toetstekst dekken af wat ik
     niet heb bedacht. */
  const uit = execFileSync(process.execPath,
    [path.join(WORTEL, 'scripts/routekaart.js'), '--json'],
    { cwd: WORTEL, encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
  const routes = (JSON.parse(uit).routes || [])
    .map(r => (typeof r === 'string' ? r : r.pad || r.path)).filter(Boolean)
    .filter(r => r.startsWith('/api/'));
  assert.ok(routes.length > 1000, 'de routekaart hoort duizenden routes te geven, kreeg ' + routes.length);

  const testMap = path.join(WORTEL, 'test');
  const testTekst = fs.readdirSync(testMap).filter(n => n.endsWith('.js'))
    .map(n => fs.readFileSync(path.join(testMap, n), 'utf8')).join('\n');
  assert.ok(testTekst.length > 1000000, 'de toetstekst hoort megabytes te zijn, kreeg ' + testTekst.length);

  const snel = maakDekkingsIndex(testTekst);
  const oneens = [];
  for (const r of routes) {
    const a = snel(r), b = traagGedekt(testTekst, r);
    if (a !== b) oneens.push(r + ' (index ' + a + ', lus ' + b + ')');
    if (oneens.length >= 10) break;
  }
  assert.deepEqual(oneens, [], 'de index en de lus zijn het oneens over echte routes');

  /* En het antwoord is niet overal hetzelfde -- anders zou "ze zijn het eens"
     ook waar zijn als beide altijd false gaven. */
  const gedektAantal = routes.filter(snel).length;
  assert.ok(gedektAantal > 0 && gedektAantal < routes.length,
    'er hoort een echte verdeling te zijn (' + gedektAantal + ' van ' + routes.length + ')');
});

test('4. de kap is een grens en geen stilte', () => {
  /* Een stuk tekst langer dan de kap valt buiten het register. Dat is bewust --
     een route is nooit zo lang -- maar het mag geen VERSCHIL geven met de lus
     op iets wat wel een route kan zijn. Dus: tot aan de kap moeten ze het eens
     zijn. */
  const lang = 'a'.repeat(DEKKING_KAP - 20);
  const tekst = "api('" + lang + "');\nfetch('/api/" + lang + "');";
  const snel = maakDekkingsIndex(tekst);
  const route = '/api/' + lang;
  assert.equal(snel(route), traagGedekt(tekst, route), 'net onder de kap horen ze gelijk te zijn');
  assert.equal(snel(route), true);
});
