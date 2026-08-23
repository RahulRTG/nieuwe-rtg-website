/* EEN WEGWERPKOPIE VAN DE WERKBOOM, VOOR TOETSEN DIE DE BRON MOETEN MUTEREN.

   DE REGEL DIE HIER WORDT AFGEDWONGEN: een toets observeert of muteert nooit
   gedeelde bronstaat.

   Waarom die regel er moest komen. Twee toetsbestanden legden hun proefbestand
   in de ECHTE boom neer -- test/meterijk.test.js zet er een stuk of twintig keer
   iets bekend-fouts neer om te zien of de meters uitslaan, en test/keuring.test.js
   legt een dode module neer om te zien of de keuring die vindt. Beide ruimden
   netjes op. Toch was het fout, en op drie manieren:

   1. Andere toetsen SCANNEN diezelfde boom. Wie tegelijk draait ziet een
      halve mutatie en zakt op iets dat niet stuk is.
   2. Daarom stond er een isolatielijst in scripts/test-runner.js: deze
      bestanden serieel, na de rest. Die lijst kostte de helft van de wandklok
      van de hele suite met drie van de vier kernen stil.
   3. En de CI-poort gebruikte die runner NIET (`npm run test:gate` is een kale
      `node --test test/*.test.js`), dus daar gold de isolatie helemaal niet.
      "Groen lokaal" en "groen in CI" waren daarmee niet dezelfde bewering.

   Alle drie zijn gevolgen van EEN oorzaak, en dit is die oorzaak wegnemen
   (LAT-regel 1). Een kopie kost 1,4 seconde op 74 MB; de isolatielijst kostte
   941 seconden. Wie in de kopie werkt heeft geen isolatie meer nodig, en dan
   mogen de lokale runner en de CI-poort weer precies hetzelfde draaien.

   WAT ER NIET MEEGAAT, en waarom:
   - .git          -- niet nodig, en verdubbelt de kopie
   - node_modules  -- de runtime draait zonder pakketten (NORM: dependencies 0)
   - server/data   -- de echte database en de SLEUTELS. Een kopie daarvan in
                      /tmp is een lek, geen versnelling.
   - de journalen  -- meetuitvoer van een lopende ronde, geen bron

   WAAROM EEN KOPIE EN GEEN `git worktree`. Een worktree geeft HEAD, en dat is
   precies niet wat een ijking wil weten: die moet de boom meten zoals hij NU op
   schijf staat, inclusief wat er nog niet gecommit is. Een worktree zou een
   ijking groen laten staan op code die niemand heeft geschreven. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..', '..');
const OVERSLAAN = new Set(['.git', 'node_modules', '.testtijden.json', '.testtijden.ruw',
  '.routejournaal', '.schermjournaal', 'coverage', '.nyc_output']);

/* Een kopie maken. `reden` komt in de mapnaam terecht, zodat een achtergebleven
   map na een kill -9 zichzelf verklaart in plaats van als raadsel in /tmp te
   staan. */
function maakBoom(reden) {
  const naam = 'rtg-boom-' + String(reden || 'onbekend').replace(/[^a-z0-9]+/gi, '-').slice(0, 30) + '-';
  const doel = fs.mkdtempSync(path.join(os.tmpdir(), naam));
  fs.cpSync(WORTEL, doel, {
    recursive: true,
    dereference: false,
    filter: (bron) => {
      const rel = path.relative(WORTEL, bron);
      if (!rel) return true;
      if (OVERSLAAN.has(path.basename(bron))) return false;
      // de echte datamap: alleen server/data, niet elke map die 'data' heet
      if (rel === path.join('server', 'data')) return false;
      return true;
    }
  });

  /* EEN KOPIE DIE GEEN REPOSITORY IS, IS GEEN KOPIE. Zonder deze controle zou
     een mislukte kopie een ijking laten meten op een lege map: elke meter nul,
     elk verschil nul, en alles groen om de verkeerde reden -- de vorm waar
     LAT-regel 3 over gaat. Liever hier stuk dan daar stil. */
  for (const moet of ['package.json', path.join('scripts', 'keuring.js'), path.join('scripts', 'norm.js'), 'test', 'server', 'public']) {
    if (!fs.existsSync(path.join(doel, moet))) {
      try { fs.rmSync(doel, { recursive: true, force: true }); } catch (e) {}
      throw new Error('de wegwerpkopie mist ' + moet + ': de kopie is mislukt, niet de toets');
    }
  }
  return { pad: doel, ruimOp: () => { try { fs.rmSync(doel, { recursive: true, force: true }); } catch (e) {} } };
}

/* De grendel die de regel handhaaft in plaats van hem te beloven. Elke schrijf
   van een bronmuterende toets loopt hierlangs; wijst het pad buiten de
   wegwerpkopie, dan is dat een FOUT en geen waarschuwing. Zonder deze grendel
   is "wij muteren de echte boom niet" een voornemen, en voornemens verlopen. */
function binnen(boom, absoluutPad) {
  const b = path.resolve(boom) + path.sep;
  const p = path.resolve(absoluutPad);
  if (!(p + path.sep).startsWith(b)) {
    throw new Error('een bronmutatie wees BUITEN de wegwerpkopie: ' + p +
      ' ligt niet onder ' + boom + '. Een toets muteert nooit gedeelde bronstaat.');
  }
  return p;
}

module.exports = { maakBoom, binnen, WORTEL };
