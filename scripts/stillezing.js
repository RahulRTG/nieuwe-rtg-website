#!/usr/bin/env node
'use strict';
/* ============================================================================
   ONLEESBAAR IS NIET AFWEZIG -- de spiegel van scripts/stilspoor.js.

   DE REGEL. Bewijs- en gezagsinformatie kent DRIE toestanden en geen twee:

       BESTAAT + GELDIG     er staat iets, en het is te vertrouwen
       BESTAAT + ONGELDIG   er staat iets, en het is stuk
       BESTAAT NIET         er staat niets

   Wie de tweede op de derde laat vallen -- `catch (e) { return null }` -- maakt
   van een KAPOT register een LEEG register. En leeg betekent in dit huis bijna
   overal "geen beperking": geen besluit, geen grens, geen lopende ronde, geen
   schuld. Een gescheurde lezing wordt dan een vrijbrief. Dat is fail-open, en
   het ziet er in de bron uit als zorgvuldigheid.

   WAAR HIJ VANDAAN KOMT, en het was geen hypothese. `scripts/lib/afbouw-afloop.js`
   schreef zijn afloop met een kale writeFileSync -- niet atomair, dus er is een
   venster waarin het bestand WEL bestaat en NIET parseert. `lees()` gaf daar
   `null`, en `null` betekent in die laag "er loopt geen ronde": het slot dat
   een tweede bronmuterende ronde moet tegenhouden, ging open omdat het bewijs
   onleesbaar was. Gemeten met een schrijver en een lezer naast elkaar, drie
   seconden, op een afloop van de maat die die laag echt schrijft:

       oude schrijf    133.196 lezingen, 110.390 gescheurd
       nieuwe schrijf   34.480 lezingen,       0 gescheurd

   Die ene plek is gerepareerd (tmp + renameSync, 15 september 2026). De vraag
   die overbleef is of de vorm uniek was. Dit is de meting die dat beantwoordt.

   STILSPOOR EN STILLEZING ZIJN TWEE HELFTEN EN WORDEN NOOIT OPGETELD.
   STILSPOOR meet SCHRIJVERS wier falen wordt opgegeten: er hoort iets te staan
   en het staat er niet. STILLEZING meet LEZERS die onleesbaar in afwezig
   vertalen: er staat iets, en er wordt gedaan alsof niet. De eerste verliest
   bewijs, de tweede verliest het ONDERSCHEID -- en alleen de tweede kan een
   poort laten opengaan.

   ==== WAT HIJ MEET ====

     bewijslezingen   HET BEREIK. Hoeveel lezingen van een register of een
                      bewijsbestand deze meter uberhaupt vindt. Zonder dit getal
                      is een dalende schuld niet te onderscheiden van een meter
                      die blind wordt -- dezelfde reden als `spoorAanroepen`.
     smeltSamen       de schuld: de catch levert een PERMISSIEVE lege waarde
                      (null, {}, [], false, 0, undefined) of is helemaal leeg,
                      en er wordt niets gemeld. Onleesbaar wordt afwezig, stil.
     zegtHet          de catch valt terug EN meldt het. Dat is de vorm van
                      server/opzet/begrotingsgrenzen.js, die er met zoveel
                      woorden bij zegt waarom (LAT.md regel 5). Geen schuld,
                      maar ook geen onderscheid: de AANROEPER krijgt nog steeds
                      een lege waarde. Daarom apart geteld en niet weggestreept.
     onderscheidt     de catch levert een waarde die ONGELDIG betekent en niet
                      LEEG -- scripts/codewereld.js zet `as: 'ONLEESBAAR'` met
                      de reden erbij. Dit is de uitkomst die de regel vraagt.
     gooit            de catch gooit door: fail-closed. Ook goed.

   ==== TWEE WERELDEN, NOOIT EEN GETAL ====

   `server/` en `scripts/` dragen dezelfde vorm met een ANDER gevolg, dus ze
   worden apart geteld en nooit opgeteld:

     server/   een fail-open lezing kan een HANDELING doorlaten die had moeten
               worden tegengehouden. Dat raakt een gebruiker.
     scripts/  een fail-open lezing laat een METING liegen: de meter meldt
               "geen schuld" omdat hij de schuldlijst niet kon lezen. Dat raakt
               niemand vandaag en iedereen morgen, want er wordt op gestuurd.

   Deze meter betrapt zichzelf op die tweede: `besluiten()` in
   scripts/stilspoor.js doet precies dit, en de eerste versie van DIT bestand
   deed het ook. Dat staat er liever in dan naast.

   ==== DE GRAAD IS `vermoed`, EN DE ONDERGRENS WIJST DE GOEDE KANT OP ====

   De herkenning is lexicaal en daarmee onvolledig, op drie manieren die hier
   horen te staan:

     1. Een bewijslezing via een variabele (`const p = PAD; readFileSync(p)`)
        wordt alleen gevonden als de registernaam in dezelfde aanroep staat of
        via een `const` in hetzelfde bestand te herleiden is -- dezelfde
        ondergrens als scripts/lib/registereigenaar.js, en met opzet dezelfde,
        zodat de twee getallen naast elkaar te leggen zijn.
     2. Een lezer die zijn eigen `lees()` heeft en die elders wordt aangeroepen,
        telt EEN keer (bij de lezer) en niet bij elke aanroeper. Dat onderschat
        het BEREIK van een enkele smoring en nooit het aantal plekken.
     3. Wat een "permissieve lege waarde" is, wordt op de VORM bepaald en niet
        op de betekenis. Een catch die `{ standaard: 1000 }` teruggeeft heet
        hier `anders` en vraagt een mens.

   Voor een SCHULDmeter is een ondergrens de veilige kant: de werkelijke schuld
   is minstens dit. Maar hij maakt `bewijslezingen` onmisbaar -- wie de
   namenlijst stukmaakt, ziet de schuld dalen zonder dat er iets is gerepareerd.

   ==== DIT IS EEN TRIAGELIJST EN GEEN BESCHULDIGING ====

   Niet elke samensmelting is fout. Een register dat met opzet optioneel is
   (een besluitregister dat nog niet bestaat) HOORT leeg terug te geven als het
   er niet is -- alleen niet als het er wel is en stuk. Dat verschil kan deze
   meter niet zien, want hij leest de bron en niet de schijf. De vorm die
   daarbij hoort is een besluitregister naast de meting (zoals STILSPOORBESLUIT
   naast STILSPOOR): een plek waar staat waarom deze ene samensmelting de juiste
   keuze is. Dat bestand bestaat nog niet, en met opzet -- er is nog geen enkel
   besluit genomen, en een leeg besluitregister is een belofte die niemand heeft
   gedaan. Een besluit trekt nooit van `smeltSamen` af.

   Draaien:  npm run stillezing        (print)
             npm run stillezing:vast   (schrijft STILLEZING.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./lib/bron');
const { stempel, eisSchoneBoom } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'STILLEZING.json');
const vastleggen = process.argv.includes('--vastleggen');

/* WAT TELT ALS BEWIJS- OF GEZAGSSTATE.

   De wortelregisters zijn de harde kern: elk CAPS-bestand met .json in de
   wortel is per definitie een meting of een besluit waar dit huis op stuurt.
   Daarnaast een korte, uitgeschreven lijst bewijsbestanden die GEEN
   wortelregister zijn maar wel gezag dragen -- de afloop van het afbouwslot
   (de aanleiding van deze meter), de journalen en de sleutelbestanden. Wie er
   een toevoegt, verhoogt het bereik; dat is de bedoeling. */
