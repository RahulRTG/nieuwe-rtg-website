#!/usr/bin/env node
'use strict';
/* ============================================================================
   WANNEER SCHRIJFT EEN METER REPO-WAARHEID DIE NIEMAND HEEFT GEVRAAGD?

   DE AANLEIDING IS EEN ECHT INCIDENT, en het is hier gemaakt (15 september
   2026). `npm run ci:lokaal` draaide op de achtergrond terwijl de boom vuil
   was. Dat commando leest niet alleen, het SCHRIJFT registers -- en een ervan,
   ROLRONDE.json, kwam er met `boomVuil: true` uit. Een `git add -A` veegde hem
   mee de commit in. Het resultaat is een register dat zegt "dit is gemeten op
   commit X" terwijl het gemeten is op iets wat nergens staat, en dat is precies
   het soort stilte waar scripts/lib/stempel.js voor is gebouwd.

   BEWIJSMACHINE.md par. 6a zegt het algemener: een proef kan een geldige uitslag
   geven en toch het verkeerde experiment zijn geweest. Hier is het scherper: een
   register kan een geldige VORM hebben (stempel, commit, graad) en toch geen
   bewijs zijn, want de commit waar het naar wijst bevat de code niet waarop het
   gemeten is.

   ================== WAAROM EERST METEN EN NIET REPAREREN ==================

   METERKLASSE.json telt al hoeveel generatoren stempelen en hoeveel er
   grendelen, en op grond daarvan zou de reflex zijn: zet `eisSchoneBoom()` op
   alle stempelaars. Dat is fout, en het staat ook in de grens van die meter:
   worktree-lokale uitvoer HOORT die grendel niet te hebben. Een grendel overal
   opzetten maakt een halve dagtaak stuk en lost het incident niet op, want het
   incident ging niet over de grendel maar over het MOMENT: een schrijver die
   meeliep in een commando dat de mens als CONTROLE las.

   Dus eerst de klassen, dan pas een invariant, dan pas een mechanisme.

   ================== DE VIJF KLASSEN, EN DE VOLGORDE ==================

   Ze sluiten elkaar uit doordat ze in DEZE volgorde worden toegepast; zonder
   een volgorde zijn het eigenschappen en geen klassen, en telt een script mee
   in drie bakken tegelijk.

     1. SCHONE_BOOM_VEREIST         stempelt EN roept eisSchoneBoom() aan.
                                    Veilig door constructie: hij weigert.
     2. KAN_COMMITBEWIJS_ONGELDIG_MAKEN
                                    stempelt, grendelt NIET, en schrijft zonder
                                    dat iemand erom vroeg (geen vlag). Dit is de
                                    klasse van het incident.
     3. VUILE_BOOM_TOEGESTAAN       stempelt, grendelt niet, maar schrijft alleen
                                    achter een uitdrukkelijke vlag. Een mens die
                                    `--vastleggen` typt op een vuile boom neemt
                                    een besluit; dat is iets anders dan een
                                    schrijver die meelift.
     4. SCHRIJFT_AFGELEID_REGISTER  schrijft wel, stempelt niet. Geen claim op
                                    repo-waarheid, dus ook geen bewijs dat
                                    ongeldig kan worden.
     5. ONBEKEND                    de schrijfweg of de aanleiding is statisch
                                    niet te volgen. Een eerlijke bak, en de enige
                                    die omlaag hoort.

   ================== WAT DEZE METER NIET DOET ==================

   Oordelen. Klasse 2 is een WERKLIJST en geen aanklacht: een generator die
   alleen in zijn eigen worktree schrijft hoort daar mogelijk gewoon in thuis.
   Wat de klasse zegt is dat er vandaag bij die scripts geen enkel mechanisme is
   dat het incident tegenhoudt, en dat is iets anders dan dat ze het veroorzaken.

   Hij velt ook geen oordeel over of een grendel WERKT -- alleen of hij er staat.
   Beide tellingen zijn lexicaal en dus een ONDERgrens.

   Draaien:  npm run stempelveiligheid
             npm run stempelveiligheid:vast
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');
const { zonderCommentaar, zonderTekst } = require('./lib/bron');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'STEMPELVEILIGHEID.json');
const MAP = path.join(__dirname);

/* De commando's waarvan een mens verwacht dat ze LEZEN. Wie hier meelift,
   schrijft repo-waarheid terwijl de mens dacht dat hij een oordeel opvroeg.
   Een gesloten lijst, want dit is een oordeel over verwachting en geen patroon. */
