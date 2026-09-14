#!/usr/bin/env node
'use strict';
/* ============================================================================
   HET SPOOR DAT NIET KAN WEIGEREN -- de handhaver bij LAT.md regel 18.

   DE REGEL: "Een belofte over een spoor is pas een regel als het spoor kan
   weigeren." Dit huis belooft op tientallen plekken dat er iets wordt
   vastgelegd -- wie in een dossier keek, welk besluit er viel, wat er is
   weggeschreven. Zo'n belofte is pas een regel als de schrijfactie de handeling
   kan TEGENHOUDEN. Kan zij dat niet, dan is de belofte een voornemen met een
   nette naam, en de handeling gaat gewoon door terwijl het spoor ontbreekt.

   WAAR HIJ VANDAAN KOMT. `server/inzagelog.js` gaf `noteer()` een uitslag terug
   die geen van de 42 aanroepende bestanden las, en het wegschrijven zat in een
   lege `catch`. Zonder database schreef hij in een weggegooide array en meldde
   succes: de inzage ging door terwijl het spoor niet bestond. Dat is op 13
   september 2026 gerepareerd (`noteerVast()` + `kern/ledenbalie-inzage.js`), en
   de vraag die daarna overbleef is of die vorm uniek was. Hij is dat niet.

   WAT HIJ MEET -- drie getallen, en ze zeggen niet hetzelfde:

     spoorGesmoord   een SPOOR-schrijver (journaal, inzagelog, auditlog) staat
                     in een `try` waarvan de `catch` het falen volledig opeet.
                     Dit is de klasse die de regel noemt.
     opslagGesmoord  een OPSLAG-schrijver (save, bewaar, flush) in dezelfde
                     vorm. Zelfde faalvorm, andere belofte: daar verdwijnt geen
                     spoor maar het gegeven zelf, en de aanroeper meldt succes.
     spoorAanroepen  het BEREIK: hoeveel spoor-schrijvers deze meter uberhaupt
                     vindt. Zonder dat getal is een dalende schuld niet te
                     onderscheiden van een meter die blind wordt.

   DE GRAAD IS `vermoed`, EN DE ONDERGRENS WIJST DE GOEDE KANT OP. De
   herkenning is lexicaal: een spoor-schrijver onder een naam die hier niet
   staat, wordt gemist. Voor een SCHULDmeter betekent dat een ondergrens -- de
   werkelijke schuld is minstens dit, nooit minder. Dat is de veilige kant, maar
   hij maakt het bereikgetal onmisbaar: wie de namenlijst stukmaakt, ziet de
   schuld dalen zonder dat er iets is gerepareerd.

   DIT IS EEN TRIAGELIJST EN GEEN BESCHULDIGING. Een gesmoorde schrijfactie is
   niet altijd fout. `server/log.js` vangt `noteerFout` -- een logger die zelf
   gooit terwijl hij een fout wegschrijft, maskeert de oorspronkelijke fout, en
   dat is erger. En `kern/envelop.js` zegt met zoveel woorden dat de LEVERING
   voorgaat: een geweigerde actor houdt een melding nooit tegen. De vorm die
   daarbij hoort is het BESLUITREGISTER naast de meting (zoals HERREKENBAAR.json
   naast FAALPROEF.json): een plek waar staat waarom deze ene smoring de juiste
   keuze is. Dat register bestaat nog niet, en met opzet -- er is nog geen enkel
   besluit genomen, en een leeg besluitregister is een belofte die niemand heeft
   gedaan. De haak ligt er wel (STILSPOORBESLUIT.json); wie het eerste besluit
   neemt, schrijft het bestand en de telling splitst vanzelf. Een besluit trekt
   nooit van `spoorGesmoord` af -- dezelfde afspraak als bij `gezaktMetBesluit`.

   CODE EN COMMENTAAR WORDEN GESCHEIDEN, en hier zit het scherpst van deze
   meter. Na `zonderCommentaar()` is `catch (e) { /* mag falen *\/ }` een LEGE
   vanger, en dat is geen tekortkoming maar het punt: een toelichting maakt een
   smoring niet minder stil. Wie de bron ruw zou lezen, zou juist de best
   toegelichte smoringen als "afgehandeld" tellen.

   WAAROM DIT GETAL AFWIJKT VAN DE 468 UIT DE EERSTE SCHATTING. Die telling was
   een grep over `catch` met een lege body op EEN regel. Deze meter leest het
   lijf gebalanceerd (dus ook over meerdere regels), loopt de hele boom af en
   telt een commentaar-only lijf als leeg. Het zijn twee verschillende
   metingen en ze horen niet te worden opgeteld of vergeleken.

   Draaien:  npm run stilspoor        (print)
             npm run stilspoor:vast   (schrijft STILSPOOR.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./lib/bron');
const { stempel, eisSchoneBoom } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'STILSPOOR.json');
const BESLUITEN = path.join(WORTEL, 'STILSPOORBESLUIT.json');

/* DE SPOOR-SCHRIJVERS VAN DIT HUIS. Afgeleid uit de modules die een journaal
   BIJHOUDEN: server/inzagelog.js, kern/doorgeefjournaal.js, opzet/routelog,
   kern/command/journaal, en de losse `noteer*`-familie. Wie een nieuwe naam
   introduceert valt buiten deze meter -- vandaar de ondergrens in de kop, en
   vandaar dat `spoorAanroepen` als tand meeloopt. */
