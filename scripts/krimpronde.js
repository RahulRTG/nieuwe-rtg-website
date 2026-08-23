#!/usr/bin/env node
/* ============================================================================
   DE KRIMPRONDE -- welke collecties krimpen hier LEGITIEM, en hoeveel?

   WAAROM DIT ER IS. server/opzet/begroting.js kan een massaverwijdering
   tegenhouden, en staat standaard op MELDEN. Dat is geen halfheid maar een
   volgorde: weigeren aanzetten over 3706 routes zonder te weten welke grote
   krimpen legitiem zijn, breekt dingen die niemand terugvindt. TAKEN.md 4.62
   zegt dat de tand er pas in kan als die catalogus bestaat.

   Dit script bouwt hem. Het draait de suite met de grens op 1 -- dan meldt de
   begroting ELKE hervulling die meer dan een rij wegneemt -- en zet per
   collectie en per route bij elkaar wat er gebeurde.

   WAT DIT WEL IS: een lijst van de krimpen die de TOETSEN uitlokken, met de
   route erbij. Dat is genoeg om te zien welke collecties structureel groot
   krimpen en welke nooit.

   WAT DIT NIET IS, en dat hoort er hard bij:

   - GEEN PRODUCTIEVERKEER. De suite doet wat de toetsen doen, niet wat
     gebruikers doen. Een legitieme grote krimp die geen toets uitlokt, staat
     hier niet in. De catalogus is dus een ONDERGRENS: wat erin staat is echt,
     wat er niet in staat is niet bewezen afwezig.
   - GEEN OORDEEL. Dit script zegt niet of een krimp goed of fout is. Het zet
     neer wat er gebeurde; welke grens erbij hoort is een besluit van een mens.
   - ALLEEN HERVULLINGEN. Een splice of een wijziging binnen een rij komt hier
     niet voorbij, want de begroting ziet die ook niet (zie haar kop).

   DAAROM STAAT ER GEEN "VEILIG OM AAN TE ZETTEN" ONDER. Er staat: dit is wat de
   suite laat zien. Wie daarna weigeren aanzet, doet dat met dit getal in de hand
   en met de wetenschap wat het niet dekt.

   Draai:  node scripts/krimpronde.js              (draait de suite -- lang)
           node scripts/krimpronde.js --lees x.log (leest een bestaand log)
           node scripts/krimpronde.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'KRIMP.json');
const argv = process.argv.slice(2);
const VASTLEGGEN = argv.includes('--vastleggen');
const LEES = (argv.find(a => a.startsWith('--lees')) || '').split('=')[1] ||
  (argv.includes('--lees') ? argv[argv.indexOf('--lees') + 1] : null);

/* DE PROEF OP DE SOM: STOND DE VAL EIGENLIJK AAN?

   Dit is de tweede keer dat dit script op dezelfde steen viel, en de tweede keer
   was de ergste. Nul meldingen betekent twee dingen die niets met elkaar te
   maken hebben: er kromp niets, of de val stond niet aan. Hier stond, om die
   twee te scheiden:

       const zag = /begroting:/.test(tekst);

   en dat matchte in de eerste echte ronde op twee TOETSNAMEN:

       ok 5596 - begroting: een project kent zijn nulmeting, zijn uitgaven ...

   Een toets over een PROJECTbegroting. Dit script zou dus hebben gemeld "de
   begroting was aan het woord, maar geen enkele collectie kromp" over een ronde
   waarin server/opzet/begroting.js geen letter had geschreven -- de gevaarlijkste
   uitslag die hij kan geven, want hij leest als geruststelling (LAT.md regel 3:
   een meter zakt als zijn invoer ontbreekt, hij verzint hem niet).

   De oorzaak zat niet hier maar daar: er was niets dat alleen die module kon
   schrijven. Dus schrijft de wikkel nu bij zijn eerste installatie zelf een
   regel, met de grens waarop hij staat. Die regel is het bewijs, en de grens
   erin is het bewijs dat de ronde op de BEDOELDE grens draaide -- want een ronde
   met de standaardgrens van 1000 zegt niets over wat er boven de 1 gebeurt.

   DE MELDREGEL IN BEIDE VORMEN, en dat was de eerste steen.

   server/log.js schrijft JSON als RTG_LOG_JSON aanstaat en anders platte tekst:

     {"bericht":"begroting: zou zijn geweigerd","collectie":"leden","rijen":42}
     2026-.. WARN  begroting: zou zijn geweigerd {"collectie":"leden","rijen":42}

   De eerste versie hiervan eiste `"bericht":"..."` en zag dus ALLEEN de
   JSON-vorm. In de testmodus -- precies waar deze ronde draait -- schrijft het
   log platte tekst, dus dit script was daar blind. Een lege catalogus zou dan
   voor "er krimpt niets" zijn doorgegaan, en dat is de gevaarlijkste uitslag
   die hij kan geven (LAT.md regel 10).

   Nu wordt er op het BERICHT gezocht, dat in allebei de vormen letterlijk zo in
   de regel staat, en worden de velden er daarna uit gehaald. */
