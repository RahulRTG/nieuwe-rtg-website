/* De Keuring keurt het systeem; deze test keurt de Keuring.

   Een oordeelsscript dat vals alarm slaat wordt genegeerd, en een script dat
   niets meer vindt wordt overbodig. Beide zijn erger dan geen script. Hier
   staat dus vast wat de Keuring moet blijven kunnen: haar harde regels echt
   hard maken, haar zachte regels eerlijk houden, en geen dode uitzonderingen
   meeslepen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { maakBoom, binnen } = require('../scripts/lib/ephemere-boom');
const { keur } = require('../scripts/keuring.js');
const uitslag = keur();

test('de Keuring velt een volledig oordeel', () => {
  assert.ok(Array.isArray(uitslag.bevindingen), 'bevindingen is een lijst');
  for (const b of uitslag.bevindingen) {
    assert.ok(['stuk', 'scheef', 'beter'].includes(b.soort), 'onbekend oordeel: ' + b.soort);
    assert.ok(b.groep && b.tekst, 'elke bevinding noemt groep en tekst');
  }
  assert.equal(uitslag.stuk + uitslag.scheef + uitslag.beter, uitslag.bevindingen.length);
});

test('de acht checks draaien allemaal echt (geen stille nul)', () => {
  const c = uitslag.cijfers;
  assert.ok(c.dekking.routes > 500, 'de routekaart levert de echte routetabel: ' + c.dekking.routes);
  assert.ok(c.pariteit.genres > 20, 'de genres worden echt uitgelezen: ' + c.pariteit.genres);
  assert.ok(c.beloftes.gescand > 500, 'er worden echt teksten gescand: ' + c.beloftes.gescand);
  assert.ok(c.privacy.gescand > 20, 'er worden echt routes gescand: ' + c.privacy.gescand);
});

test('het huis staat: geen enkele STUK-bevinding', () => {
  const stuk = uitslag.bevindingen.filter(b => b.soort === 'stuk');
  assert.deepEqual(stuk.map(b => b.tekst + ' [' + b.waar + ']'), [],
    'de Keuring vond een harde fout; los die op voordat deze test weer groen mag zijn');
});

test('dynamisch geladen mappen gelden niet als dode code', () => {
  /* kern/fiscaal/wereld/*.js en kern/reis/*.js worden geladen met
     require('./map/' + naam). Wie dat patroon niet herkent, meldt tientallen
     levende modules als dood -- en dan gelooft niemand de melding meer. */
  const dood = uitslag.bevindingen.filter(b => b.groep === 'dode code').map(b => b.waar);
  for (const p of dood)
    assert.ok(!/kern\/(fiscaal\/wereld|reis)\//.test(p), 'dynamisch geladen module onterecht dood gemeld: ' + p);
});

