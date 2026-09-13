#!/usr/bin/env node
'use strict';
/* ============================================================================
   WAAR RAHUL ZIJN LEDENCONTEXT SAMENSTELT -- en wat daar samenkomt.

   WAAROM DIT SCRIPT BESTAAT. MN-02 (MENSNETWERK.md par. 4a) bewees dat een mens
   met twee hoedanigheden geen kennis uit de ene in de andere meeneemt, over de
   ROUTES. Wat die ronde niet kon beproeven is de AI: Rahul krijgt bij elke vraag
   een context mee die hij niet zelf opvraagt, en als daar iets in glipt ziet
   niemand dat -- de context staat op geen enkel scherm.

   De vraag die dit meet is dus de vraag VOOR de proef: welke bronnen komen in
   die context samen, en waarop is elk van hen gesleuteld? Zonder dat is een
   contaminatieproef een gok over wat er zou kunnen lekken.

   WAT HIJ MEET, en de drie zijn met opzet gescheiden:

     invoeren    de bronnen die de samensteller leest, elk met zijn SLEUTEL:
                 hangt hij aan dit ene lid, aan de pas, of aan het hele huis?
                 Alleen de lid-gesleutelde kunnen kennis over EEN mens dragen.
     ledenstaat  de velden die in de ledenstaat wonen, en welke daarvan door een
                 KANTOORroute worden geschreven. Dat is de aanvoer die van de
                 andere hoedanigheid komt.
     muur        de doorsnede: hoeveel van die velden leest de samensteller
                 werkelijk. Dat getal IS de bescherming, en dit script bestaat
                 om zichtbaar te maken hoe dun hij is.

   DE GRAAD IS `vermoed` EN NIET `gemeten`, en dat is geen bescheidenheid. De
   veldinventaris is lexicaal: hij telt toewijzingen aan een object dat uit
   getMemberState komt, herkend aan de namen waaronder dat in dit huis gebeurt.
   Schrijft iemand het onder een naam die hier niet staat, dan mist deze meter
   hem -- dus het is een ONDERgrens. De muur is daarmee hoogstens dunner dan hij
   hier lijkt, nooit dikker, en dat is de goede kant op voor een veiligheidsmaat.

   CODE EN COMMENTAAR WORDEN GESCHEIDEN. Elke bron gaat eerst door
   zonderCommentaar(): een meter die zijn eigen toelichting meeleest, meet de
   toelichting. Dat is hier geen theorie -- test/mutatiewacht.test.js bleef in
   zijn eerste vorm groen met de bewaakte code weg, omdat hij zijn eigen
   commentaar zag.

   Draaien:  npm run aicontext        (print)
             npm run aicontext:vast   (schrijft AICONTEXT.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./lib/bron');
const { stempel, eisSchoneBoom } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'AICONTEXT.json');
const SAMENSTELLER = 'server/kern/ai/prompt.js';

/* De namen waaronder een ledenstaat in dit huis rondgaat. Afgeleid uit de
   aanroepen van getMemberState: `const <naam> = accounts.getMemberState(...)`.
   Wie een nieuwe naam introduceert, valt buiten deze meter -- vandaar de
   ondergrens in de kop. */
/* De namen waaronder een ledenstaat in EEN BESTAND rondgaat, en alleen daar.

   DIT WAS EERST HUISBREED, EN DAT WAS DE VERKEERDE PROEF. De namen die
   getMemberState oplevert zijn `md` en `st`, en `st` heet in dit huis ook
   status, stand en state -- huisbreed meegeteld liep de veldinventaris van
   ongeveer dertig naar 91, allemaal even geloofwaardig. Een naam is alleen een
   ledenstaat in het bestand waar hij eraan gebonden is; daarbuiten is hij een
   naam. Dezelfde klasse als test/mutatiewacht.test.js: een nette uitslag uit
   een experiment dat iets anders mat. */
function staatNamenIn(code) {
  const namen = new Set();
  const re = /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:await\s+)?[\w.]*getMemberState\s*\(/g;
  let m; while ((m = re.exec(code))) namen.add(m[1]);
  return [...namen];
}

