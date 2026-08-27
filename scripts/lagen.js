/* DE LAGENMODELLEN VAN DIT HUIS, en of ze nog een naam delen.

   WAAROM DIT BESTAAT. OS.md par. 4.2 vond een botsing die niet principieel was
   maar aanwijsbaar: het woord "Capabilities" stond in het lagenmodel van
   PLATFORM.md par. 2 en in dat van RTG Universal OS, en het betekende er niet
   hetzelfde -- daar de `caps` van een genre (domeinvermogen), hier een
   herbruikbare bedrijfsfunctie als Payment.Authorize (platformvermogen). Dat
   woord is hernoemd; laag 4 heet nu genre-cap.

   Een hernoeming in drie documenten is precies het soort reparatie dat over een
   jaar stil terugdraait. Iemand schrijft een nieuw lagenmodel op, kiest een
   naam die al bezet is, en niemand merkt het -- want er is geen plek waar de
   modellen naast elkaar staan. Deze meter maakt die plek, en hij maakt hem
   AFGELEID: hij leest de tabellen uit de documenten zelf, zodat er geen register
   naast de tekst komt te leven dat op zijn beurt kan verouderen. Dat is de
   waarschuwing uit BEWIJSMACHINE.md par. 4 over semantische registers, hier
   toegepast op het kleinste denkbare register.

   TWEE DINGEN WORDEN GEMETEN, en ze zijn niet hetzelfde:

     BOTSING    twee VERSCHILLENDE modellen gebruiken dezelfde laagnaam. Dat is
                de fout die OS.md par. 4.2 beschrijft.
     AFWIJKING  een model wordt in een ander document GECITEERD en de citatie
                klopt niet meer met de bron. OS.md par. 4.2 zet de lagen van
                PLATFORM.md par. 2 over in zijn eigen tabel; dat is dezelfde
                waarheid op twee plekken (LAT-regel 4) en het enige wat dat
                draaglijk maakt is een meter die het vergelijkt.

   De tweede sloeg meteen aan tijdens het bouwen: bij de hernoeming was
   PLATFORM.md bijgewerkt en de citatie in OS.md nog niet.

   WAT DEZE METER NIET DOET. Hij leest tabellen, geen proza. PLATFORM.md par. 0
   gebruikt "capability" in een derde betekenis (een zelfstandig vak dat een
   eigen app verdient) en dat ziet deze meter niet -- die staat er bewust nog,
   met de reden in OS.md par. 4.2. Een meter die beweert alle betekenissen van
   een woord te vinden, zou liegen; deze doet een kleinere bewering die hij waar
   kan maken.

   Draaien:  node scripts/lagen.js          (leesbaar)
             node scripts/lagen.js --json   (voor een toets of een ander script) */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');

/* De documenten waarin een lagenmodel kan staan. Wie er een toevoegt, zet hem
   hier bij -- en dan meet deze lijst hem meteen tegen de andere. */
const DOCUMENTEN = ['PLATFORM.md', 'OS.md'];

/* Namen vergelijken zonder over opmaak te struikelen: **vet**, `code`, dubbele
   spaties en hoofdletters zeggen niets over de betekenis van een laagnaam. */
