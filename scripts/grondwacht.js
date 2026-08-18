#!/usr/bin/env node
'use strict';

/* DE GRONDWACHT -- de post die niemand ziet aankomen, omdat er geen rood
   licht voor bestaat.

   Alle andere meters hier kijken naar de code: zakt een toets, breekt een
   wet, valt de dekking onder de vloer. Deze kijkt naar de GROND waar die
   code op staat, en die verschuift zonder dat er iemand pusht. Node gaat
   end-of-life, een experimentele vlag verdwijnt of wordt juist overbodig,
   en de versie in de CI loopt weg van de versie in de container. Niets
   daarvan wordt rood bij een commit, want er is geen commit.

   Waarom dit hier moest komen, concreet: de Node-versie stond op ZEVEN
   plekken in de workflows plus in de Dockerfile, er was geen `engines` en
   geen `.nvmrc`, en `--experimental-sqlite` stond in ongeveer dertig
   npm-scripts terwijl `node:sqlite` op Node 22.22 allang zonder die vlag
   laadt. Drie stille achterstanden, nul rode lichten.

   Draaien:
     node scripts/grondwacht.js
     node scripts/grondwacht.js --kalender=pad/naar/schedule.json   (voor toetsen)
     node scripts/grondwacht.js --json                              (alleen GRONDWACHT.json)

   EXITCODES, en het verschil telt:
     0  niets hards gevonden (zachte bevindingen staan wel in het rapport)
     1  een harde bevinding -- de grond is al verschoven
     2  de wacht KON NIET METEN (kalender onbereikbaar, bron weg)

   Die 2 is met opzet geen 0. Een wacht die groen wordt omdat hij niets kon
   zien is de gevaarlijkste meter die er is; LAT.md regel 3 zegt dat een
   meter zakt als zijn invoer ontbreekt, en dit is die regel toegepast op
   een meting die van het netwerk afhangt. */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const KALENDER_URL = 'https://raw.githubusercontent.com/nodejs/Release/main/schedule.json';
const DAG = 86400000;

/* Hoe lang van tevoren een naderend einde meetelt. Zes maanden is geen rond
   getal maar de tijd die een grote versiesprong in dit huis echt kost: de
   Rust-motor mee, de container mee, de hele suite er twee keer overheen. */
const WAARSCHUWING_DAGEN = 180;
const HARD_DAGEN = 60;

/* ---------- puur: het einde van een Node-lijn ---------------------------- */

/* Geeft de stand van een major terug, of gooit als de kalender hem niet kent.
   Dat gooien is de bedoeling: een onbekende major betekent dat we op iets
   draaien wat Node zelf niet meer in zijn kalender heeft staan, en dat is
   erger dan een naderend einde, niet onschuldiger. */
function eol(kalender, major, nu) {
  const sleutel = 'v' + major;
  const rij = kalender && kalender[sleutel];
  if (!rij || !rij.end) {
    const e = new Error(`De releasekalender van Node kent ${sleutel} niet (of noemt geen einddatum).`);
    e.code = 'ONBEKENDE_MAJOR';
    throw e;
  }
  const eind = new Date(rij.end + 'T00:00:00Z').getTime();
  const dagen = Math.floor((eind - nu.getTime()) / DAG);
  const onderhoud = rij.maintenance ? new Date(rij.maintenance + 'T00:00:00Z').getTime() : null;
  return {
    major,
    eind: rij.end,
    dagen,
    lts: !!rij.lts,
    codenaam: rij.codename || null,
    fase: dagen < 0 ? 'voorbij' : (onderhoud && nu.getTime() >= onderhoud ? 'onderhoud' : 'actief')
  };
}

/* De opvolger: de nieuwste major die AL LTS is en nog niet afloopt. Niet de
   hoogste major -- een oneven lijn (23, 25) is geen doel om naartoe te
   migreren, die is zelf binnen een halfjaar dood. */