const POORTEN = ['ci:lokaal', 'check', 'norm', 'test', 'registerklopt', 'golive', 'keuring', 'versheid'];

/* ---------- de npm-graaf ----------
   Welke npm-scripts leiden (ook via andere npm-scripts) tot dit bestand? Een
   script dat alleen via `:vast` bereikbaar is, is iets anders dan een script dat
   in `ci:lokaal` meeloopt. */
function npmGraaf() {
  const s = require(path.join(WORTEL, 'package.json')).scripts || {};
  const directeBestanden = {};
  const roeptScript = {};
  for (const [naam, lijf] of Object.entries(s)) {
    directeBestanden[naam] = [...String(lijf).matchAll(/scripts\/([a-z0-9_.-]+\.js)/gi)].map(m => m[1]);
    /* `npm run X` en `npm-run-all X Y` binnen een scriptlijf. */
    roeptScript[naam] = [...String(lijf).matchAll(/npm(?:\s+run)?\s+([a-z0-9:_-]+)/gi)]
      .map(m => m[1]).filter(x => s[x] && x !== naam);
  }
  /* Transitief: welke bestanden raakt een npm-script uiteindelijk? */
  const bestandenVan = (naam, gezien = new Set()) => {
    if (gezien.has(naam)) return [];
    gezien.add(naam);
    const uit = [...(directeBestanden[naam] || [])];
    for (const k of (roeptScript[naam] || [])) uit.push(...bestandenVan(k, gezien));
    return uit;
  };
  const perBestand = {};
  for (const naam of Object.keys(s)) {
    for (const b of new Set(bestandenVan(naam))) {
      (perBestand[b] = perBestand[b] || []).push(naam);
    }
  }

  /* EN DE WERKSTROMEN, want package.json is niet de hele waarheid. Dat is geen
     bijvangst maar de reden dat deze uitbreiding er is: de eerste versie van
     deze meter vond scripts/rolronde.js WEL in de risicoklasse maar NIET in de
     doorsnede -- terwijl dat het script is dat het incident veroorzaakte.
     scripts/ci-lokaal.js leidt zijn poorten namelijk af uit .github/workflows en
     start ze met spawnSync; in package.json staat die verwijzing nergens. Een
     doorsnede die juist het geval mist waarvoor hij is gebouwd, is geen
     instrument (BEWIJSMACHINE.md par. 6a). */
  const wf = path.join(WORTEL, '.github', 'workflows');
  let werkstromen = 0;
  try {
    for (const bestand of fs.readdirSync(wf).filter(n => /\.ya?ml$/.test(n))) {
      werkstromen++;
      const tekst = fs.readFileSync(path.join(wf, bestand), 'utf8');
      const raak = new Set();
      for (const m of tekst.matchAll(/scripts\/([a-z0-9_.-]+\.js)/gi)) raak.add(m[1]);
      /* Een werkstroom die `npm run X` draait, raakt alles wat X raakt. */
      for (const m of tekst.matchAll(/npm\s+run\s+([a-z0-9:_-]+)/gi)) {
        if (s[m[1]]) for (const b of bestandenVan(m[1])) raak.add(b);
      }
      for (const b of raak) (perBestand[b] = perBestand[b] || []).push('werkstroom:' + bestand);
    }
  } catch (e) { /* geen werkstromen: dan blijft de npm-graaf over, en dat staat in de grens */ }

  return { perBestand, scripts: Object.keys(s).length, werkstromen };
}

/* Schrijft dit script alleen achter een uitdrukkelijke vlag? Gemeten op de
   CODE zonder commentaar -- deze meter leidt semantiek af uit de vorm van code,
   en hoort dus zelf bij de 14 uit METERKLASSE.json die scheiden. */
/* EEN SCHRIJFPLEK IS EEN AANROEP, GEEN VOORKOMEN VAN HET WOORD. Deze meter had
   die fout zelf: scripts/bewijsladder.js is een meter OVER writeFileSync en
   draagt de regex `/writeFileSync\(\s*([^,]+),/g`. Dat werd geteld als een
   ongegrendelde schrijfplek, waarmee een script dat keurig achter --vastleggen
   schrijft in de risicoklasse belandde.

   Het is precies de klasse die METERKLASSE.md beschrijft: semantiek afleiden uit
   de VORM van code, en door de vorm worden beetgenomen. Vandaar tekst eruit met
   zonderTekst() (die vervangt door spaties, zodat regelnummers blijven kloppen)
   en een aanroepvorm die een regexliteraal uitsluit. */