const cache = new Map();
function kaal(rel) {
  if (cache.has(rel)) return cache.get(rel);
  let uit = '';
  try { uit = zonderCommentaar(fs.readFileSync(path.join(WORTEL, rel), 'utf8')); } catch (e) { uit = ''; }
  cache.set(rel, uit);
  return uit;
}

function loopBoom(dir, uit) {
  uit = uit || [];
  for (const naam of fs.readdirSync(dir)) {
    if (naam === 'node_modules' || naam === 'data' || naam.startsWith('.')) continue;
    const vol = path.join(dir, naam);
    const st = fs.statSync(vol);
    if (st.isDirectory()) loopBoom(vol, uit);
    else if (naam.endsWith('.js')) uit.push(path.relative(WORTEL, vol));
  }
  return uit;
}

/* ---------- 1. de invoeren van de samensteller ---------- */
/* HET LIJF VAN EEN FUNCTIE, MET GEBALANCEERDE ACCOLADES. `slice(indexOf(...))`
   nam alles TOT HET EINDE van het bestand mee, en daardoor telde de regel
   `return { aiSystemPrompt, cannedAnswer }` onderaan als een invoer van de
   samensteller. Een leesfout die er als een bevinding uitzag. */
function lijfVan(code, kop) {
  const start = code.indexOf(kop);
  if (start < 0) return '';
  const open = code.indexOf('{', start);
  if (open < 0) return '';
  let diep = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') diep++;
    else if (code[i] === '}') { diep--; if (!diep) return code.slice(open, i + 1); }
  }
  return code.slice(open);
}

/* Wat de samensteller uit zijn context haalt (de destructurering), en waarop
   hij elk van die namen aanroept. De sleutel volgt uit het ARGUMENT: krijgt de
   bron `key` mee, dan gaat hij over dit ene lid; krijgt hij `tier`, dan over de
   pas; krijgt hij niets, dan over het hele huis. */
function invoerenVan() {
  const code = kaal(SAMENSTELLER);
  const lijf = lijfVan(code, 'function aiSystemPrompt');
  const dest = /const\s*\{([^}]*)\}\s*=\s*ctx\s*;/.exec(code);
  const uitCtx = dest ? dest[1].split(',').map(s => s.trim()).filter(Boolean) : [];
  const invoeren = [];
  const sleutelVan = (naam, args) => {
    const argTekst = args.join(' | ');
    if (/\bkey\b/.test(argTekst)) return 'lid';
    if (/\btier\b/.test(argTekst)) return 'pas';
    if (new RegExp('\\b' + naam + '\\s*\\[\\s*tier').test(lijf)) return 'pas';
    return 'globaal';
  };
  for (const naam of uitCtx) {
    if (!new RegExp('\\b' + naam + '\\b').test(lijf)) continue;
    const aanroep = new RegExp('\\b' + naam + '\\s*\\(([^)]*)\\)', 'g');
    const args = [];
    let m; while ((m = aanroep.exec(lijf))) args.push(m[1].trim());
    invoeren.push({ naam, sleutel: sleutelVan(naam, args),
      aanroep: args.length ? naam + '(' + args.join(' | ') + ')' : naam, herkomst: 'ctx' });
  }
  /* EEN REQUIRE DIE METEEN WORDT AANGEROEPEN MET `key` IS GEEN VASTE TEKST.
     `require('../rahul').rahulOmgangVoor(key)` stond hier als `statisch`, want
     de regel begon met require. Hij draagt de omgangsvorm van DIT lid. De
     sleutel hangt aan het argument en niet aan de manier van binnenhalen. */
  const inlijn = /require\(['"]([^'"]+)['"]\)\s*\.\s*([\w$]+)\s*\(([^)]*)\)/g;
  let q; while ((q = inlijn.exec(lijf))) {
    invoeren.push({ naam: q[2], sleutel: sleutelVan(q[2], [q[3].trim()]),
      aanroep: q[2] + '(' + q[3].trim() + ')', herkomst: q[1] });
  }
  /* De vaste tekst komt bovenaan via require en wordt niet aangeroepen; die is
     per definitie voor iedereen gelijk en kan dus niets over EEN mens dragen. */
  const req = /const\s*\{?\s*([\w$,\s]+?)\s*\}?\s*=\s*require\(['"]([^'"]+)['"]\)(\s*\.)?/g;
  let r; while ((r = req.exec(code))) {
    /* Wordt de require METEEN doorgeschakeld (`.rahulOmgangVoor(key)`), dan is
       de naam ervoor de UITKOMST van die aanroep en geen vaste tekst; de
       aanroep zelf staat hierboven al met zijn eigen sleutel. */
    if (r[3]) continue;
    for (const naam of r[1].split(',').map(s => s.trim()).filter(Boolean)) {
      if (!new RegExp('\\b' + naam + '\\b').test(lijf)) continue;
      if (invoeren.some(i => i.naam === naam)) continue;
      invoeren.push({ naam, sleutel: 'statisch', aanroep: naam, herkomst: r[2] });
    }
  }
  return invoeren;
}

