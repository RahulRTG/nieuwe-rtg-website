/* EEN HALVE METING IS GEEN METING -- ook al komt er een net getal uit.

   Dit is de toets bij TAKEN.md 6.16. `scripts/keuring.js` plakt alle
   toetsbestanden aaneen en zoekt daar de routes in om de dekking te bepalen.
   Kon een bestand niet worden gelezen, dan gaf de leeshulp stilletjes een LEGE
   string terug -- en dan heet elke route die alleen door dat bestand wordt
   aangeroepen ineens ongetest. `endpointsZonderTest` springt omhoog en de
   ratel klaagt over de commit die je net maakte.

   Dat is een keer echt gebeurd (1204 in plaats van 1104) en het is de
   gevaarlijkste soort meetfout: er komt een PLAUSIBEL getal uit. Een meter die
   omvalt merk je; een meter die er honderd naast zit niet.

   Twee beweringen, en ze zitten in verschillende bestanden omdat ze
   verschillende dingen zijn:

     1  de KEURING telt een onleesbaar bestand en zegt het hardop, in plaats van
        het als leeg mee te tellen;
     2  de NORM weigert zo'n rapport en zakt met de reden, in plaats van het
        verschil als achteruitgang van de code te boeken.

   HOE HET ONLEESBARE BESTAND WORDT GEMAAKT, en waarom juist zo. Een kapotte
   symlink geeft ENOENT bij het lezen, ook voor root -- rechten afnemen werkt
   hier niet, want deze toets draait als root en dan mag je alles. Hij heet
   `zz-onleesbaar-hulp.js` en NIET `...test.js`: zo staat hij wel in de map die
   de keuring afloopt (alles onder /test/ dat op .js eindigt) maar niet in de
   glob van `npm test` (`test/*.test.js`) of van `npm run e2e`. Bleef hij ooit
   staan, dan breekt hij geen enkele suite. Opruimen gebeurt in een finally --
   zie eerlijkheidspunt 6.7 en 6.11: een assertie die over het opruimen heen
   springt is hier al twee keer duur geweest.

   Draai los: node --experimental-sqlite --test test/meterhalf.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const KAPOT = path.join(WORTEL, 'test', 'zz-onleesbaar-hulp.js');

test('1. de keuring telt een onleesbaar bestand en zegt het, in plaats van het als leeg te lezen', () => {
  try { fs.unlinkSync(KAPOT); } catch (e) {}
  fs.symlinkSync(path.join(WORTEL, 'test', 'dit-bestaat-niet-zz.js'), KAPOT);
  let rapport;
  try {
    // de symlink wijst nergens heen: readFileSync geeft ENOENT, ook voor root
    assert.throws(() => fs.readFileSync(KAPOT, 'utf8'), /ENOENT/, 'de opzet van deze toets klopt');

    const r = spawnSync(process.execPath, ['--experimental-sqlite', path.join(WORTEL, 'scripts', 'keuring.js'), '--json'],
      { cwd: WORTEL, encoding: 'utf8', timeout: 600000, maxBuffer: 128 * 1024 * 1024 });
    rapport = JSON.parse(r.stdout);
  } finally {
    try { fs.unlinkSync(KAPOT); } catch (e) {}
  }

  assert.ok(rapport && rapport.cijfers, 'de keuring geeft nog steeds een rapport -- hij valt niet om');
  assert.ok(rapport.cijfers.onleesbaar >= 1, 'en telt het onleesbare bestand: ' + rapport.cijfers.onleesbaar);
  assert.ok((rapport.cijfers.onleesbareBestanden || []).some(x => /zz-onleesbaar-hulp/.test(x.bestand)),
    'met de naam erbij, anders weet niemand welk bestand het was');
  const melding = (rapport.bevindingen || []).find(b => b.groep === 'meting');
  assert.ok(melding, 'en er staat een bevinding bij, zodat wie de keuring met de hand draait het ook ziet');
  assert.match(melding.tekst, /halve invoer/, 'die zegt WAT er mis is en niet alleen dat er iets mis is');
  assert.match(String(melding.hoe || ''), /machine/i, 'en waar je moet kijken: de machine, niet de code');
});

test('2. zonder onleesbaar bestand blijft de keuring gewoon stil -- de tegenproef', () => {
  const r = spawnSync(process.execPath, ['--experimental-sqlite', path.join(WORTEL, 'scripts', 'keuring.js'), '--json'],
    { cwd: WORTEL, encoding: 'utf8', timeout: 600000, maxBuffer: 128 * 1024 * 1024 });
  const rapport = JSON.parse(r.stdout);
  assert.equal(rapport.cijfers.onleesbaar, 0, 'op een hele werkboom is er niets onleesbaar');
  assert.ok(!(rapport.bevindingen || []).some(b => b.groep === 'meting'),
    'en dan hoort die melding er ook NIET te staan -- anders meldt hij altijd iets en zegt hij niets');
});

/* ---------------------------------------------------------------------------
   3. En de norm weigert zo'n rapport.

   Zonder de echte keuring van tien minuten: norm.meet() neemt een gevoerd
   rapport aan (`bronnen.keuring`), precies zoals het de mutatie-uitslag al
   aanneemt. Dat is er alleen voor deze ijking en staat zo in de kop van meet().
   --------------------------------------------------------------------------- */
const norm = require('../scripts/norm.js');

// het kleinste rapport waar meet() mee verder komt: genoeg cijfers om langs de
// eerste controles te komen, zodat de toets echt op DEZE regel zakt
const rapportMet = (onleesbaar) => ({
  cijfers: {
    onleesbaar,
    onleesbareBestanden: onleesbaar ? [{ bestand: 'test/zz-onleesbaar-hulp.js', reden: 'ENOENT' }] : [],
    dekking: { routes: 3798, gedekt: 2694, pct: 71, ongedekt: ['/api/x'], domeinenMetGaten: 1 },
    beloftes: {}, privacy: {}, pariteit: { genres: 1 }, dubbelingen: {}, ongebruikt: {},
    i18n: {}, uitschieters: { bijnaTeGroot: 1, teGroot: 0 }
  },
  bevindingen: [], stuk: 0, scheef: 0, beter: 0
});

test('3. de norm weigert een rapport dat op halve invoer is berekend, met de reden erbij', () => {
  assert.throws(() => norm.meet({ keuring: rapportMet(3) }), (e) => {
    assert.match(e.message, /3 bestand\(en\) niet lezen/, 'hij zegt hoeveel');
    assert.match(e.message, /zz-onleesbaar-hulp\.js \(ENOENT\)/, 'en welke, met de reden');
    assert.match(e.message, /machine en niet de code/, 'en waar je moet kijken');
    return true;
  });
});

test('4. en met nul onleesbare bestanden komt hij WEL langs die regel -- anders bewijst 3 niets', () => {
  /* De tegenproef die deze toets pas een toets maakt. Zonder deze zou een
     norm.meet() die op iets ANDERS zakt (een ontbrekend veld in het gevoerde
     rapport, bijvoorbeeld) er precies zo uitzien als een geslaagde weigering. */
  let bericht = null;
  try { norm.meet({ keuring: rapportMet(0) }); }
  catch (e) { bericht = e.message; }
  if (bericht) assert.doesNotMatch(bericht, /niet lezen/,
    'hij mag hier nog steeds ergens anders op zakken, maar NIET op de onleesbare bestanden: ' + bericht);
});