const EXTRA = [
  'afloop.json', 'eigenaar.json', '.afbouw-slot', 'routejournaal', 'schermjournaal',
  'inzagelog', 'toetsduur', 'BEPROEVING', 'bouwstempel'
];

function wortelregisters() {
  return fs.readdirSync(WORTEL).filter(f => f.endsWith('.json') && !f.startsWith('package'));
}

function bestanden(map, uit) {
  let namen;
  try { namen = fs.readdirSync(map, { withFileTypes: true }); } catch (e) { return uit; }
  for (const e of namen) {
    const p = path.join(map, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'data') continue;
      bestanden(p, uit);
    } else if (e.name.endsWith('.js')) uit.push(p);
  }
  return uit;
}

/* Gebalanceerd, want een regex kan dit niet: `catch (e) { if (x) { } }` heeft
   twee sluiters en de eerste is de verkeerde. Woordelijk dezelfde vorm als in
   scripts/stilspoor.js -- een tweede lezer zou de vergelijking bederven. */
function blokVanaf(s, i) {
  let d = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return [i + 1, j]; }
  }
  return null;
}
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

/* Noemt dit stuk bron een bewijsbestand? Letterlijk of via een `const` in
   hetzelfde bestand -- de ondergrens uit de kop. */
function bewijsdoelen(stuk, constanten, registers) {
  const uit = new Set();
  for (const r of registers) if (stuk.includes(r)) uit.add(r);
  for (const e of EXTRA) if (stuk.includes(e)) uit.add(e);
  for (const [naam, waarde] of constanten) {
    if (!new RegExp('\\b' + naam + '\\b').test(stuk)) continue;
    for (const r of registers) if (waarde.includes(r)) uit.add(r);
    for (const e of EXTRA) if (waarde.includes(e)) uit.add(e);
  }
  return [...uit];
}

