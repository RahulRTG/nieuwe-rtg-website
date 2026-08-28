/* ============================================================================
   EEN MISLUKTE RONDE MAG ZICH NIET VOORDOEN ALS EEN GEMETEN RONDE.

   HET GEVAL, EN HET IS ECHT GEBEURD (18 augustus 2026). De omgeving had
   chromium 1194 staan, playwright vroeg om bouw 1234, en alle 122
   browsertoetsen vielen om op een installatiebanner van playwright. Het
   schermjournaal van die ronde bevatte 294 TOETS-regels, 296 AUDIT-regels en
   nul SCHERM-regels.

   Dat bestand is niet te onderscheiden van het journaal van een GESLAAGDE ronde
   waarin toevallig geen enkel scherm werd geopend. Het platformregister zou er
   "262 schermen nooit geopend" van hebben gemaakt: een hard oordeel over 262
   apps, op grond van een kapotte meetopstelling.

   Dat is LAT.md regel 3 in zijn gemeenste vorm. Niet een meter zonder invoer
   die zwijgt -- die valt op -- maar een meter zonder invoer die een NETJES
   OPGEMAAKT SLECHT CIJFER geeft. Daar gaat iemand aan werken.

   MUTATIEBEWIJS (LAT.md regel 2 en 10). Drie keer gebroken, drie keer gezakt:

     `af` altijd op true                       -> 3 gezakt (1, 2, 4)
        Het verslag zegt dan van elke ronde dat hij af is; de kapotte ronde
        wordt een gewone ronde met een slechte uitslag. Dat toets 4 meevalt is
        de nuttigste van de drie: die controleert of de meter zijn eigen
        voorwaarde nog kan uitspreken, en dat is precies wat hier wegviel.

     metScherm uit de voorwaarde voor `af`     -> 1 gezakt (1)
        Nul geopende schermen telt dan als een geldige uitslag. Precies het
        geval dat deze toets bestaat om te vangen.

     de wissel in schermRecords terug naar `const w = waarneming`
                                               -> 1 gezakt (5)
        De meter kent het verschil dan wel, en het register gebruikt het niet.
        Het gat verhuist een laag naar boven en blijft even groot.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const schermen = require('../scripts/schermen.js');
const { schermRecords } = require('../server/kern/platformregister/samenstellen.js');

/* Een journaal schrijven zoals de server het zou schrijven. De toetsnamen
   moeten ECHT bestaan: het verslag vergelijkt met de browsertoetsen op schijf,
   en een verzonnen naam zou niets bewijzen. */
const ECHTE = schermen.browsertoetsen();

function journaal(regels) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schermronde-'));
  const pad = path.join(map, '.schermjournaal');
  fs.writeFileSync(pad, regels.join('\n') + '\n');
  return pad;
}

test('1. een ronde waarin geen enkele browser startte is GEEN ronde met nul schermen', () => {
  /* Dit is letterlijk de vorm van het journaal van 18 augustus: de servers
     draaiden, de toetsen deden hun aanroepen, en er is nooit een pagina
     geopend omdat de browser niet startte. */
  const pad = journaal(ECHTE.slice(0, 26).flatMap(t => [
    'TOETS GET /api/health ' + t,
    'TOETS POST /api/auth/register ' + t
  ]));
  const v = schermen.rondeVerslag(pad);
  assert.strictEqual(v.af, false, 'deze ronde heeft niets over schermen gemeten');
  assert.strictEqual(v.metScherm, 0);
  assert.match(v.reden, /browser startte hier niet/);
});

test('2. een halve ronde is ook geen ronde', () => {
  const pad = journaal([
    'TOETS GET /api/health ' + ECHTE[0],
    'SCHERM /apps/app.html ' + ECHTE[0] + ' navigatie'
  ]);
  const v = schermen.rondeVerslag(pad);
  assert.strictEqual(v.af, false);
  assert.strictEqual(v.metScherm, 1, 'er is wel degelijk iets geopend');
  assert.match(v.reden, /niet afgemaakt/);
  assert.strictEqual(v.nietGedraaid.length, ECHTE.length - 1);
});

test('3. een volle ronde heet af, en dan pas', () => {
  const pad = journaal(ECHTE.map(t => 'SCHERM /apps/app.html ' + t + ' navigatie'));
  const v = schermen.rondeVerslag(pad);
  assert.strictEqual(v.af, true, v.reden || '');
  assert.strictEqual(v.reden, null);
  assert.strictEqual(v.gedraaid, ECHTE.length);
});

test('4. de inventaris van browsertoetsen komt van de schijf en is niet leeg', () => {
  /* Zonder deze toets kan browsertoetsen() stilletjes leeglopen (een gewijzigde
     naam, een verplaatste map) en dan heet ELKE ronde af -- de meter zou zijn
     eigen voorwaarde wegdefinieren. */
  assert.ok(ECHTE.length > 50, 'verwacht ruim honderd browsertoetsen, kreeg ' + ECHTE.length);
  for (const naam of ECHTE) {
    assert.ok(fs.existsSync(path.join(__dirname, naam)), naam + ' bestaat niet');
  }
  const leeg = schermen.rondeVerslag(journaal(['TOETS GET /api/health ' + ECHTE[0]]));
  assert.strictEqual(leeg.af, false);
});

test('5. het platformregister zet schermen op ONGEMETEN als de ronde niet draaide', () => {
  /* De meter mag het verschil kennen; het gaat erom dat het REGISTER het
     gebruikt. Hier stond de fout een laag hoger te wachten. */
  const lijst = ['/apps/app.html', '/apps/rtg.html'];
  const kapot = schermRecords(lijst, {}, {
    af: false, reden: 'de browser startte hier niet',
    afgelegd: new Map(), neven: new Map(), vegers: new Set()
  });
  for (const r of kapot) {
    assert.strictEqual(r.status.staat, 'ongemeten',
      r.id + ' krijgt een oordeel uit een ronde die niet gedraaid heeft');
    assert.match(r.status.reden, /browser startte hier niet/,
      'de reden hoort mee: "ongemeten" zonder waarom leidt tot een tweede onderzoek');
  }

  /* En de keerzijde: draaide de ronde wel, dan is "nooit geopend" een echt
     oordeel en hoort het er gewoon te staan. */
  const echt = schermRecords(lijst, {}, {
    af: true, reden: null,
    afgelegd: new Map([['/apps/app.html', new Set(['deur.e2e.js'])]]),
    neven: new Map(), vegers: new Set()
  });
  assert.strictEqual(echt.find(r => r.id === '/apps/app.html').status.staat, 'beproefd');
  assert.strictEqual(echt.find(r => r.id === '/apps/rtg.html').status.staat, 'nooit geopend');
});