function opvolger(kalender, huidig, nu) {
  let best = null;
  for (const [sleutel, rij] of Object.entries(kalender || {})) {
    const m = /^v(\d+)$/.exec(sleutel);
    if (!m || !rij.lts || !rij.end) continue;
    const major = Number(m[1]);
    if (major <= huidig) continue;
    if (new Date(rij.lts + 'T00:00:00Z').getTime() > nu.getTime()) continue;   // nog niet LTS
    if (new Date(rij.end + 'T00:00:00Z').getTime() <= nu.getTime()) continue;  // al voorbij
    if (!best || major > best.major) best = { major, eind: rij.end, codenaam: rij.codename || null };
  }
  return best;
}

/* ---------- puur: één waarheid over de versie ---------------------------- */

/* LAT.md regel 4: nooit twee plekken die een waarheid vasthouden. De
   Node-versie is daar het schoolvoorbeeld van, want hij MOET wel op meerdere
   plekken staan -- de CI kent geen package.json-veld en de Dockerfile geen
   nvmrc. Wat dan overblijft is niet "één plek" maar "alle plekken zeggen
   hetzelfde, en er is een meter die dat afdwingt". Dit is die meter.

   Onenigheid is hier geen schoonheidsfoutje: de CI toetst dan een andere
   runtime dan de container draait, en dat is de klasse fout die pas in
   productie zichtbaar wordt. */
function eenWaarheid(bronnen) {
  const bevindingen = [];
  const gevonden = bronnen.filter(b => b.major !== null);
  const ontbreekt = bronnen.filter(b => b.major === null);

  for (const b of ontbreekt) {
    bevindingen.push({
      code: 'VERSIEBRON_ONTBREEKT',
      ernst: b.verplicht ? 'hard' : 'zacht',
      wat: `${b.naam} legt geen Node-versie vast.`,
      waarom: 'Wie hier de versie niet leest, kiest er zelf een. Dan draait de een 22 en de ander 24, en niemand ziet het verschil tot het misgaat.',
      doen: b.hoe
    });
  }

  const majors = [...new Set(gevonden.map(b => b.major))];
  if (majors.length > 1) {
    bevindingen.push({
      code: 'VERSIES_ONEENS',
      ernst: 'hard',
      wat: 'De Node-versie verschilt per plek: ' + gevonden.map(b => `${b.naam}=${b.major}`).join(', ') + '.',
      waarom: 'De CI toetst dan een andere runtime dan de container draait. Dat is geen verschil in smaak maar een gat in het bewijs: groen in de CI zegt niets over de versie die de klant raakt.',
      doen: 'Zet alle bronnen op dezelfde major.'
    });
  }

  return { bevindingen, major: majors.length === 1 ? majors[0] : null, bronnen: gevonden };
}

/* De versie uit een tekst peuteren. Bewust ruim: '22', 'v22', '22.11.0',
   '>=22', 'node:22-slim' en '^22.0.0' leveren allemaal 22 op. */
function majorUit(tekst) {
  if (tekst === null || tekst === undefined) return null;
  const m = /(\d+)/.exec(String(tekst));
  return m ? Number(m[1]) : null;
}

/* Alle plekken die in dit huis een Node-versie vasthouden. Deze lijst is de
   enige plek waar die plekken staan; komt er een bron bij, dan komt hij hier
   bij en nergens anders. */