/* ---------- 2. de velden van de ledenstaat, en wie ze schrijft ---------- */
function ledenstaatVelden(bestanden) {
  const velden = new Map();
  const namen = new Set();
  for (const b of bestanden) {
    const code = kaal(b);
    const eigen = staatNamenIn(code);
    if (!eigen.length) continue;
    for (const n of eigen) namen.add(n);
    const patroon = new RegExp('\\b(?:' + eigen.join('|') + ')\\.([a-zA-Z_$][\\w$]*)\\s*=(?!=)', 'g');
    let m; while ((m = patroon.exec(code))) {
      const veld = m[1];
      if (!velden.has(veld)) velden.set(veld, new Set());
      velden.get(veld).add(b);
    }
  }
  return { velden, namen: [...namen].sort() };
}

/* Een schrijver is KANTOOR als hij in de kantoorroutes woont. Dat is een
   padvraag en geen bevoegdheidsvraag: waar de deur zit meet scripts/
   kantoormacht.js, en twee meters met hun eigen definitie lopen uiteen. */
const isKantoor = (b) => /^server\/routes\/office\//.test(b) || /^server\/kern\/kantoor\//.test(b);

function main() {
  const bestanden = loopBoom(path.join(WORTEL, 'server'));
  const invoeren = invoerenVan();
  const { velden, namen } = ledenstaatVelden(bestanden);

  /* Welke velden van de ledenstaat leest de samensteller met NAME? Dat is de
     muur: alles wat hij niet noemt, bereikt het model niet. */
  const lijf = lijfVan(kaal(SAMENSTELLER), 'function aiSystemPrompt');
  /* WELKE VELDEN LEEST DE SAMENSTELLER ZELF -- uit zijn eigen lijf, en niet als
     doorsnede met de veldinventaris. Dat was de eerste vorm, en die liet `trip`
     vallen: geen enkel bestand schrijft `md.trip =` onder een herkende naam,
     dus het veld stond niet in de inventaris en gold daarmee als niet-gelezen.
     Een muur die dunner lijkt omdat de meter het veld niet kent, is een
     geruststelling van de verkeerde soort. */
  /* De samensteller bindt zijn ledenstaat via ledenInhoudVan() en niet via
     getMemberState(), dus staatNamenIn() vindt hem hier niet; de naam komt uit
     dezelfde vorm, een regel lager in de keten (kern/lid.js). */
  const bind = /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*ledenInhoudVan\s*\?/.exec(lijf);
  const eigenNamen = bind ? [bind[1]] : staatNamenIn(kaal(SAMENSTELLER));
  const gelezen = [...new Set([...lijf.matchAll(
    new RegExp('\\b(?:' + (eigenNamen.length ? eigenNamen.join('|') : 'md') + ')\\.([a-zA-Z_$][\\w$]*)', 'g'))]
    .map(m => m[1]))].sort();

  const doorKantoor = [...velden.entries()]
    .filter(([, bs]) => [...bs].some(isKantoor))
    .map(([v]) => v).sort();

  const stand = {
    gemeten: new Date().toISOString(),
    graad: 'vermoed',
    /* WAT DIT REGISTER NIET AANTOONT (meetkeuring, regel `grens`). Zonder deze
       zin leest "lek: leeg" als "er kan niets naar een model lekken", en dat is
       drie stappen te ver. */
    grens: 'dit meet de LEDENcontext van Rahul (kern/ai/prompt.js) en verder niets: de werkcontexten ' +
      '(zaak, personeel, kantoor) hebben eigen samenstellers en zijn hier niet gemeten. Het zegt ook ' +
      'niets over wat een model met de context DOET, niets over andere wegen waarlangs gegevens het ' +
      'huis verlaten, en de veldinventaris is lexicaal -- een ledenstaat onder een naam die deze meter ' +
      'niet kent, valt erbuiten. Een lege doorsnede betekent dus "niet gevonden", niet "kan niet bestaan".',
    waarom: 'de veldinventaris is lexicaal en dus een ONDERgrens: een ledenstaat onder een ' +
      'andere naam valt erbuiten. De muur is hoogstens dunner dan hier staat, nooit dikker.',
    samensteller: { bestand: SAMENSTELLER, functie: 'aiSystemPrompt(tier, lang, key)' },
    invoeren,
    telling: ['lid', 'pas', 'globaal', 'statisch'].reduce((o, s) => {
      o[s] = invoeren.filter(i => i.sleutel === s).length; return o;
    }, {}),
    ledenstaat: {
      namen,
      velden: [...velden.keys()].sort(),
      aantal: velden.size,
      doorKantoorGeschreven: doorKantoor
    },
    muur: {
      vorm: 'veldselectie op naam in ' + SAMENSTELLER,
      gelezenVelden: gelezen,
      aantalGelezen: gelezen.length,
      aantalNietGelezen: [...velden.keys()].filter(v => !gelezen.includes(v)).length,
      lek: gelezen.filter(v => doorKantoor.includes(v))
    }
  };
  return stand;
}