const norm = (s) => String(s || '')
  .replace(/\*\*/g, '').replace(/`/g, '')
  .replace(/\s+/g, ' ').trim().toLowerCase();

/* EEN LAAGTABEL herken je aan haar rijen: een nummer, een kastlijn en een naam.
   Met nadruk mag ook: "| **1 (kastlijn) Specialistische apps** | ...".

   HET SCHEIDINGSTEKEN STAAT HIER ALS CODEPUNT, en dat is geen omslachtigheid.
   Keuringsregel 3 verbiedt brede streepjes in de bron van dit huis (huisstijl),
   maar de MARKDOWN-tabellen die deze meter leest gebruiken er wel een. Een meter
   die het teken moet herkennen dat hij zelf niet mag dragen, bouwt het op --
   precies zoals scripts/check.js dat voor diezelfde regel doet. Een blinde
   zoek-en-vervang zette hier een keer twee koppeltekens neer, en toen vond deze
   meter geen enkel lagenmodel meer en meldde opgewekt "geen botsing".

   Het koppelteken in "genre-caps" is een ander teken; daarom hoeft er geen
   spatie omheen te staan in het patroon. */
const KASTLIJN = String.fromCharCode(0x2014);
const RIJ = new RegExp('^\\|\\s*\\*{0,2}\\s*(\\d+)\\s*' + KASTLIJN + '\\s*([^|]+?)\\s*\\*{0,2}\\s*\\|');

function lagenUitTabel(tekst) {
  const uit = [];
  for (const regel of String(tekst || '').split('\n')) {
    const m = RIJ.exec(regel);
    if (m) uit.push({ nummer: Number(m[1]), naam: norm(m[2]) });
  }
  return uit;
}

/* Alle lagenmodellen die EEN document zelf declareert. Elk model wordt benoemd
   naar de paragraaf waarin het staat, want dat is precies hoe de rest van het
   huis ernaar verwijst ("PLATFORM.md par. 2"). Een tabel met minder dan drie
   genummerde rijen telt niet als lagenmodel -- twee rijen is een opsomming. */
const MIN_LAGEN = 3;

function modellenVan(tekst, bestand) {
  const uit = {};
  for (const deel of String(tekst || '').split(/\n(?=## )/)) {
    const kop = /^## +([0-9]+[a-z]?)\./.exec(deel);
    if (!kop) continue;
    const lagen = lagenUitTabel(deel);
    if (lagen.length < MIN_LAGEN) continue;
    uit[bestand + ' par. ' + kop[1]] = lagen.map(l => l.naam);
  }
  return uit;
}

/* EEN CITATIETABEL zet meerdere modellen naast elkaar om ze te vergelijken; die
   in OS.md par. 4.2 is de enige. Vorm: "| A | bron | de as | laag, laag, laag |".
   De bron is de sleutel -- daaraan zie je of een rij een ANDER model citeert of
   een NIEUW model introduceert. */
const CITAAT = /^\|\s*([A-Z])\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/;

function citatenVan(tekst, bestand) {
  const uit = [];
  for (const regel of String(tekst || '').split('\n')) {
    const m = CITAAT.exec(regel);
    if (!m) continue;
    const lagen = m[4].split(',').map(norm).filter(Boolean);
    if (lagen.length < MIN_LAGEN) continue;
    uit.push({ merk: m[1], bron: norm(m[2]), as: norm(m[3]), lagen, waar: bestand });
  }
  return uit;
}

/* Een citaatbron ("`PLATFORM.md` par. 2") terugvertalen naar de sleutel van een
   gedeclareerd model ("PLATFORM.md par. 2"). Beide zijn al genormaliseerd, dus
   dit is een vergelijking en geen gok. */
const zelfdeBron = (bron, sleutel) => norm(sleutel) === bron;

/* DE ANALYSE. Krijgt wat er gelezen is en rekent; geen bestanden, geen paden --
   zo kan een toets hem verzonnen modellen voeren en zien of hij aanslaat. */
function analyse({ modellen, citaten }) {
  /* Elk model één keer, onder zijn eigen naam. Een citatie van een model dat
     hier al staat, voegt geen model toe -- anders zou elk citaat als botsing
     terugkomen met het model dat het citeert. */
  const alle = Object.assign({}, modellen);
  const afwijkingen = [];
  const zonderBron = [];

  for (const c of citaten) {
    const sleutel = Object.keys(modellen).find(k => zelfdeBron(c.bron, k));
    if (sleutel) {
      const bron = modellen[sleutel];
      const gelijk = bron.length === c.lagen.length && bron.every((n, i) => n === c.lagen[i]);
      if (!gelijk) afwijkingen.push({ waar: c.waar, merk: c.merk, bron: sleutel, citaat: c.lagen, echt: bron });
      continue;
    }
    /* Een rij die geen bestaand model citeert, INTRODUCEERT er een. Zo komt het
       voorstel uit OS.md ("deze opzet") in de vergelijking terecht zonder dat
       het ergens anders als tabel hoeft te staan. */
    const naam = c.waar + ' -- ' + c.bron;
    alle[naam] = c.lagen;
    zonderBron.push({ naam, merk: c.merk });
  }

  const waar = new Map();
  for (const [model, lagen] of Object.entries(alle))
    for (const laag of lagen) {
      if (!waar.has(laag)) waar.set(laag, new Set());
      waar.get(laag).add(model);
    }

  const botsingen = [...waar.entries()]
    .filter(([, m]) => m.size > 1)
    .map(([naam, m]) => ({ naam, modellen: [...m].sort() }))
    .sort((a, b) => a.naam.localeCompare(b.naam));

  return {
    modellen: alle,
    aantalModellen: Object.keys(alle).length,
    aantalLagen: waar.size,
    botsingen,
    afwijkingen,
    zonderBron
  };
}

function lees(wortel) {
  const root = wortel || WORTEL;
  const modellen = {};
  const citaten = [];
  for (const bestand of DOCUMENTEN) {
    const pad = path.join(root, bestand);
    if (!fs.existsSync(pad)) continue;
    const tekst = fs.readFileSync(pad, 'utf8');
    Object.assign(modellen, modellenVan(tekst, bestand));
    citaten.push(...citatenVan(tekst, bestand));
  }
  return { modellen, citaten };
}

const meet = (wortel) => analyse(lees(wortel));

if (require.main === module) {
  const uit = meet();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(uit, null, 2));
  } else {
    console.log('LAGENMODELLEN\n');
    for (const [naam, lagen] of Object.entries(uit.modellen))
      console.log('  ' + naam + '\n      ' + lagen.join(' · '));
    console.log('\n' + uit.aantalModellen + ' modellen, ' + uit.aantalLagen + ' verschillende laagnamen.');

    if (uit.botsingen.length) {
      console.log('\nBOTSINGEN -- dezelfde naam in meer dan een model:');
      for (const b of uit.botsingen) console.log('  "' + b.naam + '" in ' + b.modellen.join(' + '));
    } else console.log('\nGeen botsing: geen laagnaam staat in twee modellen.');

    if (uit.afwijkingen.length) {
      console.log('\nAFWIJKINGEN -- een citatie loopt achter op zijn bron:');
      for (const a of uit.afwijkingen) {
        console.log('  ' + a.waar + ' rij ' + a.merk + ' citeert ' + a.bron);
        console.log('      citaat: ' + a.citaat.join(' · '));
        console.log('      bron:   ' + a.echt.join(' · '));
      }
    } else console.log('Geen afwijking: elke citatie is gelijk aan zijn bron.');
  }
  process.exitCode = (uit.botsingen.length || uit.afwijkingen.length) ? 1 : 0;
}

module.exports = { DOCUMENTEN, MIN_LAGEN, norm, lagenUitTabel, modellenVan, citatenVan, analyse, lees, meet };