test('een map die zichzelf uitleest telt ook als dynamisch geladen', () => {
  /* De tweede vorm. server/kern/spellen/register.js leest zijn eigen map met
     fs.readdirSync en laadt wat hij vindt met require(path.join(map, naam)).
     Er staat dan geen padtekst in de bron om op te matchen, en de Keuring
     meldde daardoor vijftien spellen als dode code terwijl ze bij elke start
     geladen worden. Vijftien valse meldingen is niet wat ruis: het is de reden
     dat niemand de zestiende nog gelooft. */
  const dood = uitslag.bevindingen.filter(b => b.groep === 'dode code').map(b => b.waar);
  const spellen = dood.filter(p => /kern\/spellen\//.test(p));
  assert.deepEqual(spellen, [], 'het spelregister laadt deze modules bij elke start');
});

test('en die uitzondering is geen blinddoek: echt losgekoppelde code wordt nog gemeld', () => {
  /* De keerzijde van de regel hierboven. Een uitzondering die te breed wordt,
     verbergt precies waar de check voor is -- en dat merk je niet, want er
     verschijnt gewoon niets. Deze toets legt er een module neer die door
     niemand wordt aangeroepen en eist dat de Keuring hem vindt.

     Buiten een dynamisch geladen map, want binnen zo'n map hoort hij juist
     NIET gevonden te worden; dat staat als beperking in de kop van de check.

     In een APART PROCES, want de Keuring bouwt haar bestandslijst een keer op
     bij het laden: een bestand dat daarna ontstaat ziet ze niet, en dan zou
     deze toets groen staan om de verkeerde reden.

     EN IN EEN WEGWERPKOPIE, niet in deze repository. Hier stond
     path.join(WORTEL, ...) -- een echt bestand in server/kern/, netjes
     opgeruimd in een finally. Toch verkeerd: andere toetsen scannen diezelfde
     map, en die zien dan een dode module verschijnen die er niet hoort. Dat is
     de reden dat dit bestand op de isolatielijst van de testrunner stond, en
     dat die lijst bestond. Een toets muteert nooit gedeelde bronstaat; zie
     scripts/lib/ephemere-boom.js. */
  const boom = maakBoom('keuringproef');
  try {
    const pad = binnen(boom.pad, path.join(boom.pad, 'server', 'kern', 'zz-keuringproef-dood.js'));
    assert.equal(fs.existsSync(pad), false, 'het proefbestand mag er nog niet staan');
    fs.writeFileSync(pad, '/* tijdelijk proefbestand van test/keuring.test.js */\nmodule.exports = () => ({});\n');
    /* De keuring UIT de kopie, niet die van hiernaast: een keuring bepaalt haar
       wortel uit haar eigen __dirname, dus de onze zou de kopie nooit zien. */
    const uit = require('child_process').execFileSync(process.execPath,
      ['--experimental-sqlite', path.join(boom.pad, 'scripts', 'keuring.js'), '--json'],
      { cwd: boom.pad, maxBuffer: 1e9, encoding: 'utf8' });
    const dood = JSON.parse(uit).bevindingen.filter(b => b.groep === 'dode code').map(b => b.waar);
    assert.ok(dood.some(p => p.includes('zz-keuringproef-dood')),
      'een module die niemand aanroept hoort gemeld te worden; gevonden: ' + dood.join(', '));
    /* En de echte boom is niet aangeraakt. Zonder deze regel zou een WORTEL die
       ooit weer hierheen wijst er stil doorheen glijden. */
    assert.equal(fs.existsSync(path.join(WORTEL, 'server', 'kern', 'zz-keuringproef-dood.js')), false,
      'de proef hoort in de wegwerpkopie te staan en niet in deze repository');
  } finally {
    boom.ruimOp();
  }
});

test('bouwsels tellen niet mee, alleen bron', () => {
  for (const b of uitslag.bevindingen) {
    if (!b.waar) continue;
    assert.ok(!b.waar.includes('public/dist/'), 'een bevinding wijst naar geminificeerd bouwsel: ' + b.waar);
  }
});

test('de gewogen uitzonderingen leven nog allemaal', () => {
  /* Een uitzondering die naar een zin wijst die niet meer bestaat, is stille
     rommel: hij dekt niets meer af en verbergt dat iemand hem mag opruimen. */
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'keuring.js'), 'utf8');
  const blok = bron.slice(bron.indexOf('const GEWOGEN'), bron.indexOf('function beloftes'));
  const re = /\['([^']+) \| ([^']+)',/g;
  let m, n = 0;
  while ((m = re.exec(blok))) {
    n++;
    const doel = path.join(WORTEL, m[1]);
    assert.ok(fs.existsSync(doel), 'gewogen uitzondering wijst naar een bestand dat niet bestaat: ' + m[1]);
    assert.ok(fs.readFileSync(doel, 'utf8').includes(m[2]),
      'gewogen uitzondering wijst naar een zin die niet meer in ' + m[1] + ' staat: "' + m[2] + '"');
  }
  assert.ok(n >= 1, 'er hoort minstens een gewogen uitzondering te staan');
});

