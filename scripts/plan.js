#!/usr/bin/env node
/* DE KLEINSTE AANTOONBAAR VOLDOENDE VERIFICATIE.

   Fase E van de verificatie-runtime, en de reden dat fase D (de bewijsgraaf)
   er is. De opdracht: "RTG moet de kleinste aantoonbaar voldoende verificatie
   kunnen uitvoeren voor iedere verandering -- terwijl de volledige bewijsruimte
   permanent bekend blijft."

   Deze planner kiest, gegeven een lijst gewijzigde bestanden, welke toetsen er
   moeten draaien. Hij kiest ALLEEN weg wat aantoonbaar niets met de wijziging te
   maken heeft.

   DE DRIE REGELS, en de eerste twee bestaan om de derde te mogen hebben:

     1. Een toets met ONBEKENDE of ONVOLLEDIGE afhankelijkheden draait altijd.
        Nooit overgeslagen. Weet je het niet, dan draai je hem.
     2. Een toets die zelf gewijzigd is, draait altijd.
     3. Een toets draait als een gewijzigd bestand in zijn afhankelijkheden zit.

   WAAROM DIT VEILIG MAG. De derde regel is de enige die iets WEGLAAT, en hij
   leunt volledig op de graaf. Die graaf is opgebouwd uit statische requires en
   is voor de serversluiting aantoonbaar VOLLEDIG (1879 bestanden, geen enkele
   onvolgbare require -- de twee die er waren staan met de hand genoemd en er
   ligt een poort onder). Voor alles wat niet volledig te volgen is, valt regel 1
   in. Er wordt dus nooit gegokt: er is een bewezen deelverzameling en een rest
   die altijd meedoet.

   WAT DIT NIET IS. Dit is geen vervanging van de volledige ronde. Voor een
   commit naar de hoofdtak hoort alles te draaien. Dit is voor de honderd keer
   per dag dat iemand een regel verandert en wil weten of hij iets heeft gebroken
   -- en dan is het verschil tussen 1150 seconden en een fractie daarvan het
   verschil tussen wel en niet toetsen.

   Draai:
     node scripts/plan.js                    tegen de laatste commit
     node scripts/plan.js --sinds origin/main
     node scripts/plan.js --bestanden a.js,b.js
     node scripts/plan.js --json
     node scripts/plan.js --draai            en voer die toetsen ook uit
*/
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const { graaf } = require('./lib/bewijsgraaf');

const WORTEL = path.join(__dirname, '..');

function gewijzigdeBestanden(sinds) {
  const r = spawnSync('git', ['diff', '--name-only', sinds], { cwd: WORTEL, encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.split('\n').map(s => s.trim()).filter(Boolean);
}

/* De keuze. Geeft naast de lijst ook de REDEN per toets terug, want een planner
   die niet kan uitleggen waarom hij iets overslaat, is niet te vertrouwen. */
function kies(gewijzigd, g) {
  const veranderd = new Set(gewijzigd);
  const gekozen = new Set();
  const redenen = { altijd: 0, zelfGewijzigd: 0, raakt: 0, overgeslagen: 0 };

  // 1. onbekend of onvolledig: altijd, zonder uitzondering
  for (const naam of g.altijd) { gekozen.add(naam); redenen.altijd++; }

  // 2. de toets is zelf gewijzigd
  for (const naam of g.perToets.keys()) {
    if (gekozen.has(naam)) continue;
    if (veranderd.has('test/' + naam)) { gekozen.add(naam); redenen.zelfGewijzigd++; }
  }

  // 3. de toets raakt een gewijzigd bestand -- via de omgekeerde index, dus een
  //    opzoeking per bestand in plaats van een zoektocht per toets
  for (const bestand of veranderd) {
    for (const naam of (g.perBestand.get(bestand) || [])) {
      if (gekozen.has(naam)) continue;
      gekozen.add(naam); redenen.raakt++;
    }
  }
  redenen.overgeslagen = g.perToets.size - gekozen.size;
  return { toetsen: [...gekozen], redenen };
}

module.exports = { kies, gewijzigdeBestanden };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const lees = (vlag) => { const i = argv.indexOf(vlag); return i >= 0 ? argv[i + 1] : null; };
  const handmatig = lees('--bestanden');
  const sinds = lees('--sinds') || 'HEAD';
  const gewijzigd = handmatig ? handmatig.split(',').map(s => s.trim()).filter(Boolean) : gewijzigdeBestanden(sinds);

  if (!gewijzigd) {
    console.error('[plan] git kon de wijzigingen niet lezen; dan is er geen deelverzameling te verantwoorden.');
    console.error('[plan] Draai de VOLLEDIGE ronde: npm test');
    process.exit(1);
  }
  const g = graaf({ wortel: WORTEL });
  if (!g) { console.error('[plan] de bewijsgraaf kon niet worden opgebouwd; draai de volledige ronde.'); process.exit(1); }

  const { toetsen, redenen } = kies(gewijzigd, g);
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ gewijzigd, toetsen, redenen, totaal: g.perToets.size }, null, 2));
    process.exit(0);
  }
  console.log('\nDE KLEINSTE VOLDOENDE VERIFICATIE\n');
  console.log('  gewijzigde bestanden   ' + String(gewijzigd.length).padStart(6));
  console.log('  toetsen in totaal      ' + String(g.perToets.size).padStart(6));
  console.log('  hiervan te draaien     ' + String(toetsen.length).padStart(6)
    + '   (' + Math.round(100 * toetsen.length / g.perToets.size) + '%)');
  console.log('    omdat ze onbekend of onvolledig zijn  ' + String(redenen.altijd).padStart(5));
  console.log('    omdat de toets zelf gewijzigd is      ' + String(redenen.zelfGewijzigd).padStart(5));
  console.log('    omdat ze de wijziging raken           ' + String(redenen.raakt).padStart(5));
  console.log('  aantoonbaar overgeslagen ' + String(redenen.overgeslagen).padStart(4));
  if (!gewijzigd.length) console.log('\n  (geen wijzigingen gevonden -- dan is elke toets die draait er een te veel)');
  console.log('\n  Dit vervangt de volledige ronde NIET: voor de hoofdtak hoort alles te draaien.\n');
  if (argv.includes('--draai') && toetsen.length) {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'test-runner.js'), '--bestanden=' + toetsen.join(',')],
      { cwd: WORTEL, stdio: 'inherit' });
    process.exit(r.status == null ? 2 : r.status);
  }
}
