#!/usr/bin/env node
'use strict';
/* ============================================================================
   WAT KOST EEN CORRECTE VERANDERING?

   Niet "hoeveel werk is er verzet" -- dat is een gevoel -- maar: als je een
   verandering doorvoert die door alle poorten komt, waar ging het werk dan
   heen? De vraag erachter is de stuurmaat van dit huis:

     Verlaag niet de hoeveelheid zekerheid.
     Verlaag de hoeveelheid werk die nodig is om dezelfde of sterkere zekerheid
     te produceren.

   ==== GEMETEN EN VERKLAARD STAAN APART, EN WORDEN NOOIT OPGETELD ====

   Dit register heeft twee helften en die raken elkaar niet.

     `gemeten`    volgt uit git en uit twee bestaande registers. Reproduceerbaar,
                  en iedereen die de opdracht draait krijgt hetzelfde.
     `verklaard`  is een OORDEEL van een mens. Ontdekkingen -- defecten die
                  onderweg opdoken en die geen enkele toets zag -- horen daar,
                  want er is geen reproduceerbare detectieregel voor. Ze zijn
                  het WAARDEVOLSTE van een ronde en het minst meetbare, en juist
                  daarom mogen ze in geen enkele som terechtkomen. Een cijfer dat
                  half gemeten en half geschat is, leest als gemeten.

   `test/bewijskosten.test.js` handhaaft dat: geen enkel veld in `gemeten` mag
   uit `verklaard` zijn berekend.

   ==== DE VIER SOORTEN WERK, EN WAAROM PRECIES DEZE VIER ====

     intentie   de verandering zelf -- server/ en public/. Dit is waar de
                gebruiker iets van merkt.
     bewijs     de machinerie die aantoont dat hij klopt -- test/ en scripts/.
     afgeleid   artefacten die een GENERATOR heeft herschreven. AFGELEID.json
                wijst ze aan; geen mens heeft die regels getypt.
     document   handgeschreven .md in de wortel.
     overig     de rest (package.json, workflows).

   ==== DE VERSTERKINGSFACTOR, EN WAAROM ER TWEE ZIJN ====

   Eén regel bron sleept regels mee in de rest van de boom. Dat is op zichzelf
   geen probleem -- het is precies wat een huis vol meters hoort te doen. Het
   gaat erom WIE die regels schrijft:

     machineVersterking   afgeleide regels per bronregel. Een generator doet dit
                          in seconden. Deze mag gerust groeien.
     mensVersterking      afgeleide artefacten die bij een SAMENVOEGING in
                          conflict kwamen en waarvan de herbouw NIET bewezen is.
                          Precies die moest een mens met de hand samenvoegen, en
                          dan ontstaat er een waarheid die geen enkele bron heeft
                          geproduceerd. Deze hoort naar nul.

   Een versterkingsfactor over NUL bronregels is geen nul maar ONBEPAALD, en
   staat er dan ook als `null` met de reden (LAT.md regel 3). Daarom wordt hij
   over een BEREIK gerekend en niet per commit: een commit die alleen een
   register herschrijft heeft geen noemer.

   ==== DRIFT ====

   Werk dat ontstond doordat de grond bewoog en niet doordat iemand iets wilde.
   Meetbaar per samenvoeging, en deterministisch: `git merge-tree --write-tree
   --name-only` op de twee ouders geeft exact dezelfde conflictpaden als de
   samenvoeging destijds. Die paden worden gesplitst met AFGELEID.json (bron of
   afgeleid) en met HERBOUWPROEF.json (herbouwplicht of handwerk).

   Draai: node scripts/bewijskosten.js [<basis>..<top>] [--vastleggen]
   ========================================================================= */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { stempel, eisSchoneBoom } = require('./lib/stempel.js');

const WORTEL = path.join(__dirname, '..');
const UIT = path.join(WORTEL, 'BEWIJSKOSTEN.json');

/* DE NULMETING. De eerste commit van deze campagne die groen door de hele keten
   kwam (CI-ronde 4593). Hij staat hier als IJKPUNT en niet als grens: een
   latere ronde is pas duurder of goedkoper als je weet waartegen. */
const NULMETING = 'fcf44574';

