/* WAT ER PRECIES ZAKTE, LEESBAAR ONDERAAN EEN CI-LOG.

   HET PROBLEEM DAT DIT OPLOST. Node zet een gezakte toets neer op de plek waar
   hij draaide: eerst `not ok <n> - <naam>`, dan een blok met de bewering, de
   verwachte en de gevonden waarde, en de stapel. In CI komt daar daarna een
   dekkingstabel van ruim tweeduizend regels overheen, en de log-API van GitHub
   levert alleen de STAART. Wie een rode stap ziet, ziet dus de tabel en niet de
   fout.

   De stap in .github/workflows/ci.yml herhaalde daarom onderaan de `not ok`-
   regels. Dat gaf de NAAM terug, maar niet de REDEN -- en zonder reden begint
   iedereen weer bij het lokaal naspelen van de hele suite. Op 18 augustus 2026
   koste dat een ochtend: van "not ok 5861 - vergetelheid werkt voor elke pas"
   was niet af te lezen dat het om een wachttijd ging.

   Dit script herhaalt het HELE blok, zodat een rode stap zichzelf uitlegt.

   WAAROM EEN SCRIPT EN GEEN awk IN DE YAML: de stap voor de unit-toetsen en die
   voor de schermtoetsen hebben allebei hetzelfde nodig. Twee kopieen in twee
   stappen lopen uiteen zodra er een verandert (LAT-regel 4).

   Draai los:  node scripts/gezakte-toetsen.js /tmp/gate.log */
'use strict';

const MAX = 40;

/* Een TAP-blok begint bij `not ok <n>` en eindigt bij de sluitregel `...` van
   het YAML-blok eronder. Zit er geen blok bij (dat mag), dan sluit de volgende
   `ok`- of `not ok`-regel hem af -- anders zou de rest van de log meekomen. */
function blokken(tekst) {
  const regels = String(tekst == null ? '' : tekst).split('\n');
  const uit = [];
  let huidig = null;
  for (const regel of regels) {
    const kaal = regel.replace(/^\s+/, '');
    if (/^not ok \d/.test(kaal)) {
      if (huidig) uit.push(huidig);
      huidig = [regel];
      continue;
    }
    if (!huidig) continue;
    if (/^ok \d/.test(kaal)) { uit.push(huidig); huidig = null; continue; }
    huidig.push(regel);
    if (/^\.\.\.\s*$/.test(kaal)) { uit.push(huidig); huidig = null; }
  }
  if (huidig) uit.push(huidig);
  return uit.map(b => b.join('\n'));
}

/* De tellingen onderaan de TAP-uitvoer. Zonder die regels weet je wel wat er
   zakte, maar niet of het er een van zesduizend was of een van drie. */
function tellingen(tekst) {
  return String(tekst == null ? '' : tekst).split('\n')
    .filter(r => /^# (tests|pass|fail|skipped|cancelled) /.test(r.replace(/^\s+/, '')));
}

function rapport(tekst) {
  const alles = blokken(tekst);
  const stukken = [];
  for (const b of alles.slice(0, MAX)) stukken.push(b);
  /* Afkappen mag, stil afkappen niet: een lijst die er compleet uitziet terwijl
     hij het niet is, is erger dan geen lijst (LAT-regel 5). */
  if (alles.length > MAX) {
    stukken.push('----- nog ' + (alles.length - MAX) + ' gezakte toetsen, hier niet afgedrukt -----');
  }
  const tel = tellingen(tekst);
  if (tel.length) stukken.push(tel.join('\n'));
  return { aantal: alles.length, tekst: stukken.join('\n') };
}

module.exports = { blokken, tellingen, rapport };

if (require.main === module) {
  const fs = require('fs');
  const pad = process.argv[2];
  let tekst = '';
  try { tekst = pad ? fs.readFileSync(pad, 'utf8') : fs.readFileSync(0, 'utf8'); }
  catch (e) {
    console.error('[gezakte-toetsen] kan het log niet lezen: ' + e.message);
    process.exit(0);   // een onleesbaar log mag de uitslag van de stap niet veranderen
  }
  const r = rapport(tekst);
  console.log('----- GEZAKTE TOETSEN (herhaald, met de reden erbij) -----');
  console.log(r.aantal ? r.tekst
    : 'Geen "not ok"-regel in het log. De stap zakte dus ergens anders op:\n' +
      'kijk naar de laatste regels hierboven, niet naar de toetsen.');
}