const SCHRIJFAANROEP = /\bfs\s*\.\s*writeFileSync\s*\(|(?<![/\w.])writeFileSync\s*\(/;

function opVerzoek(code) {
  /* De huisvorm: `if (process.argv.includes('--vastleggen')) { ...writeFileSync }`.
     Hij wordt niet met een regex over het hele bestand gezocht maar per
     schrijfplek: een vlag ERGENS in het bestand zegt niets over of DEZE
     schrijfregel eronder hangt. */
  /* TWEE BEELDEN VAN DEZELFDE REGELS, en ze zijn allebei nodig. De AANROEP wordt
     gezocht in de code ZONDER tekst (anders telt een regexliteraal mee); de VLAG
     juist MET tekst, want die vlag IS een tekst -- `argv.includes('--vastleggen')`.
     Dit is in dit bestand fout gegaan: eerst tekst eruit gehaald voor de aanroep
     en daarna in diezelfde regels naar de vlag gezocht, waarmee 17 scripts uit
     VUILE_BOOM_TOEGESTAAN naar de risicoklasse verhuisden zonder dat er een
     letter aan die scripts veranderde. zonderTekst() vervangt door spaties, dus
     de regelnummers van beide beelden lopen gelijk. */
  const zicht = zonderTekst(code).split('\n');
  const regels = code.split('\n');
  const schrijfregels = zicht.map((r, i) => ({ r, i })).filter(x => SCHRIJFAANROEP.test(x.r));
  if (!schrijfregels.length) return { alle: false, plekken: 0, achterVlag: 0 };
  let achter = 0;
  for (const { i } of schrijfregels) {
    /* Kijk twintig regels terug naar een vlagcontrole, en stop bij een regel die
       een nieuwe functie opent -- dan hoort de vlag bij iets anders. */
    let vlag = false;
    for (let j = i; j >= Math.max(0, i - 20); j--) {
      if (/argv\s*\.\s*includes\s*\(\s*['"]--(vast|vastleggen|schrijf|write)/.test(regels[j]) ||
          /\b(vastleggen|vast|schrijven)\b\s*(&&|\))/.test(regels[j])) { vlag = true; break; }
      if (j < i && /^\s*(function|const .*=>\s*{)/.test(regels[j])) break;
    }
    if (vlag) achter++;
  }
  return { alle: achter === schrijfregels.length, plekken: schrijfregels.length, achterVlag: achter };
}

function meet() {
  const { perBestand, scripts, werkstromen } = npmGraaf();
  const namen = fs.readdirSync(MAP).filter(n => n.endsWith('.js')).sort();
  const rijen = [];

  for (const naam of namen) {
    let code;
    try { code = zonderCommentaar(fs.readFileSync(path.join(MAP, naam), 'utf8')); } catch (e) { continue; }
    if (!SCHRIJFAANROEP.test(zonderTekst(code))) continue;

    /* DRIE KEER DEZELFDE BLINDHEID, DRIE KEER EEN ANDERE RICHTING -- en alle
       drie in dit bestand, terwijl het over precies dit onderwerp gaat. Eerst
       telde een REGEX op `writeFileSync` als schrijfplek (vals alarm), toen
       maakte het weghalen van tekst de VLAG onzichtbaar (ook vals alarm), en
       hier keurde deze meter ZICHZELF goed: de zin 'roept eisSchoneBoom() aan'
       hierboven staat in een STRING, en zonderCommentaar() haalt strings niet
       weg. Een script kon de risicoklasse dus ontlopen door het woord ergens te
       noemen -- een vals VEILIG, en dat is de gevaarlijkste van de drie.

       De grendel wordt daarom gezocht als AANROEP in de code zonder tekst. Het
       stempel juist met tekst: dat is een require-PAD en dus per se een string. */
    const zichtbaar = zonderTekst(code);
    const stempelt = /require\(\s*['"][^'"]*lib\/stempel['"]\s*\)/.test(code);
    const grendelt = /\beisSchoneBoom\s*\(/.test(zichtbaar);
    const vlag = opVerzoek(code);
    const via = perBestand[naam] || [];
    const viaPoort = via.filter(n => n.startsWith('werkstroom:') ||
      POORTEN.some(p => n === p || n.startsWith(p + ':')));

    let klasse, waarom;
    if (stempelt && grendelt) {
      klasse = 'SCHONE_BOOM_VEREIST';
      waarom = 'roept eisSchoneBoom() aan en weigert dus op een vuile boom';
    } else if (stempelt && !vlag.alle) {
      klasse = 'KAN_COMMITBEWIJS_ONGELDIG_MAKEN';
      waarom = 'stempelt (claimt repo-waarheid), grendelt niet, en ' +
        (vlag.achterVlag ? vlag.plekken - vlag.achterVlag + ' van de ' + vlag.plekken +
          ' schrijfplekken hangt niet achter een vlag'
          : 'schrijft zonder dat iemand erom vraagt') +
        (viaPoort.length ? ' -- en hij loopt mee in: ' + viaPoort.join(', ') : '');
    } else if (stempelt) {
      klasse = 'VUILE_BOOM_TOEGESTAAN';
      waarom = 'stempelt en grendelt niet, maar schrijft alleen achter een uitdrukkelijke vlag; ' +
        'een mens die die vlag typt op een vuile boom neemt een besluit';
    } else {
      klasse = 'SCHRIJFT_AFGELEID_REGISTER';
      waarom = 'schrijft wel, maar stempelt niet -- geen claim op repo-waarheid, dus geen bewijs ' +
        'dat ongeldig kan worden';
    }
    rijen.push({ naam, klasse, waarom, stempelt, grendelt,
      schrijfplekken: vlag.plekken, achterVlag: vlag.achterVlag,
      npmScripts: via.length, viaPoort });
  }

  const perKlasse = {};
  for (const r of rijen) (perKlasse[r.klasse] = perKlasse[r.klasse] || []).push(r.naam);
  const risico = rijen.filter(r => r.klasse === 'KAN_COMMITBEWIJS_ONGELDIG_MAKEN');

  return {
    stempel: stempel(),
    graad: 'vermoed',
    wat: 'welke generatoren repo-waarheid kunnen wegschrijven zonder dat iemand erom vroeg',
    hoe: 'npm run stempelveiligheid -- leest scripts/*.js zonder commentaar, kijkt per SCHRIJFPLEK ' +
      'of er een vlag boven hangt, en volgt de npm-scriptgraaf transitief om te zien via welke ' +
      'commando\'s een schrijver bereikbaar is',
    grens: 'lexicaal, dus een ONDERgrens: wie op een andere manier schrijft of grendelt, valt ' +
      'erbuiten. Deze meter zegt NIET of een grendel werkt, alleen of hij er staat. En hij velt ' +
      'geen oordeel per script: KAN_COMMITBEWIJS_ONGELDIG_MAKEN is een werklijst en geen aanklacht ' +
      '-- een generator die alleen worktree-lokaal schrijft hoort daar mogelijk gewoon in thuis. ' +
      'Wat de klasse zegt is dat er vandaag bij die scripts geen mechanisme staat dat het incident ' +
      'van 15 september tegenhoudt. De npm-graaf ziet alleen aanroepen die in package.json staan; ' +
      'een script dat een ander script met child_process start op een naam die nergens in package.json of een werkstroom staat, valt erbuiten.',
    incident: 'npm run ci:lokaal op een vuile boom schreef ROLRONDE.json met boomVuil: true, en ' +
      'git add -A veegde hem mee. Een register dat naar een commit wijst die zijn eigen invoer ' +
      'niet bevat, heeft een geldige vorm en geen bewijskracht.',
    npmScripts: scripts,
    werkstromen,
    schrijvers: rijen.length,
    klassen: {
      SCHONE_BOOM_VEREIST: (perKlasse.SCHONE_BOOM_VEREIST || []).length,
      KAN_COMMITBEWIJS_ONGELDIG_MAKEN: risico.length,
      VUILE_BOOM_TOEGESTAAN: (perKlasse.VUILE_BOOM_TOEGESTAAN || []).length,
      SCHRIJFT_AFGELEID_REGISTER: (perKlasse.SCHRIJFT_AFGELEID_REGISTER || []).length,
      ONBEKEND: 0
    },
    /* DE SCHERPSTE DOORSNEDE: schrijvers die repo-waarheid stempelen EN meelopen
       in een commando dat een mens als CONTROLE leest. Dat is het incident, en
       geen van de andere getallen wijst hem aan. */
    inEenPoort: risico.filter(r => r.viaPoort.length).map(r => ({ naam: r.naam, viaPoort: r.viaPoort })),
    /* DE ZELFIJKING. Een meter die het geval niet vindt waarvoor hij is gebouwd,
       is geen meter -- en die uitslag ziet er hetzelfde uit als een schone. Het
       incident had een naam: scripts/rolronde.js, weggeschreven vanuit
       .github/workflows/ci.yml. Staat hij hier niet meer in de doorsnede, dan is
       er iets aan de meter veranderd of aan het script, en dat hoort NIET
       stilletjes als vooruitgang te lezen.

       scripts/ci-lokaal.js noemt in zijn eigen toelichting drie schrijvers: de
       ladder, de rolronde en de gluurronde. Alle drie horen in de risicoklasse;
       alleen de ladder hoort NIET in de doorsnede, want hij is nergens vanuit een
       poort bereikbaar. Dat verschil is de scherpste ijking die er is: het toont
       dat de doorsnede iets anders meet dan de klasse. */
    ijking: (() => {
      const doorsnede = new Set(risico.map(r => r.naam));
      const inPoort = new Set(risico.filter(r => r.viaPoort.length).map(r => r.naam));
      const klasseVan = (n) => (rijen.find(r => r.naam === n) || {}).klasse || '(niet gevonden)';
      return {
        bekendGeval: 'rolronde.js',
        gevondenInKlasse: doorsnede.has('rolronde.js'),
        gevondenInDoorsnede: inPoort.has('rolronde.js'),
        drieUitCiLokaal: {
          'bewijsladder.js': { klasse: klasseVan('bewijsladder.js'), inDoorsnede: inPoort.has('bewijsladder.js') },
          'rolronde.js': { klasse: klasseVan('rolronde.js'), inDoorsnede: inPoort.has('rolronde.js') },
          'gluurronde.js': { klasse: klasseVan('gluurronde.js'), inDoorsnede: inPoort.has('gluurronde.js') }
        },
        /* En de meter over ZICHZELF. Hij keurde zichzelf een keer ten onrechte
           goed omdat het woord eisSchoneBoom in een van zijn eigen zinnen stond. */
        overZichzelf: klasseVan('stempelveiligheid.js')
      };
    })(),
    perKlasse,
    rijen
  };
}

function druk(u) {
  console.log('STEMPELVEILIGHEID -- kan een meter repo-waarheid schrijven die niemand vroeg?\n');
  console.log('  ' + u.schrijvers + ' schrijvers onder scripts/, over ' + u.npmScripts + ' npm-scripts\n');
  for (const [k, n] of Object.entries(u.klassen)) {
    console.log('    ' + String(n).padStart(4) + '  ' + k);
  }
  console.log('\n  DE DOORSNEDE DIE HET INCIDENT IS -- stempelt, grendelt niet, schrijft ongevraagd,');
  console.log('  en loopt mee in een commando dat als CONTROLE leest:');
  if (!u.inEenPoort.length) {
    console.log('    geen. Dat is geen vrijbrief: de andere schrijvers uit die klasse zijn alleen');
    console.log('    niet vanuit een poort bereikbaar volgens package.json.');
  }
  for (const r of u.inEenPoort) console.log('    ' + r.naam.padEnd(34) + r.viaPoort.join(', '));
  const risico = u.perKlasse.KAN_COMMITBEWIJS_ONGELDIG_MAKEN || [];
  if (risico.length) {
    console.log('\n  de hele klasse (werklijst, geen aanklacht):');
    for (const n of risico) console.log('      ' + n);
  }
  console.log('\n  graad: ' + u.graad + ' -- ' + u.grens);
}

/* opVerzoek en SCHRIJFAANROEP gaan mee naar buiten zodat een toets ze op
   VERZONNEN fragmenten kan draaien. Zonder dat hangt het bewijs af van welk
   echt script toevallig welke vorm draagt -- en twee van de drie blinde
   vlekken hieronder hebben vandaag geen enkel echt voorbeeld. Een grendel
   zonder getuige is een bewering. */
module.exports = { meet, DOEL, POORTEN, opVerzoek, SCHRIJFAANROEP };

if (require.main === module) {
  const u = meet();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(u, null, 2)); process.exitCode = 0; return; }
  druk(u);
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
    console.log('\ngeschreven: STEMPELVEILIGHEID.json');
  }
}