const REGEL = /begroting: (zou zijn geweigerd|handeling geweigerd)/;
const REGEL_C = /"collectie":"([^"]+)"/;
const REGEL_R = /"rijen":(\d+)/;
const REGEL_P = /"p":"([^"]*)"/;
/* Het levensteken. Alleen server/opzet/begroting.js schrijft deze woorden, en
   hij schrijft de grens erbij. */
const WAAKT = /begroting: waakt/;
const WAAKT_G = /"grens":(\d+)/;

function ontleed(tekst) {
  const perCollectie = new Map();
  const grenzen = new Map();
  let regels = 0, gewaakt = 0;
  for (const regel of String(tekst).split('\n')) {
    if (WAAKT.test(regel)) {
      gewaakt++;
      const gm = WAAKT_G.exec(regel);
      const g = gm ? Number(gm[1]) : -1;
      grenzen.set(g, (grenzen.get(g) || 0) + 1);
      continue;
    }
    if (!REGEL.test(regel)) continue;
    const cm = REGEL_C.exec(regel);
    const rm = REGEL_R.exec(regel);
    if (!cm || !rm) continue;   // een melding zonder velden zegt niets
    regels++;
    const collectie = cm[1];
    const rijen = Number(rm[1]);
    const pm = REGEL_P.exec(regel);
    const pad = pm ? pm[1] : '(onbekend)';
    const c = perCollectie.get(collectie) ||
      { collectie, keer: 0, grootste: 0, totaal: 0, paden: new Map() };
    c.keer++;
    c.totaal += rijen;
    if (rijen > c.grootste) c.grootste = rijen;
    c.paden.set(pad, Math.max(c.paden.get(pad) || 0, rijen));
    perCollectie.set(collectie, c);
  }
  const uit = [...perCollectie.values()]
    .map(c => ({ collectie: c.collectie, keer: c.keer, grootste: c.grootste,
      gemiddeld: Math.round(c.totaal / c.keer),
      paden: [...c.paden.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([pad, rijen]) => ({ pad, rijen })) }))
    .sort((a, b) => b.grootste - a.grootste);
  return { regels, gewaakt, grenzen: [...grenzen.entries()].sort((a, b) => a[0] - b[0]),
    collecties: uit };
}

function draaiSuite() {
  console.log('  de suite draait met RTG_BEGROTING_KRIMP=1 -- dit duurt lang.\n');
  const r = spawnSync(process.execPath, [path.join(WORTEL, 'scripts', 'test-runner.js')], {
    cwd: WORTEL, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024,
    env: { ...process.env, RTG_BEGROTING_KRIMP: '1', RTG_BEGROTING: 'melden' }
  });
  if (r.error) { console.error('  de ronde kon niet draaien: ' + r.error.message); process.exit(2); }
  return (r.stdout || '') + (r.stderr || '');
}

const tekst = LEES ? fs.readFileSync(LEES, 'utf8') : draaiSuite();
const uit = ontleed(tekst);

console.log('\n=== DE KRIMPRONDE ===\n');

/* GEEN LEVENSTEKEN IS GEEN UITSLAG. Zonder die regel is dit log geen bewijs dat
   er niets kromp, maar bewijs van niets. Zie de kop. */