const SPOOR = /\b(?:inzagelog|journaal|doorgeefjournaal|auditlog|routelog|schaduw\(\))\s*\.\s*(?:noteer|schrijf|log)\w*\s*\(|\bnoteer[A-Z]?\w*\s*\(/;
/* DE OPSLAG-SCHRIJVERS. `save()` is de huisvorm; `bewaar`, `flush` en
   `persist` zijn de varianten die in de bron voorkomen. `duurzaam*` staat
   erbij omdat db/duurzaam.js juist de weg is die WEL kan weigeren -- een
   gesmoorde duurzame schrijfactie gooit die garantie weg. */
const OPSLAG = /\b(?:save|bewaar|flush|persist|duurzaam\w*)\s*\(/;

function bestanden(map, uit) {
  let namen;
  try { namen = fs.readdirSync(map, { withFileTypes: true }); } catch (e) { return uit; }
  for (const e of namen) {
    const p = path.join(map, e.name);
    if (e.isDirectory()) {
      /* `data/` is de runtime-opslag en `node_modules` niet van ons. */
      if (e.name === 'node_modules' || e.name === 'data') continue;
      bestanden(p, uit);
    } else if (e.name.endsWith('.js')) uit.push(p);
  }
  return uit;
}

/* Het lijf van een blok dat op `i` opent, gebalanceerd geteld. Een regex kan
   dit niet: `catch (e) { if (x) { } }` heeft twee sluiters en de eerste is de
   verkeerde. */
function blokVanaf(s, i) {
  let d = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return [i + 1, j]; }
  }
  return null;
}

/* Het `try`-lijf dat bij deze `catch` hoort: terug naar de `}` ervoor en van
   daar gebalanceerd terug naar de opener. */
function tryVoor(s, catchIdx) {
  let j = catchIdx - 1;
  while (j >= 0 && /\s/.test(s[j])) j--;
  if (s[j] !== '}') return null;
  let d = 0;
  for (let k = j; k >= 0; k--) {
    const c = s[k];
    if (c === '}') d++;
    else if (c === '{') { d--; if (d === 0) return [k + 1, j]; }
  }
  return null;
}

function regelVan(s, i) { return s.slice(0, i).split('\n').length; }

function besluiten() {
  try { return JSON.parse(fs.readFileSync(BESLUITEN, 'utf8')).plekken || {}; } catch (e) { return {}; }
}

function main() {
  const lijst = bestanden(path.join(WORTEL, 'server'), []);
  const reg = besluiten();
  let vangers = 0, leegVangers = 0, spoorAanroepen = 0, opslagAanroepen = 0;
  const spoor = [], opslag = [];

  for (const f of lijst) {
    let ruw;
    try { ruw = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    /* `regelsHeel` IS HIER GEEN DETAIL. zonderCommentaar() plet een blok-
       commentaar standaard tot EEN spatie, en dan verschuift elk regelnummer
       erna. De eerste versie van deze meter wees daardoor naar regels die in
       het echte bestand iets anders bevatten -- een uitslag die er geldig
       uitziet uit een verkeerd ingerichte proef (BEWIJSMACHINE.md par. 6a),
       en juist hier, in de handhaver van een regel over stille fouten. */
    const s = zonderCommentaar(ruw, { regelsHeel: true });
    const rel = path.relative(WORTEL, f);
    /* Het BEREIK telt de aanroepen in de hele bron, niet alleen de gesmoorde.
       Een meter die stil minder spoor-schrijvers ziet, meldt dezelfde lage
       schuld over minder bewijs. */
    const globSpoor = new RegExp(SPOOR.source, 'g');
    const globOpslag = new RegExp(OPSLAG.source, 'g');
    spoorAanroepen += (s.match(globSpoor) || []).length;
    opslagAanroepen += (s.match(globOpslag) || []).length;

    const re = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;
    let m;
    while ((m = re.exec(s))) {
      vangers++;
      const open = s.indexOf('{', m.index + 5);
      const b = blokVanaf(s, open);
      if (!b) continue;
      if (s.slice(b[0], b[1]).trim() !== '') continue;
      leegVangers++;
      const t = tryVoor(s, m.index);
      if (!t) continue;
      const lijf = s.slice(t[0], t[1]);
      const plek = rel + ':' + regelVan(s, m.index);
      const rij = { plek, lijf: lijf.trim().replace(/\s+/g, ' ').slice(0, 140) };
      const b2 = reg[plek];
      if (b2) rij.besluit = { grond: b2.grond, besloten: b2.besloten };
      if (SPOOR.test(lijf)) spoor.push(rij);
      else if (OPSLAG.test(lijf)) opslag.push(rij);
    }
  }

  return {
    soort: 'meting',
    uitleg: 'Schrijfacties waarvan het falen volledig wordt weggevangen, terwijl de aanroeper ' +
      'daarna succes meldt. De klasse van LAT.md regel 18: een belofte over een spoor is pas een ' +
      'regel als het spoor kan weigeren.',
    grens: 'Deze meting toont NIET aan dat een gesmoorde schrijfactie fout is -- server/log.js en ' +
      'kern/envelop.js smoren met reden. Het is een triagelijst, geen oordeel. Zij toont ook niet ' +
      'aan dat dit alle gevallen zijn: de herkenning van een spoor- of opslagschrijver is lexicaal, ' +
      'dus dit is een ONDERGRENS op de schuld. En zij zegt niets over aanroepers die de uitslag van ' +
      'een schrijfactie negeren zonder try/catch -- dat is dezelfde faalvorm zonder dit kenmerk.',
    graad: 'vermoed',
    gemeten: {
      bestanden: lijst.length,
      vangers,
      leegVangers,
      spoorAanroepen,
      opslagAanroepen,
      spoorGesmoord: spoor.length,
      opslagGesmoord: opslag.length,
      /* NAAST DE TELLING EN ER NOOIT VANAF. Zelfde afspraak als
         `gezaktMetBesluit` in FAALPROEF.json: een verklaring is een besluit en
         geen reparatie. Wie het besluit van de meting aftrekt, kan het verschil
         tussen "opgelost" en "goedgepraat" niet meer zien. */
      spoorGesmoordMetBesluit: spoor.filter(r => r.besluit).length,
      opslagGesmoordMetBesluit: opslag.filter(r => r.besluit).length
    },
    spoor,
    opslag
  };
}

function toon(stand) {
  const g = stand.gemeten;
  console.log('\nHET SPOOR DAT NIET KAN WEIGEREN -- LAT.md regel 18\n');
  console.log('  ' + g.bestanden + ' bronbestanden, ' + g.vangers + ' catch-blokken, ' +
    g.leegVangers + ' daarvan leeg');
  console.log('  SPOOR : ' + g.spoorGesmoord + ' gesmoord van ' + g.spoorAanroepen + ' aanroepen' +
    (g.spoorGesmoordMetBesluit ? ' (' + g.spoorGesmoordMetBesluit + ' met besluit)' : ''));
  console.log('  OPSLAG: ' + g.opslagGesmoord + ' gesmoord van ' + g.opslagAanroepen + ' aanroepen' +
    (g.opslagGesmoordMetBesluit ? ' (' + g.opslagGesmoordMetBesluit + ' met besluit)' : ''));
  console.log('\n  --- het spoor ---');
  for (const r of stand.spoor) console.log('    ' + r.plek + (r.besluit ? '   [besluit]' : ''));
  console.log('\n  --- de opslag ---');
  for (const r of stand.opslag) console.log('    ' + r.plek + (r.besluit ? '   [besluit]' : ''));
  console.log('\n  graad: ' + stand.graad + ' -- lexicaal herkend, dus een ONDERGRENS op de schuld.\n');
}

/* NIET UITVOEREN BIJ HET REQUIREN (meetkeuring, regel `wacht`). Een laadcontrole
   zou anders de meting draaien, en met --vastleggen in argv het register
   overschrijven. */
if (require.main === module) {
  const stand = main();
  if (process.argv.includes('--vastleggen')) {
    const poort = eisSchoneBoom('stilspoor');
    if (!poort.ok) { console.error('[stilspoor] ' + poort.reden); process.exit(2); }
    fs.writeFileSync(DOEL, JSON.stringify(Object.assign({ stempel: stempel() }, main()), null, 2) + '\n');
    console.log('STILSPOOR.json geschreven.');
  }
  toon(stand);
}

module.exports = { meet: main };
