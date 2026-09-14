/* DE STAGEVORM-METER: kan hij nog vinden wat hij beweert niet te vinden?

   STAGE.md par. 0 rust op een NUL: 0 van 136 velden staan in alle tien publieke
   domeinen. Op een nul een architectuurbesluit bouwen mag alleen als je kunt
   laten zien dat de meter ook een niet-nul zou hebben gevonden -- anders staat
   hij groen om precies dezelfde reden als een meter die kapot is, en die twee
   zijn van buiten niet te onderscheiden. Dat is dezelfde zelfijking die
   test/carrierevorm.test.js afdwingt, en de reden dat hij daar staat.

   Toets 2 bewaakt een fout die bij het bouwen ECHT is gemaakt en die geen
   uitzondering gaf: de soortenlijst werd door `om.wring()` gehaald, en die
   haalt juist de TEKENREEKSEN eruit. Uitkomst: een lege lijst, geen
   waarschuwing, en een nul op het scherm waar geen nul is. Voor het ZOEKEN naar
   namen is de wringer goed (commentaar mag niet meetellen), voor het LEZEN van
   een waarde is hij verkeerd. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('node:module');
const S = require('../scripts/stagevorm');

const WORTEL = path.join(__dirname, '..');

test('1. zelfijking: versmald tot twee verwante domeinen VINDT de meter wel een gedeelde vorm', () => {
  /* clips en theater zijn allebei video met een duur, een affiche en een bron
     die offline kan staan. Vindt de meter daar niets, dan bewijst de nul over
     tien domeinen niets over die domeinen -- alleen iets over de meter. */
  const echt = S.meet().gemeten.vorm;
  assert.equal(echt.inAlleDomeinen, 0, 'over alle publieke domeinen staat er niets in elk domein');

  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/stagevorm.js'), 'utf8');
  const smal = bron
    /* De shebang eerst eraf: `new Function` strijkt hem niet weg zoals de
       module-lader dat doet, en `#!` is dan gewoon een syntaxfout. Kostte een
       rode toets die eruitzag als een bevinding over de meter. */
    .replace(/^#![^\n]*\n/, '')
    .replace(/^const DOMEINEN = .*$/m,
      'const DOMEINEN = /^server\\/(kern\\/)?(clips|theater)\\b/;');
  assert.notEqual(smal, bron, 'de mutatie heeft de domeinregel werkelijk geraakt');
  const mod = { exports: {} };
  /* Een eigen require die vanuit scripts/ oplost. De require van DIT bestand
     staat in test/, en dan vindt `./objectmodel.js` niets -- en dan meet de
     zelfijking het zoekpad in plaats van de meter. */
  const eigenRequire = createRequire(path.join(WORTEL, 'scripts', 'stagevorm.js'));
  new Function('module', 'exports', 'require', '__dirname', smal)(
    mod, mod.exports, eigenRequire, path.join(WORTEL, 'scripts'));
  const eng = mod.exports.meet().gemeten.vorm;
  assert.ok(eng.inAlleDomeinen > 0,
    'versmald tot clips+theater vindt de meter wel gedeelde velden, gevonden: ' + eng.inAlleDomeinen);
});

test('2. de momentsoorten komen ONGEWRONGEN uit de bron, en zijn dus niet leeg', () => {
  const h = S.meet().gemeten.haak;
  assert.ok(h.soorten.length > 0, 'de soortenlijst is gevuld; leeg betekende hier een leesfout en geen bevinding');
  const bron = fs.readFileSync(path.join(WORTEL, 'server/kern/mediaos/aanwezigheid.js'), 'utf8');
  for (const s of h.soorten) assert.ok(bron.includes("'" + s + "'"), 'de soort `' + s + '` staat echt in kern/mediaos/aanwezigheid.js');
});

test('3. de haak wordt geteld waar hij echt wordt aangeroepen', () => {
  const h = S.meet().gemeten.haak;
  /* Tegenproef in twee richtingen: een domein dat hem aantoonbaar aanroept moet
     erin staan, en een domein dat hem aantoonbaar niet aanroept eruit. Zonder
     de tweede helft zou een meter die ALTIJD ja zegt deze toets halen. */
  assert.ok(h.waar.some(x => x.domein === 'kern/podium'), 'kern/podium roept nieuwWerk() aan bij live gaan');
  /* kern/festival stond hier tot 13 september als het domein ZONDER haak. Sinds
     de aansluiting roept het er wel een aan (mediaNieuwMoment via de
     aanwezigheid), dus de tegenproef verhuist naar een domein dat er
     aantoonbaar geen heeft -- en dat is er ook een met een BESLUIT erachter:
     kern/creator kent alleen `niet`-gebeurtenissen, dus daar hoort geen haak. */
  assert.ok(h.zonderHaak.includes('kern/creator'), 'kern/creator roept geen haak aan');
  assert.ok(!/\b(nieuwWerk|nieuwMoment|mediaNieuwMoment)\s*\(/.test(
    fs.readFileSync(path.join(WORTEL, 'server/kern/creator.js'), 'utf8')),
    'en dat klopt ook echt in de bron');
});

test('4. `moment` is bezet, en STAGE.md par. 1.1 zegt dat niet lichter dan het is', () => {
  const naam = S.meet().gemeten.naam;
  const m = naam.find(x => x.naam === 'momenten');
  assert.ok(m.domeinen.length >= 2,
    'als dit ooit naar 1 zakt, is de naam vrijgekomen en hoort STAGE.md par. 1.1 herzien te worden');
  /* De gevaarlijkste treffer staat met naam in het document: een PRIVATE
     levensgebeurtenis onder dezelfde naam als een publiek moment. Verdwijnt
     die, dan klopt de scherpste zin van par. 1.1 niet meer. */
  assert.ok(m.domeinen.includes('kern/socialegraaf'),
    'de levensgraaf-treffer bestaat nog; par. 1.1 leunt erop');
});