if (!uit.gewaakt) {
  console.log('  GEEN ENKEL LEVENSTEKEN in dit log.\n');
  console.log('  Dat is GEEN uitslag "er krimpt niets" maar GEEN UITSLAG. De val stond niet');
  console.log('  aan, of geen enkel proces zette db.data (draai met RTG_BEGROTING_KRIMP=1),');
  console.log('  of het patroon in dit script loopt uit de pas met server/opzet/begroting.js.');
  process.exit(2);
}

console.log('  processen met de val aan    : ' + uit.gewaakt);
console.log('  grenzen die zij meldden     : ' +
  uit.grenzen.map(([g, n]) => g + ' (' + n + 'x)').join(', '));
console.log('  hervullingen boven de grens : ' + uit.regels);
console.log('  collecties die krimpen      : ' + uit.collecties.length + '\n');

/* EEN RONDE OP DE STANDAARDGRENS MEET NIETS. Draait de suite met 1000, dan zegt
   "nul meldingen" alleen dat er niets van meer dan duizend rijen wegging -- niet
   waar de catalogus om vraagt. Die vergissing is stil en lijkt op een uitslag. */
const laagste = uit.grenzen.length ? uit.grenzen[0][0] : -1;
if (laagste >= 1000) {
  console.log('  De val stond aan, maar op de STANDAARDGRENS (' + laagste + '). Deze ronde zegt dus');
  console.log('  niets over wat er tussen 1 en ' + laagste + ' rijen gebeurt, en dat is precies wat');
  console.log('  de catalogus nodig heeft. Draai met RTG_BEGROTING_KRIMP=1.\n');
  process.exit(2);
}

if (!uit.collecties.length) {
  console.log('  De begroting was aan het woord, maar GEEN ENKELE collectie kromp met meer');
  console.log('  dan een rij. Dat is een echte uitslag: op de paden die de toetsen raken,');
  console.log('  bestaat er geen massaverwijdering.\n');
} else {
  console.log('    rijen  keer  collectie');
  for (const c of uit.collecties) {
    console.log('  ' + String(c.grootste).padStart(7) + String(c.keer).padStart(6) + '  ' + c.collectie);
    for (const p of c.paden) console.log('                 ' + String(p.rijen).padStart(6) + '  ' + p.pad);
  }
  console.log();
}

const stand = {
  uitleg: 'Welke collecties krimpen tijdens de TOETSEN, en hoeveel. Bouwt de catalogus die ' +
    'TAKEN.md 4.62 nodig heeft voordat RTG_BEGROTING=weigeren aan kan. DRIE DINGEN DIE ERBIJ HOREN. ' +
    '(1) ONDERGRENS: de suite doet wat de toetsen doen, niet wat gebruikers doen -- een legitieme ' +
    'grote krimp die geen toets uitlokt, staat hier niet in. ' +
    '(2) EEN GRENS VAN 1 LAAT EEN RIJ DOOR. Een hervulling die precies een rij wegneemt komt er ' +
    'ongemeld doorheen, en dat is de vorm van bijna elke verwijdering in dit huis: ' +
    'db.data.X = X.filter(r => r.id !== id). Een gerichte proef met de grens op 0,5 over ' +
    'test/vergeten.test.js, test/media.test.js en test/techniek-sso-scim.test.js gaf OOK nul, dus ' +
    'op die paden ziet de val helemaal geen hervulling. De nul hierboven is daarmee net zo goed een ' +
    'uitspraak over wat de toetsen DOEN als over wat er krimpt -- en er is nog geen enkele toets die ' +
    'een ECHTE route de val ziet laten aanslaan; de dertien in test/begroting.test.js voeden de laag ' +
    'rechtstreeks. ' +
    '(3) GEEN OORDEEL: welke grens bij een collectie hoort, is een besluit van een mens.',
  hoe: 'node scripts/krimpronde.js',
  gemeten: { hervullingen: uit.regels, collecties: uit.collecties.length,
    grootste: uit.collecties.length ? uit.collecties[0].grootste : 0,
    processenGewaakt: uit.gewaakt, gemetenGrens: laagste },
  collecties: uit.collecties
};

if (VASTLEGGEN) {
  fs.writeFileSync(UITSLAG, JSON.stringify(stand, null, 2) + '\n');
  console.log('  vastgelegd in KRIMP.json\n');
}
process.exit(0);