/* ============================================================================
   DE SOORTENTABEL IS EEN BEWERING OVER DEZE BRON, DUS HIJ WORDT NAGELOPEN.

   scripts/keuring.js zegt in SOORTEN_PER_ANALYSE welke analyse welke soort
   bevinding kan melden. Daar hangt iets aan: `keur(['privacy'])` geeft een ECHTE
   telling van `stuk` terug in plaats van null, omdat privacy() de enige analyse
   is die stuk meldt. Dat scheelt de meter keuringStuk 47 seconden -- hij hoefde
   de dekkingsanalyse van 40 seconden nooit, hij kreeg hem alleen omdat de regel
   "alleen bij een volledige ronde" te bot was.

   Maar zodra die tabel niet meer klopt, telt een deelronde te weinig en geldt
   dat als een BETERE score. Daarom wordt hij hier uit de bron afgeleid en
   vergeleken: verplaatst iemand een meld()-aanroep naar een andere analyse, dan
   zakt deze toets in plaats van dat de tabel stilletjes verkeerd wordt.
   ========================================================================== */
test('SOORTEN_PER_ANALYSE klopt met wat de analyses echt melden', () => {
  const fs = require('fs');
  const path = require('path');
  const bronPad = path.join(__dirname, '..', 'scripts', 'keuring.js');
  const bron = fs.readFileSync(bronPad, 'utf8');
  const { SOORTEN_PER_ANALYSE, ALLE_ANALYSES, analysesVoorSoort } = require('../scripts/keuring.js');

  /* Per analyse het stuk bron tussen zijn eigen `function x(` en die van de
     volgende, en daarin elke meld('soort', ...). */
  const grenzen = ALLE_ANALYSES
    .map(n => [n, bron.indexOf('\nfunction ' + n + '(')])
    .filter(x => x[1] >= 0)
    .sort((a, b) => a[1] - b[1]);
  assert.equal(grenzen.length, ALLE_ANALYSES.length,
    'elke analyse hoort als functie in de bron te staan; anders leest deze toets het verkeerde stuk');

  const echt = {};
  for (let i = 0; i < grenzen.length; i++) {
    const [naam, start] = grenzen[i];
    const eind = i + 1 < grenzen.length ? grenzen[i + 1][1] : bron.indexOf('function keur(');
    const stuk = bron.slice(start, eind);
    echt[naam] = [...new Set([...stuk.matchAll(/meld\('(\w+)'/g)].map(m => m[1]))].sort();
  }

  for (const naam of ALLE_ANALYSES) {
    assert.deepEqual((SOORTEN_PER_ANALYSE[naam] || []).slice().sort(), echt[naam],
      'de tabel zegt dat ' + naam + ' ' + JSON.stringify(SOORTEN_PER_ANALYSE[naam]) +
      ' meldt, maar in de bron meldt hij ' + JSON.stringify(echt[naam]) +
      '. Een deelronde telt dan te weinig, en te weinig geldt als een betere score.');
  }

  /* En de eigenschap waar de besparing op rust, met zoveel woorden. */
  assert.deepEqual(analysesVoorSoort('stuk'), ['privacy'],
    'stuk komt uit een analyse van 0,01 s; komt daar iets bij, dan wordt keuringStuk weer duur -- ' +
    'dat mag, maar dan hoort deze zin mee te veranderen');
});

test('een deelronde telt een soort pas als ELKE bron van die soort gedraaid heeft', () => {
  const { keur } = require('../scripts/keuring.js');

  const alleenPrivacy = keur(['privacy']);
  assert.equal(typeof alleenPrivacy.stuk, 'number',
    'privacy is de enige die stuk meldt, dus die telling is hier compleet');
  assert.equal(alleenPrivacy.scheef, null, 'scheef komt ook uit dekking en die draaide niet');
  assert.equal(alleenPrivacy.beter, null, 'beter ook niet');

  const alleenUitschieters = keur(['uitschieters']);
  assert.equal(alleenUitschieters.stuk, null,
    'privacy draaide niet, dus stuk hoort null te zijn en niet 0 -- nul zou als de beste score gelden');
  assert.equal(alleenUitschieters.scheef, null, 'scheef komt uit vijf analyses, niet uit deze ene');
});