function git(...args) {
  return execFileSync('git', args, { cwd: WORTEL, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/* ==== DE INDELING ====
   Wat er NIET gebeurt: raden. Een pad heet pas `afgeleid` als AFGELEID.json het
   zo noemt EN er een eigenaar bij staat -- dat register is de enige bron voor
   die vraag, en een tweede indeling ernaast zou binnen een maand uiteenlopen. */
function indeler() {
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'AFGELEID.json'), 'utf8'));
  const afgeleid = new Set(reg.artefacten
    .filter(r => (r.soort === 'AFGELEID' || r.soort === 'FRAGMENTEN') && r.eigenaar)
    .map(r => r.naam));
  return (pad) => {
    if (afgeleid.has(pad)) return 'afgeleid';
    if (pad.startsWith('test/')) return 'bewijs';
    if (pad.startsWith('scripts/')) return 'bewijs';
    if (pad.startsWith('server/') || pad.startsWith('public/')) return 'intentie';
    if (/^[^/]+\.md$/.test(pad)) return 'document';
    return 'overig';
  };
}

const KLASSEN = ['intentie', 'bewijs', 'afgeleid', 'document', 'overig'];

function omvangVan(bereik, deel) {
  const rauw = git('diff', '--numstat', bereik);
  const per = {};
  for (const k of KLASSEN) per[k] = { bestanden: 0, erbij: 0, eraf: 0 };
  for (const regel of rauw.split('\n')) {
    if (!regel.trim()) continue;
    const [erbij, eraf, pad] = regel.split('\t');
    /* Een binair bestand meldt `-` en geen getal. Dat als nul lezen zou een
       binaire wijziging gratis maken; het telt daarom wel als BESTAND en niet
       als regels, en dat verschil staat in de uitslag. */
    const k = per[deel(pad)];
    k.bestanden++;
    if (erbij !== '-') { k.erbij += Number(erbij); k.eraf += Number(eraf); }
  }
  return per;
}

/* ==== DRIFT: DE CONFLICTEN VAN ELKE SAMENVOEGING IN HET BEREIK ====
   `git merge-tree --write-tree` herspeelt de samenvoeging zonder de werkboom
   aan te raken en geeft dezelfde paden als destijds. */
function driftVan(bereik, deel, herbouwbaar) {
  const merges = git('log', '--merges', '--format=%H', bereik).split('\n').filter(Boolean);
  const uit = [];
  for (const m of merges) {
    const ouders = git('rev-parse', m + '^@').split('\n').filter(Boolean);
    if (ouders.length < 2) continue;
    /* EXITCODE 1 BETEKENT HIER "ER WAREN CONFLICTEN" EN NIET "ER GING IETS MIS".
       Dat kostte de eerste ronde precies de meting waar het om ging: execFileSync
       gooit op elke niet-nul uitgang, de vanger noteerde `conflicten: null`, en
       de uitslag las als `drift: 0 conflicten` -- terwijl de samenvoeging van 15
       september er negentien had. Een STILLE NUL waar een negentien hoorde, en
       hij zag er rustig uit. De uitvoer staat in dat geval gewoon in `e.stdout`;
       alleen een hogere exitcode (of geen stdout) is een echte storing.

       Dit is BM-B van BEWIJSMACHINE.md in een derde gedaante: niet een
       onleesbaar bestand dat als afwezig leest, maar een geslaagde meting die
       als een mislukte leest omdat het SEIN van de meting een foutcode is. */
    let rauw = '';
    try { rauw = git('merge-tree', '--write-tree', '--name-only', ouders[0], ouders[1]); }
    catch (e) {
      if (e.status === 1 && typeof e.stdout === 'string' && e.stdout.length) {
        rauw = e.stdout;
      } else {
        uit.push({ merge: m.slice(0, 8), conflicten: null,
          reden: 'git merge-tree kon deze samenvoeging niet herspelen (exitcode ' + e.status + '): ' +
            String(e.message).slice(0, 120) });
        continue;
      }
    }
    const regels = rauw.split('\n').slice(1);
    const paden = [];
    for (const r of regels) {
      if (!r.trim()) break;               // de lege regel scheidt paden van het verslag
      paden.push(r.trim());
    }
    const perPad = paden.map(p => {
      const soort = deel(p);
      return { pad: p, soort,
        /* `herbouwplicht` betekent: dit conflict had niemand met de hand hoeven
           oplossen. `onbewezen` is met opzet geen `handwerk` -- niet bewezen
           herbouwbaar is iets anders dan bewezen niet-herbouwbaar. */
        /* `handmatig` betekent hier: geen afgeleid artefact, dus een mens moest
           de inhoud samenvoegen. Dat is GEEN versterking -- het is werk aan echte
           inhoud. Versterking is dat EEN bronwijziging achttien afgeleide
           bestanden meesleept, en alleen die afgeleide kant hoort naar nul. */
        afhandeling: soort !== 'afgeleid' ? 'handmatig'
          : herbouwbaar.has(p) ? 'herbouwplicht' : 'onbewezen' };
    });
    uit.push({ merge: m.slice(0, 8), conflicten: perPad.length, paden: perPad });
  }
  return uit;
}