function constantenVan(code) {
  const uit = new Map();
  for (const m of code.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]{0,200})/g)) uit.set(m[1], m[2]);
  return uit;
}

/* DE INDELING VAN EEN VANGER. Op de VORM, niet op de betekenis -- zie de kop. */
const LEEG_TERUG = /\breturn\s*(?:null|undefined|false|0|\{\s*\}|\[\s*\])\s*[;}]|=\s*(?:null|\{\s*\}|\[\s*\])\s*[;}]/;
const MELDT = /\b(?:console|log|warn|error|meld|noteer|waarschuw|report)\b/i;
const GOOIT = /\bthrow\b/;

/* HET MERK DAT ONGELDIG ZEGT EN NIET LEEG. Dit is de uitkomst die de regel
   vraagt, en de eerste versie van deze meter kon hem NIET TOEKENNEN: `deelIn`
   had vier uitgangen en `onderscheidt` zat er niet bij, dus de meter meldde
   trots nul en dat was een eigenschap van de meter. scripts/codewereld.js doet
   het aantoonbaar wel (`as: 'ONLEESBAAR'`, met de reden erbij). Een instrument
   dat niet kan uitslaan is geen instrument -- vandaar deze tak, en vandaar de
   ijking onderaan dit bestand die eist dat elke uitgang bereikbaar is. */
const ONGELDIGMERK = /\b(?:ONLEESBAAR|ONGELDIG|STUK|CORRUPT|onleesbaar|ongeldig|corrupt)\b/;

function deelIn(lijf) {
  const kaal = lijf.trim();
  if (GOOIT.test(kaal)) return 'gooit';
  if (kaal === '') return 'smeltSamen';
  /* VOOR `zegtHet` en voor `LEEG_TERUG`: een vanger die het onderscheid
     vastlegt EN het meldt, is een onderscheider. Andersom leest een merk als
     ruis in een melding. */
  if (ONGELDIGMERK.test(kaal)) return 'onderscheidt';
  if (MELDT.test(kaal)) return 'zegtHet';
  if (LEEG_TERUG.test(kaal)) return 'smeltSamen';
  return 'anders';
}

/* DE IJKING VAN DEZE METER ZELF. Vijf uitgangen, vijf voorbeelden, en de meter
   moet ze alle vijf verschillend indelen. Zakt dit, dan meet hij minder dan hij
   belooft en is elk getal eronder een bewering over zijn eigen vorm. */
