#!/usr/bin/env node
/* EEN NIEUWE ROUTE KOMT ER NIET ZONDER TOETS IN.

   endpointsZonderTest staat in NORM.json en mag alleen omlaag. Dat klinkt als
   een poort maar is er geen: het is een TOTAAL. Een tak die drie routes
   toevoegt en er vier laat toetsen, gaat er groen doorheen -- terwijl er drie
   ongetoetste endpoints bij zijn gekomen. En zodra de norm opnieuw wordt
   vastgelegd, schuift het totaal gewoon mee omhoog.

   HET IS OOK ECHT ZO GEGAAN. TAKEN.md 4.3 noemt 622 ongedekte endpoints. Bij
   het schrijven van deze keuring staan er 1192. De ratel heeft in die hele
   periode niet een keer geklaagd, want hij mat het verkeerde ding: hij bewaakt
   de VOORRAAD en niemand bewaakte de INSTROOM.

   Deze keuring bewaakt de instroom. Hij zegt niets over de 1192 die er staan --
   die zijn met geen enkele poort in een ronde weg te werken, en een poort die
   iedereen meteen moet omzeilen is geen poort. Hij zegt alleen: wat er VANDAAG
   bij komt, komt met een toets.

   HOE HIJ WEET WAT NIEUW IS. Niet uit de diff, want een routepad staat lang niet
   altijd op de regel die verandert. In plaats daarvan draait scripts/routekaart.js
   twee keer: een keer op deze tak, en een keer in een worktree van main. Wat in
   de eerste lijst staat en niet in de tweede, is nieuw. Dat is exact, en het
   werkt ook als een route van bestand verhuist -- dan staat hij in allebei de
   lijsten en telt hij niet mee.

   De vraag OF er een toets is, komt uit ./lib/routedekking.js -- dezelfde zeef
   die scripts/keuring.js gebruikt voor het totaal, want twee zeven die hetzelfde
   moeten vinden lopen uiteen (LAT.md regel 4). Die zeef is een tekstzoektocht en
   dus een benadering; hij zit er naar de VEILIGE kant naast (hij mist eerder een
   bestaande toets dan dat hij er een verzint), en dat is voor een poort de goede
   kant.

   Draai:  node scripts/nieuweroutes.js
           node scripts/nieuweroutes.js --tegen FETCH_HEAD
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { zonderCommentaar } = require('./lib/bron');
const { gedektIn } = require('./lib/routedekking');

const WORTEL = path.join(__dirname, '..');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', grijs: '\x1b[2m', reset: '\x1b[0m' };

function routesVan(boom) {
  const uit = execFileSync(process.execPath,
    [path.join(boom, 'scripts/routekaart.js'), '--json'],
    { cwd: boom, encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
  const d = JSON.parse(uit);
  return (d.routes || d || []).map(r => (typeof r === 'string' ? r : r.pad || r.path)).filter(Boolean);
}

function testTekstVan(boom) {
  const map = path.join(boom, 'test');
  const uit = [];
  for (const naam of fs.readdirSync(map)) {
    if (!naam.endsWith('.js')) continue;
    try { uit.push(zonderCommentaar(fs.readFileSync(path.join(map, naam), 'utf8'))); } catch (e) {}
  }
  return uit.join('\n');
}

/* De beoordeling apart van git en van de bestanden, zodat hij met verzonnen
   invoer te ijken is in plaats van met de toevallige stand van de repo. */
function nieuwZonderToets(nu, basis, testTekst) {
  const bekend = new Set(basis);
  return nu.filter(r => r.startsWith('/api/'))
    .filter(r => !bekend.has(r))
    .filter(r => !gedektIn(r, testTekst));
}

function main() {
  const i = process.argv.indexOf('--tegen');
  const ref = i > -1 ? process.argv[i + 1] : 'origin/main';
  let boom = null;
  try {
    boom = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-basisboom-'));
    try {
      execFileSync('git', ['worktree', 'add', '--detach', boom, ref],
        { cwd: WORTEL, stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) {
      /* Geen tweede kant is geen vergelijking; dit hoort te zakken en niet
         stilzwijgend te slagen (LAT.md regel 10). In CI staat er een
         `git fetch --depth=1 origin main` voor. */
      console.error('\n  ' + K.rood + 'De boom van ' + ref + ' is niet uit te checken.' + K.reset +
        '\n  Zonder de stand van main is niet te zeggen welke route nieuw is.\n' +
        '  Haal de tak op (git fetch --depth=1 origin main) en draai opnieuw.\n');
      return 1;
    }
    const nu = routesVan(WORTEL);
    const basis = routesVan(boom);
    const testTekst = testTekstVan(WORTEL);
    const nieuw = nu.filter(r => r.startsWith('/api/')).filter(r => !new Set(basis).has(r));
    const kaal = nieuwZonderToets(nu, basis, testTekst);

    console.log('\n  ' + nu.length + ' routes hier, ' + basis.length + ' op ' + ref +
      ' -- ' + nieuw.length + ' nieuw' + K.grijs + ' (' + (nieuw.length - kaal.length) + ' met een toets)' + K.reset);
    if (kaal.length) {
      console.error('\n  ' + K.rood + 'NIEUWE ROUTES ZONDER TOETS.' + K.reset + '\n');
      for (const r of kaal) console.error('    ' + r);
      console.error('\n  Deze routes bestaan op main nog niet en komen in geen enkele toets voor.\n' +
        '  De 1192 die er al staan zijn een voorraad om af te bouwen; hier gaat het om\n' +
        '  wat er BIJ komt. Roep de route aan in een toets -- de zeef herkent zowel\n' +
        "  '/api/x/y' als 'x/y' en '/x/y' als losse string.\n");
      return 1;
    }
    console.log('  ' + K.groen + 'Geen enkele nieuwe route zonder toets.' + K.reset + '\n');
    return 0;
  } finally {
    if (boom) {
      try { execFileSync('git', ['worktree', 'remove', '--force', boom], { cwd: WORTEL, stdio: 'ignore' }); } catch (e) {}
      try { fs.rmSync(boom, { recursive: true, force: true }); } catch (e) {}
    }
  }
}

module.exports = { nieuwZonderToets };
if (require.main === module) process.exit(main());