function herbouwbareSet() {
  try {
    const h = JSON.parse(fs.readFileSync(path.join(WORTEL, 'HERBOUWPROEF.json'), 'utf8'));
    return new Set((h.artefacten || [])
      .filter(r => r.uitslag === 'gelijk' || r.uitslag === 'alleenStempel')
      .map(r => r.naam));
  } catch (e) {
    /* ONLEESBAAR IS NIET AFWEZIG (BEWIJSMACHINE.md par. 6b). Een leeg stel hier
       zou elk conflict stil `onbewezen` maken -- een verslechtering die uit het
       niets komt. Dus stoppen, met de reden. */
    if (fs.existsSync(path.join(WORTEL, 'HERBOUWPROEF.json'))) {
      console.error('\n  HERBOUWPROEF.json bestaat en is onleesbaar (' + e.message + ').\n' +
        '  Zonder dat register is elk afgeleid conflict "onbewezen", en dat is een\n' +
        '  verslechtering die niet gemeten is maar verzonnen. Kijk er eerst naar.\n');
      process.exit(2);
    }
    return null;
  }
}

function meet(bereik) {
  const deel = indeler();
  const herbouwbaar = herbouwbareSet();
  const omvang = omvangVan(bereik, deel);
  const drift = driftVan(bereik, deel, herbouwbaar || new Set());

  const bronRegels = omvang.intentie.erbij + omvang.intentie.eraf;
  const afgeleideRegels = omvang.afgeleid.erbij + omvang.afgeleid.eraf;
  const bewijsRegels = omvang.bewijs.erbij + omvang.bewijs.eraf;

  const conflicten = drift.flatMap(m => m.paden || []);
  const handwerk = conflicten.filter(p => p.afhandeling === 'onbewezen').length;

  /* EEN FACTOR OVER NUL IS ONBEPAALD EN GEEN NUL. */
  const factor = (teller, noemer) => noemer > 0 ? Math.round(100 * teller / noemer) / 100 : null;

  return {
    bereik,
    commits: git('log', '--format=%H', bereik).split('\n').filter(Boolean).length,
    samenvoegingen: drift.length,
    omvang,
    bronRegels, bewijsRegels, afgeleideRegels,
    machineVersterking: factor(afgeleideRegels, bronRegels),
    bewijsVersterking: factor(bewijsRegels, bronRegels),
    versterkingOnbepaald: bronRegels === 0
      ? 'geen enkele regel in server/ of public/ in dit bereik; een factor zonder noemer is onbepaald en geen nul'
      : null,
    driftConflicten: conflicten.length,
    driftHandmatig: conflicten.filter(p => p.afhandeling === 'handmatig').length,
    driftHerbouwplicht: conflicten.filter(p => p.afhandeling === 'herbouwplicht').length,
    mensVersterking: handwerk,
    herbouwproefGelezen: herbouwbaar !== null,
    drift
  };
}