const IJKVOORBEELDEN = {
  gooit: 'throw e;',
  smeltSamen: 'return null;',
  onderscheidt: "uit.push({ as: 'ONLEESBAAR', reden: e.message });",
  zegtHet: "console.warn('register niet leesbaar'); ruw = {};",
  anders: 'ruw = { standaard: 1000 };'
};
function ijk() {
  const fout = [];
  for (const [verwacht, lijf] of Object.entries(IJKVOORBEELDEN)) {
    const kreeg = deelIn(lijf);
    if (kreeg !== verwacht) fout.push(verwacht + ' -> ' + kreeg);
  }
  return fout;
}

const LEEST = /\b(?:readFileSync|readFile|require)\s*\(/;
/* Dezelfde uitdrukking met /g, want matchAll eist een globale. Twee losse
   literals zouden uit elkaar lopen; deze wordt uit de eerste AFGELEID. */
const LEEST_G = new RegExp(LEEST.source, 'g');

function meet() {
  const registers = wortelregisters();
  const wereldVan = (p) => path.relative(WORTEL, p).startsWith('scripts') ? 'scripts' : 'server';
  const uit = { server: [], scripts: [] };
  const bereik = { server: 0, scripts: 0 };

  for (const map of ['server', 'scripts']) {
    for (const pad of bestanden(path.join(WORTEL, map), [])) {
      const ruw = fs.readFileSync(pad, 'utf8');
      /* `regelsHeel` SLAAT COMMENTAAR PLAT IN PLAATS VAN WEG: elk teken een
         spatie, elke regelovergang blijft staan. Daarmee zijn de regelnummers
         EN de tekenposities gelijk aan de echte bron, en is een treffer als
         bestand:regel terug te vinden. Zonder die stand wijst elk adres in dit
         register naar een regel die in het echte bestand iets anders is -- de
         eerste versie van deze meter deed dat, en het viel pas op doordat
         omkeerbaar.js:22 naar een commentaarblok wees.
         Voor de indeling verandert er niets: een leeg lijf met een toelichting
         wordt een lijf met spaties, en `trim()` maakt daar nog steeds '' van.
         Een commentaar maakt een samensmelting niet minder stil. */
      const code = zonderCommentaar(ruw, { regelsHeel: true });
      const constanten = constantenVan(code);
      const rel = path.relative(WORTEL, pad);
      const wereld = wereldVan(pad);

      /* HET BEREIK: elke lezing van een bewijsbestand, met of zonder vanger. */
      for (const m of code.matchAll(LEEST_G)) {
        const staart = code.slice(m.index, m.index + 200);
        if (bewijsdoelen(staart, constanten, registers).length) bereik[wereld]++;
      }

      for (const m of code.matchAll(/\bcatch\s*(?:\([^)]*\))?\s*\{/g)) {
        const opener = code.indexOf('{', m.index);
        const lijf = blokVanaf(code, opener);
        const tb = tryVoor(code, m.index);
        if (!lijf || !tb) continue;
        const tryLijf = code.slice(tb[0], tb[1]);
        if (!LEEST.test(tryLijf)) continue;
        const doelen = bewijsdoelen(tryLijf, constanten, registers);
        if (!doelen.length) continue;
        uit[wereld].push({
          bestand: rel,
          regel: regelVan(code, m.index),
          leest: doelen.sort(),
          soort: deelIn(code.slice(lijf[0], lijf[1]))
        });
      }
    }
  }
  return { uit, bereik };
}

function tel(lijst, soort) { return lijst.filter(r => r.soort === soort).length; }

function main() {
  const ijkfout = ijk();
  if (ijkfout.length) {
    console.error('\x1b[31mDE METER IS NIET GEIJKT: ' + ijkfout.join(', ') +
      '. Elk getal hieronder zou een bewering over deze meter zijn en niet over het huis.\x1b[0m');
    process.exitCode = 1;
    return;
  }
  const { uit, bereik } = meet();
  const K = { rood: '\x1b[31m', groen: '\x1b[32m', grijs: '\x1b[2m', vet: '\x1b[1m', reset: '\x1b[0m' };
  const gemeten = {};
  for (const w of ['server', 'scripts']) {
    gemeten[w] = {
      bewijslezingen: bereik[w],
      metVanger: uit[w].length,
      smeltSamen: tel(uit[w], 'smeltSamen'),
      zegtHet: tel(uit[w], 'zegtHet'),
      onderscheidt: tel(uit[w], 'onderscheidt'),
      gooit: tel(uit[w], 'gooit'),
      anders: tel(uit[w], 'anders')
    };
  }

  console.log('\n' + K.vet + 'ONLEESBAAR IS NIET AFWEZIG' + K.reset +
    K.grijs + '  -- lezers die een kapot bewijs als leeg bewijs behandelen' + K.reset + '\n');
  for (const w of ['server', 'scripts']) {
    const g = gemeten[w];
    console.log('  ' + K.vet + w + '/' + K.reset +
      K.grijs + (w === 'server' ? '   een fail-open lezing laat een HANDELING door' :
                                  '  een fail-open lezing laat een METING liegen') + K.reset);
    console.log('     bereik (bewijslezingen)   ' + g.bewijslezingen);
    console.log('     met een vanger eromheen   ' + g.metVanger);
    console.log('     ' + (g.smeltSamen ? K.rood : K.groen) + 'smelt samen (schuld)      ' +
      g.smeltSamen + K.reset);
    console.log('     zegt het erbij            ' + g.zegtHet);
    console.log('     onderscheidt ongeldig     ' + g.onderscheidt);
    console.log('     gooit door (fail-closed)  ' + g.gooit);
    console.log('     anders (vraagt een mens)  ' + g.anders + '\n');
  }

  console.log(K.grijs + '  De tien zwaarste samensmeltingen, per register:' + K.reset);
  const alles = [...uit.server.map(r => ({ ...r, wereld: 'server' })),
                 ...uit.scripts.map(r => ({ ...r, wereld: 'scripts' }))]
    .filter(r => r.soort === 'smeltSamen');
  for (const r of alles.slice(0, 10)) {
    console.log('    ' + (r.bestand + ':' + r.regel).padEnd(52) + r.leest.join(', ').slice(0, 60));
  }
  console.log('');

  if (vastleggen) {
    eisSchoneBoom('scripts/stillezing.js');
    fs.writeFileSync(DOEL, JSON.stringify({
      soort: 'meting',
      uitleg: 'Lezers van bewijs- en gezagsstate die een ONLEESBAAR bestand als een AFWEZIG bestand ' +
        'behandelen. Bewijs kent drie toestanden (bestaat+geldig, bestaat+ongeldig, bestaat niet) en ' +
        'een catch die op null valt, maakt van de tweede de derde -- en leeg betekent in dit huis bijna ' +
        'overal "geen beperking". De spiegel van STILSPOOR.json: die meet schrijvers wier falen wordt ' +
        'opgegeten, deze meet lezers die het onderscheid verliezen. Nooit optellen.',
      grens: 'Lexicaal, dus een ONDERGRENS: de werkelijke schuld is minstens dit. server/ en scripts/ ' +
        'worden nooit opgeteld -- daar staat een handeling tegenover een meting. `smeltSamen` mag ' +
        'alleen dalen, `bewijslezingen` alleen stijgen: een schuld die daalt doordat de meter blind ' +
        'wordt, is de gevaarlijkste vorm van vooruitgang.',
      stempel: stempel('scripts/stillezing.js'),
      gemeten,
      plekken: { server: uit.server, scripts: uit.scripts }
    }, null, 1) + '\n');
    console.log('  STILLEZING.json geschreven.\n');
  } else {
    console.log(K.grijs + '  (niets weggeschreven -- draai met --vastleggen)' + K.reset + '\n');
  }
}

if (require.main === module) main();
module.exports = { meet, deelIn, ijk, IJKVOORBEELDEN };