function versiebronnen(wortel) {
  const lees = p => { try { return fs.readFileSync(path.join(wortel, p), 'utf8'); } catch { return null; } };
  const bronnen = [];

  const pkgTekst = lees('package.json');
  let engines = null;
  try { engines = pkgTekst ? (JSON.parse(pkgTekst).engines || {}).node : null; } catch { engines = null; }
  bronnen.push({
    naam: 'package.json engines.node', major: majorUit(engines), verplicht: true,
    hoe: 'Zet "engines": { "node": ">=22" } in package.json; npm waarschuwt dan zelf bij een verkeerde versie.'
  });

  const nvmrc = lees('.nvmrc');
  bronnen.push({
    naam: '.nvmrc', major: majorUit(nvmrc), verplicht: true,
    hoe: 'Zet de major in .nvmrc; nvm, fnm en volta lezen die allemaal.'
  });

  const docker = lees('Dockerfile');
  const dockerNode = docker && /^FROM\s+node:(\S+)/m.exec(docker);
  bronnen.push({
    naam: 'Dockerfile', major: dockerNode ? majorUit(dockerNode[1]) : null, verplicht: true,
    hoe: 'Zet FROM node:<major>-slim in de Dockerfile.'
  });

  const wfMap = path.join(wortel, '.github', 'workflows');
  let wfBestanden = [];
  try { wfBestanden = fs.readdirSync(wfMap).filter(n => /\.ya?ml$/.test(n)).sort(); } catch { /* geen workflows */ }
  for (const naam of wfBestanden) {
    const tekst = fs.readFileSync(path.join(wfMap, naam), 'utf8');
    const versies = [...tekst.matchAll(/node-version:\s*['"]?([^'"\s]+)/g)].map(m => majorUit(m[1]));
    for (const [i, major] of versies.entries()) {
      bronnen.push({ naam: `.github/workflows/${naam}#${i + 1}`, major, verplicht: false, hoe: 'Zet node-version op dezelfde major.' });
    }
  }

  return bronnen;
}

/* ---------- meten, niet aannemen: de experimentele vlaggen --------------- */

/* Een vlag als --experimental-sqlite is een tijdelijke afspraak met de
   runtime, en beide kanten van die afspraak kunnen wegvallen: de vlag kan
   verdwijnen (dan start niets meer) of overbodig worden (dan staat hij voor
   niets in dertig scripts en suggereert hij instabiliteit die er niet is).

   LAT.md regel 2 zegt: elke bewering wordt met een mutatie nagetrokken. Dus
   we LEZEN niet in de release notes wat er met de vlag is, we starten twee
   keer een echte node en kijken wat er gebeurt. */
function vlagstand(vlag, proef, node = process.execPath) {
  const probeer = argv => {
    try {
      execFileSync(node, argv.concat(['-e', proef]), { stdio: 'pipe', timeout: 20000 });
      return true;
    } catch {
      return false;
    }
  };
  return { vlag, metVlag: probeer([vlag]), zonderVlag: probeer([]) };
}

/* Welke vlaggen dit huis daadwerkelijk gebruikt, uit de npm-scripts zelf.
   Niet uit een lijst die iemand bijhoudt -- die loopt achter. */
function vlaggenInGebruik(pkg) {
  const vlaggen = new Set();
  for (const cmd of Object.values((pkg && pkg.scripts) || {})) {
    for (const m of String(cmd).matchAll(/--experimental-[a-z-]+/g)) vlaggen.add(m[0]);
  }
  return [...vlaggen].sort();
}

/* De proef per vlag. Twee SOORTEN, en dat onderscheid is geen detail:

   'toegang' -- de vlag zet een functie open die er zonder vlag niet is
                (node:sqlite laadt niet). Hier betekent "werkt ook zonder"
                dat de vlag overbodig is geworden: opruimen.

   'gedrag'  -- de vlag verandert hoe node zich gedraagt, maar de code loopt
                zonder vlag net zo goed (dekking wordt dan alleen niet
                gemeten). Hier bestaat "overbodig" niet, en de enige zinnige
                vraag is of node de vlag nog ACCEPTEERT.

   Dat onderscheid is er gekomen omdat de eerste versie van deze wacht
   --experimental-test-coverage als "overbodig" meldde. De proef was
   process.exit(0), en die heeft geen enkele vlag nodig. De meter mat dus
   niets en meldde toch iets: precies wat LAT.md regel 9 een toets noemt die
   niet kan zakken. De proef was fout, niet de melding.

   Staat een gebruikte vlag hier niet bij, dan meldt de wacht dat -- hij doet
   niet alsof hij hem heeft nagetrokken. */
const PROEVEN = {
  '--experimental-sqlite': { soort: 'toegang', proef: "require('node:sqlite')" },
  '--experimental-test-coverage': { soort: 'gedrag', proef: '0' }
};

function vlagbevindingen(vlaggen, meet = vlagstand) {
  const bevindingen = [];
  for (const vlag of vlaggen) {
    const afspraak = PROEVEN[vlag];
    if (!afspraak) {
      bevindingen.push({
        code: 'VLAG_ONGETOETST', ernst: 'zacht',
        wat: `${vlag} wordt gebruikt maar heeft geen proef in scripts/grondwacht.js.`,
        waarom: 'Een vlag zonder proef wordt niet bewaakt. Dat is geen ramp, maar de wacht moet niet doen alsof hij hem dekt.',
        doen: `Zet een regel in PROEVEN met het kleinste stukje code dat ${vlag} echt nodig heeft.`
      });
      continue;
    }
    const stand = meet(vlag, afspraak.proef);
    if (!stand.metVlag) {
      bevindingen.push({
        code: 'VLAG_WEG', ernst: 'hard',
        wat: `${vlag} werkt niet meer op deze Node (${process.version}).`,
        waarom: 'Elk script dat deze vlag draagt start nu niet meer. Dat is geen waarschuwing maar een storing.',
        doen: `Zoek uit waar de functionaliteit achter ${vlag} heen is en pas de scripts aan.`
      });
    } else if (afspraak.soort === 'toegang' && stand.zonderVlag) {
      bevindingen.push({
        code: 'VLAG_OVERBODIG', ernst: 'zacht',
        wat: `${vlag} is niet meer nodig op deze Node (${process.version}).`,
        waarom: 'De vlag staat nu voor niets in de scripts en suggereert instabiliteit die er niet meer is. Opruimen kost een sed-opdracht; laten staan kost bij elke nieuwe ontwikkelaar een vraag.',
        doen: `Haal ${vlag} uit de npm-scripts, de workflows en de Dockerfile.`
      });
    }
  }
  return bevindingen;
}

/* ---------- de kalender ophalen ------------------------------------------ */

async function kalender(argv) {
  const lokaal = (argv.find(a => a.startsWith('--kalender=')) || '').slice(11);
  if (lokaal) return JSON.parse(fs.readFileSync(lokaal, 'utf8'));
  const r = await fetch(KALENDER_URL, { headers: { 'user-agent': 'rtg-wacht' } });
  if (!r.ok) throw Object.assign(new Error(`De releasekalender gaf ${r.status}.`), { code: 'KALENDER_ONBEREIKBAAR' });
  return r.json();
}

/* ---------- de ronde ------------------------------------------------------ */

async function ronde({ wortel = WORTEL, nu = new Date(), argv = [] } = {}) {
  const bevindingen = [];
  const kal = await kalender(argv);

  const bronnen = versiebronnen(wortel);
  const waarheid = eenWaarheid(bronnen);
  bevindingen.push(...waarheid.bevindingen);

  /* De major waar we het einde van meten: die van de bronnen als ze het eens
     zijn, anders die van de draaiende node. Bij onenigheid staat er al een
     harde bevinding, dus we verzinnen hier geen winnaar. */
  const major = waarheid.major !== null ? waarheid.major : Number(process.versions.node.split('.')[0]);
  const stand = eol(kal, major, nu);
  const volgende = opvolger(kal, major, nu);

  if (stand.dagen < 0) {
    bevindingen.push({
      code: 'NODE_EOL_VOORBIJ', ernst: 'hard',
      wat: `Node ${major} is sinds ${stand.eind} end-of-life (${-stand.dagen} dagen geleden).`,
      waarom: 'Er komen geen beveiligingspatches meer. Elk lek in de runtime blijft open, en er is geen leverancier die het dichtzet.',
      doen: volgende ? `Migreer naar Node ${volgende.major} (LTS tot ${volgende.eind}).` : 'Zoek de eerstvolgende LTS-lijn op.'
    });
  } else if (stand.dagen <= HARD_DAGEN) {
    bevindingen.push({
      code: 'NODE_EOL_NABIJ', ernst: 'hard',
      wat: `Node ${major} is over ${stand.dagen} dagen end-of-life (${stand.eind}).`,
      waarom: 'Binnen twee maanden stoppen de beveiligingspatches. Een versiesprong kost hier meer dan een middag: de container, de Rust-motor en de hele suite gaan mee.',
      doen: volgende ? `Migreer naar Node ${volgende.major} (LTS tot ${volgende.eind}).` : 'Zoek de eerstvolgende LTS-lijn op.'
    });
  } else if (stand.dagen <= WAARSCHUWING_DAGEN) {
    bevindingen.push({
      code: 'NODE_EOL_ZICHT', ernst: 'zacht',
      wat: `Node ${major} loopt af op ${stand.eind} (over ${stand.dagen} dagen).`,
      waarom: 'Nog geen storing, wel het moment om de sprong te plannen in plaats van hem te ondergaan.',
      doen: volgende ? `Plan de overstap naar Node ${volgende.major} (LTS tot ${volgende.eind}).` : 'Wacht op de volgende LTS-lijn.'
    });
  }

  let pkg = null;
  try { pkg = JSON.parse(fs.readFileSync(path.join(wortel, 'package.json'), 'utf8')); } catch { pkg = null; }
  if (!pkg) {
    throw Object.assign(new Error('package.json is niet te lezen; de wacht kan niets meten.'), { code: 'BRON_WEG' });
  }
  bevindingen.push(...vlagbevindingen(vlaggenInGebruik(pkg)));

  return {
    gemetenOp: nu.toISOString(),
    draaitOp: process.version,
    node: stand,
    opvolger: volgende,
    bronnen: waarheid.bronnen.map(b => ({ naam: b.naam, major: b.major })),
    bevindingen,
    hard: bevindingen.filter(b => b.ernst === 'hard').length,
    zacht: bevindingen.filter(b => b.ernst === 'zacht').length
  };
}

/* ---------- uitvoer ------------------------------------------------------- */

function toon(uitslag) {
  const r = [];
  r.push('DE GRONDWACHT');
  r.push(`  draait op        ${uitslag.draaitOp}`);
  r.push(`  vastgelegd op    Node ${uitslag.node.major} (${uitslag.node.fase}, einde ${uitslag.node.eind}, nog ${uitslag.node.dagen} dagen)`);
  if (uitslag.opvolger) r.push(`  opvolger         Node ${uitslag.opvolger.major} (LTS tot ${uitslag.opvolger.eind})`);
  r.push('');
  if (!uitslag.bevindingen.length) {
    r.push('  Geen bevindingen. De grond ligt stil.');
  } else {
    for (const b of uitslag.bevindingen) {
      r.push(`  [${b.ernst === 'hard' ? 'HARD' : 'zacht'}] ${b.code}: ${b.wat}`);
      r.push(`         waarom: ${b.waarom}`);
      r.push(`         doen:   ${b.doen}`);
    }
  }
  r.push('');
  r.push(`  ${uitslag.hard} hard, ${uitslag.zacht} zacht.`);
  return r.join('\n');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  ronde({ argv }).then(uitslag => {
    fs.writeFileSync(path.join(WORTEL, 'GRONDWACHT.json'), JSON.stringify(uitslag, null, 2) + '\n');
    if (!argv.includes('--json')) console.log(toon(uitslag));
    process.exit(uitslag.hard ? 1 : 0);
  }).catch(e => {
    /* Exitcode 2: de wacht KON NIET METEN. Geen 1 (dan zou een fix-lus gaan
       zoeken naar een probleem dat er niet is) en zeker geen 0. */
    console.error('DE WACHT KON NIET METEN: ' + e.message);
    console.error('Dit is geen groen licht. ' + (e.code === 'KALENDER_ONBEREIKBAAR'
      ? 'De releasekalender van Node was niet bereikbaar; draai opnieuw of geef --kalender=<pad>.'
      : 'Zoek uit waarom de bron weg is voordat je verder gaat.'));
    process.exit(2);
  });
}

module.exports = { eol, opvolger, eenWaarheid, majorUit, versiebronnen, vlaggenInGebruik, vlagbevindingen, vlagstand, ronde, toon };