/* NIET UITVOEREN BIJ HET REQUIREN (meetkeuring, regel `wacht`). Een
   laadcontrole (`node -e "require(...)"`) zou anders de meting draaien, en met
   --vastleggen in argv het register overschrijven. Dat is hier geen theorie: zo
   is ROLPROEF.json ooit van 3377 beproefde routes naar 292 teruggeschreven, en
   het bestand zag er daarna volkomen normaal uit. */
function toon(stand) {
  const t = stand.telling;
  console.log('\nDE LEDENCONTEXT VAN RAHUL -- ' + stand.samensteller.bestand);
  console.log('\n  invoeren: ' + t.lid + ' op het LID, ' + t.pas + ' op de PAS, ' +
    t.globaal + ' op het HUIS, ' + t.statisch + ' vaste tekst');
  for (const i of stand.invoeren) console.log('    ' + i.sleutel.padEnd(10) + i.aanroep);
  console.log('\n  ledenstaat: ' + stand.ledenstaat.aantal + ' velden, waarvan ' +
    stand.ledenstaat.doorKantoorGeschreven.length + ' door een kantoorroute geschreven');
  console.log('    kantoor schrijft: ' + (stand.ledenstaat.doorKantoorGeschreven.join(', ') || '(geen)'));
  console.log('\n  DE MUUR: ' + stand.muur.aantalGelezen + ' van ' + stand.ledenstaat.aantal +
    ' velden bereiken het model (' + stand.muur.gelezenVelden.join(', ') + ')');
  console.log('    ' + stand.muur.aantalNietGelezen + ' velden liggen in hetzelfde object en worden NIET gelezen.');
  console.log('    doorsnede kantoorveld x gelezen veld: ' + (stand.muur.lek.join(', ') || 'leeg'));
  console.log('\n  graad: ' + stand.graad + ' -- ' + stand.waarom + '\n');
}

if (require.main === module) {
  const stand = main();
  if (process.argv.includes('--vastleggen')) {
    /* DE POORT VOORAF, EN NIET ALLEEN HET STEMPEL ACHTERAF. `stempel()` meldt met
       `boomVuil: true` dat deze meting bij een stand hoort die nergens is
       vastgelegd -- maar pas als hij al geschreven is, en dan ratelt
       `registersUitVuileBoom` omhoog. De poort die dat vooraf tegenhoudt hangt
       aan 12 van de 79 stempelende scripts; dit is er een van. */
    const poort = eisSchoneBoom('aicontext');
    if (!poort.ok) { console.error('[aicontext] ' + poort.reden); process.exit(2); }
    fs.writeFileSync(DOEL, JSON.stringify(Object.assign({ stempel: stempel() }, main()), null, 2) + '\n');
    console.log('AICONTEXT.json geschreven.');
  }
  toon(stand);
}

module.exports = { meet: main };