function main() {
  const args = process.argv.slice(2);
  const vastleggen = args.includes('--vastleggen');
  const losBereik = args.find(a => !a.startsWith('--'));
  const basis = git('merge-base', 'HEAD', 'origin/main').trim();
  const bereik = losBereik || (basis + '..HEAD');

  const nu = meet(bereik);
  let nul = null;
  try { nul = meet(basis + '..' + NULMETING); }
  catch (e) { nul = { bereik: basis + '..' + NULMETING, reden: 'de nulmeting is hier niet te herhalen: ' + String(e.message).slice(0, 120) }; }

  console.log('\nDE KOSTEN VAN EEN CORRECTE VERANDERING' +
    '\x1b[2m -- gemeten, en strikt gescheiden van wat verklaard is\x1b[0m\n');
  console.log('  bereik  ' + bereik + '  (' + nu.commits + ' commits, ' + nu.samenvoegingen + ' samenvoeging(en))\n');
  for (const k of KLASSEN) {
    const o = nu.omvang[k];
    console.log('  ' + k.padEnd(11) + String(o.bestanden).padStart(4) + ' bestand(en)  ' +
      String(o.erbij + o.eraf).padStart(7) + ' regel(s)');
  }
  console.log('\n  machineversterking  ' + (nu.machineVersterking === null ? 'ONBEPAALD' : nu.machineVersterking +
    ' afgeleide regel(s) per bronregel') + '\x1b[2m  (mag groeien: een generator schrijft ze)\x1b[0m');
  console.log('  bewijsversterking   ' + (nu.bewijsVersterking === null ? 'ONBEPAALD' : nu.bewijsVersterking +
    ' bewijsregel(s) per bronregel'));
  console.log('  MENSversterking     ' + nu.mensVersterking +
    ' afgeleid conflict(en) zonder bewezen herbouw\x1b[2m  (hoort nul te zijn)\x1b[0m');
  console.log('\n  drift: ' + nu.driftConflicten + ' conflict(en) -- ' + nu.driftHandmatig + ' in de bron, ' +
    nu.driftHerbouwplicht + ' herbouwplicht, ' + nu.mensVersterking + ' onbewezen');
  if (!nu.herbouwproefGelezen) console.log('  \x1b[33mHERBOUWPROEF.json bestaat nog niet; elk afgeleid conflict heet daarom onbewezen.\x1b[0m');

  if (vastleggen) {
    eisSchoneBoom('BEWIJSKOSTEN.json');
    /* WAT ER HIER NIET STAAT, EN WAAROM.

       `verklaard` draagt de ontdekkingen: defecten die onderweg opdoken en die
       geen enkele toets zag. Ze zijn het waardevolste van een ronde en het
       minst meetbare -- er is geen regel die ze uit git afleidt. Ze staan
       daarom in een EIGEN blok, buiten `gemeten`, en er wordt nergens mee
       gerekend. Een lijst die met de hand groeit hoort ook eerlijk te zeggen
       dat hij met de hand groeit. */
    fs.writeFileSync(UIT, JSON.stringify({
      stempel: stempel(),
      uitleg: 'Waar ging het werk heen bij een verandering die door alle poorten kwam? De helft ' +
        '`gemeten` volgt uit git, AFGELEID.json en HERBOUWPROEF.json. De helft `verklaard` is een ' +
        'oordeel van een mens en komt in geen enkele som voor.',
      grens: 'machineversterking en mensversterking worden nooit opgeteld: de eerste mag groeien ' +
        '(een generator schrijft die regels in seconden), de tweede hoort naar nul. Een ' +
        'versterkingsfactor over nul bronregels is ONBEPAALD en geen nul. En `onbewezen` is geen ' +
        '`handwerk`: niet bewezen herbouwbaar is iets anders dan bewezen niet-herbouwbaar.',
      gemeten: nu,
      nulmeting: { commit: NULMETING, waarom: 'de eerste commit van deze campagne die groen door de ' +
        'hele keten kwam (CI-ronde 4593); een latere ronde is pas duurder of goedkoper als je weet ' +
        'waartegen', gemeten: nul },
      verklaard: {
        waarom: 'ontdekkingen -- defecten die onderweg opdoken en die geen enkele toets zag -- hebben ' +
          'geen reproduceerbare detectieregel. Ze staan hier omdat ze ertoe doen, en NERGENS in een ' +
          'som omdat een half gemeten cijfer als gemeten leest.',
        hoeGroeitDit: 'met de hand, door wie de ronde draaide',
        ontdekkingen: []
      }
    }, null, 2) + '\n');
    console.log('\n  BEWIJSKOSTEN.json geschreven.\n');
  } else {
    console.log('\n  (niets vastgelegd -- voeg --vastleggen toe)\n');
  }
}

if (require.main === module) main();
module.exports = { meet, indeler, KLASSEN, NULMETING, UIT };
