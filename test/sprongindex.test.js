/* DE TWEE AFGELEIDE LIJSTEN LOPEN NIET ACHTER.

   shared/sprongindex.json (waar de sprong heen kan) en shared/handelingindex.json
   (wat je in een app kunt doen) worden allebei GEGENEREERD -- uit MAPPEN en uit
   de knoppen van de schermen zelf. Een afgeleide lijst die niemand hergenereert,
   is binnen een maand een tweede waarheid; precies wat LAT.md regel 4 verbiedt
   en wat het huis met het tweede bank-kopje al een keer is overkomen.

   Deze toets draait de generatoren in controlestand: zij zakken als de lijst op
   schijf niet meer is wat de bron zegt. Draait zonder browser. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('path');

const WORTEL = path.join(__dirname, '..');

function controle(script, vlag) {
  try {
    execFileSync(process.execPath, [path.join(WORTEL, 'scripts', script), vlag || '--controle'],
      { cwd: WORTEL, stdio: 'pipe' });
    return null;
  } catch (e) {
    return String(e.stderr || e.stdout || e.message).trim();
  }
}

test('de sprongindex is gelijk aan MAPPEN', () => {
  assert.equal(controle('sprongindex.js'), null);
});

test('de handelingindex is gelijk aan de knoppen van de schermen', () => {
  assert.equal(controle('handelingindex.js'), null);
});

/* De vierde afgeleide: het rooster dat in de vier wereldhuizen STAAT. Dat is
   geen script in de browser maar tekst in de pagina (zie scripts/wereldrooster.js),
   want test/beginscherm.test.js leest die pagina en een ingang die pas na een
   fetch bestaat, is voor hem geen ingang -- en daar heeft hij gelijk in.

   DE VOLGORDE WAARIN ZE GEDRAAID WORDEN IS NIET VRIJ: sprongindex leest MAPPEN,
   wereldrooster schrijft daaruit de huizen bij, en handelingindex leest daarna
   die huizen. Andersom draaien geeft een index die een ronde achterloopt. */
test('de vier wereldhuizen dragen het rooster van hun eigen wereld', () => {
  assert.equal(controle('wereldrooster.js'), null);
});

/* TIKKEN.json is ook een meetbestand, en dus hoort er een ratel op (NORM.json
   telt meetbestanden zonder ratel). De volle meting duurt een half uur in een
   echte browser en kan hier niet draaien; de NALOOP leest de laatste meting en
   toetst de belofte die er zonder browser aan te toetsen valt: elk scherm buiten
   bereik draagt een reden, elke reden is nog nodig, en niets ligt dieper dan
   vijf tikken. */
test('TIKKEN.json houdt zich aan zijn eigen belofte', () => {
  assert.equal(controle('tikken.js', '--naloop'), null);
});

/* De vindbaarheidsmeter (VINDBAAR.json) hoort niet onder zijn vloer te zakken. Hij meet WOORDEN
   en geen mensen (VINDBAAR.json zegt dat er zelf bij), maar een terugval van
   68% naar 20% betekent dat er een index is stukgegaan, en dat hoort een toets
   te merken in plaats van een lezer. */
test('je vindt een functie nog steeds met de woorden die erop staan', () => {
  assert.equal(controle('vindbaar.js'), null);
});
