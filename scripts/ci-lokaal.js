#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE KETEN OP DEZE MACHINE -- draai hier wat de CI straks draait.

   HET GAT. `npm test` en `npm run check` zijn wat een mens hier draait; de
   keten draait daarnaast nog vierentwintig poorten die niemand lokaal kent --
   de deltapoort, het verval, het wettenregister, de overleving, het gezag, de
   envelop, de norm, de ladder, de rolronde, de gluurronde, de container. Wie
   die niet draait, hoort er twintig minuten later van, op een machine waar hij
   niet bij kan, en begint dan met raden.

   ERGER IS DE DRIFT. Komt er in ci.yml een poort bij, dan komt hij lokaal
   nooit vanzelf mee. Een handgeschreven lijst hier zou dat oplossen tot de
   eerste keer dat iemand hem vergeet bij te werken -- en daarna bewaakt hij
   niets meer en denkt iedereen van wel. Daarom staat er hier GEEN lijst: de
   poorten worden GELEZEN uit .github/workflows (scripts/lib/werkstroom.js).
   Een stap die morgen aan de keten wordt toegevoegd, staat morgen in deze
   ronde. Dat is het hele punt van dit bestand.

   WAT HIJ NIET DOET. Hij speelt de keten niet na: niet vier scherven, geen
   postgres uit een service, geen artefact uit een andere job. Wat hier niet
   kan draaien, meldt hij als NIET GEDRAAID met de reden erbij -- nooit als
   `staat`. Een poort die je overslaat en groen noemt, is erger dan een poort
   die je niet hebt.

   DRAAIEN:
     node scripts/ci-lokaal.js              de poorten van de merge-keten
     node scripts/ci-lokaal.js --lijst      alleen tonen wat er zou draaien
     node scripts/ci-lokaal.js --snel       zonder de poorten die vorige ronde
                                            langer dan twee minuten deden
     node scripts/ci-lokaal.js --alle       ook de wekelijkse ronde en de wachten
     node scripts/ci-lokaal.js --alles      ook wat de gewone ronde al dekt
     node scripts/ci-lokaal.js --alleen=gezag,envelop
     node scripts/ci-lokaal.js --zonder=containerproef
     node scripts/ci-lokaal.js --controle   niets draaien: alleen of de gewone
                                            ronde elke poort nog bereikt
   Exitcode 0 = niets gezakt. 1 = er is een poort gezakt (of de controle zakt).
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawnSync } = require('child_process');
const W = require('./lib/werkstroom');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, '.cilokaal');
const K = { dim: '\x1b[2m', groen: '\x1b[32m', rood: '\x1b[31m', geel: '\x1b[33m', vet: '\x1b[1m', uit: '\x1b[0m' };

/* ALLEEN ALS DIT SCRIPT ZELF DRAAIT. Wordt de module geimporteerd (door de
   toetsen, of straks door een ander script), dan is process.argv van de
   AANROEPER -- en dan zou `node --test --alleen=iets` hier stilletjes een
   filter zetten dat niemand bedoeld heeft. */
const argv = require.main === module ? process.argv.slice(2) : [];
const heeft = v => argv.includes(v);
const waarde = v => (argv.find(a => a.startsWith(v + '=')) || '').slice(v.length + 1);
const lijstArg = v => { const s = waarde(v); return s ? s.split(',').map(x => x.trim()).filter(Boolean) : null; };

const LIJST = heeft('--lijst');
const CONTROLE = heeft('--controle');
const ALLE = heeft('--alle');          /* ook de geplande werkstromen */
const ALLES = heeft('--alles');        /* ook wat de gewone ronde al draait */
const SNEL = heeft('--snel');
const JSONUIT = heeft('--json');
const ALLEEN = lijstArg('--alleen');
const ZONDER = lijstArg('--zonder') || [];
const SNELGRENS = 120 * 1000;

/* ==========================================================================
   WAT DRAAIT DE GEWONE RONDE AL?

   De Slotsuite is de lokale ronde: bouw, poorten, toetsen, a11y, beproeving,
   keuring. Wat daar al in staat hoeft hier niet nog een keer. De lijst komt
   uit `LAGEN` van scripts/slotsuite.js zelf -- dus als daar morgen een stap
   uit gaat, verschijnt hij hier vanzelf als poort die WEL gedraaid moet
   worden. Twee lijsten die elkaar aanvullen zonder elkaar over te typen.
   ========================================================================== */
function gewoneRonde(lagen) {
  const doelen = new Set();
  try {
    const LAGEN = lagen || require('./slotsuite.js').LAGEN;
    for (const laag of LAGEN || []) {
      if (laag.bouw) doelen.add('scripts/build.js');
      if (laag.intern) doelen.add('scripts/keuring.js');
      for (const stap of laag.stappen || []) {
        const args = (stap[1] && stap[1][1]) || [];
        const js = args.find(a => typeof a === 'string' && a.endsWith('.js'));
        if (js) doelen.add(js.replace(/^\.\//, ''));
      }
    }
  } catch (e) { /* geen slotsuite: dan dekt de gewone ronde niets, en dat is streng genoeg */ }
  return doelen;
}

/* Draait de gewone ronde deze meter uberhaupt aan? Zonder dit blijft de
   afleiding een script dat je met de hand moet aanroepen, en dan is hij precies
   zo vergeetbaar als de lijst die hij vervangt. */
function slotsuiteRoeptOns(lagen) {
  try {
    const LAGEN = lagen || require('./slotsuite.js').LAGEN;
    return (LAGEN || []).some(l => (l.stappen || []).some(s =>
      ((s[1] && s[1][1]) || []).some(a => typeof a === 'string' && a.includes('ci-lokaal.js'))));
  } catch (e) { return false; }
}

/* ==========================================================================
   DE VOORZIENINGEN -- wat er op deze machine moet staan.

   Elke poort die er een nodig heeft en hem hier niet vindt, wordt NIET
   GEDRAAID. Hem toch starten zou erger zijn dan overslaan: scripts/pgtoetsen.js
   slaat zichzelf zonder database netjes over en meldt exitcode 0, en dan staat
   er groen op het scherm voor acht toetsen die niet hebben gedraaid.
   ========================================================================== */
/* Een TCP-klop in een KIND-proces, en dat is geen omweg om de omweg: het plan
   wordt synchroon gebouwd (elke poort krijgt zijn stand voordat er iets draait)
   en `net.connect` is dat niet. Een halve seconde per adres, en het antwoord
   wordt onthouden. */
function bereikbaar(url, standaardpoort) {
  let host = null, poort = standaardpoort;
  try { const u = new URL(url); host = u.hostname; poort = Number(u.port) || standaardpoort; } catch (e) { return false; }
  if (!host) return false;
  const r = spawnSync(process.execPath, ['-e', `
    const net = require('net');
    const s = net.connect(${poort}, ${JSON.stringify(host)});
    s.setTimeout(600);
    s.on('connect', () => { s.destroy(); process.exit(0); });
    s.on('timeout', () => { s.destroy(); process.exit(1); });
    s.on('error', () => process.exit(1));
  `], { timeout: 5000 });
  return r.status === 0;
}

const voorzieningCache = new Map();
function voorzieningStaat(naam, gat) {
  const sleutel = naam === 'schone-werkboom' ? naam + '|' + gat.opdracht
    : naam + (naam === 'postgres' || naam === 'redis' ? '|' + (W.stapOmgeving(gat)[naam === 'postgres' ? 'DATABASE_URL' : 'REDIS_URL'] || '') : '');
  if (voorzieningCache.has(sleutel)) return voorzieningCache.get(sleutel);
  let uit;
  if (naam === 'postgres') {
    const url = W.stapOmgeving(gat).DATABASE_URL || process.env.DATABASE_URL;
    uit = url && bereikbaar(url, 5432)
      ? { er: true } : { er: false, hoe: 'geen bereikbare PostgreSQL (' + (url || 'DATABASE_URL is niet gezet') + ')' };
  } else if (naam === 'redis') {
    const url = W.stapOmgeving(gat).REDIS_URL || process.env.REDIS_URL;
    uit = url && bereikbaar(url, 6379)
      ? { er: true } : { er: false, hoe: 'geen bereikbare Redis (' + (url || 'REDIS_URL is niet gezet') + ')' };
  } else if (naam === 'docker') {
    const r = spawnSync('docker', ['info'], { encoding: 'utf8', timeout: 20000 });
    uit = r.status === 0 ? { er: true } : { er: false, hoe: 'geen draaiende docker-daemon' };
  } else if (naam === 'schone-werkboom') {
    /* Alleen over de paden die de keten zelf noemt: `git diff --exit-code --
       public server scripts` gaat over het bouwsel, niet over de hele boom. */
    const na = woorden(gat.opdracht).indexOf('--');
    const paden = na >= 0 ? woorden(gat.opdracht).slice(na + 1) : [];
    const r = spawnSync('git', ['diff', '--quiet', '--'].concat(paden), { cwd: WORTEL, timeout: 30000 });
    uit = r.status === 0 ? { er: true }
      : { er: false, hoe: 'de werkboom heeft nog niet-vastgelegde wijzigingen in ' + (paden.join(', ') || 'de boom') +
          ' -- de keten meet dit op een schone checkout' };
  } else if (naam.startsWith('gitref:')) {
    const ref = naam.slice(7);
    const r = spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: WORTEL, timeout: 30000 });
    uit = r.status === 0 ? { er: true } : { er: false, hoe: ref + ' bestaat hier niet (git fetch origin)' };
  } else if (naam === 'browser') {
    let herkomst = 'geen';
    try { herkomst = require('./lib/scherm').herkomst(); } catch (e) {}
    uit = herkomst !== 'geen' ? { er: true } : { er: false, hoe: 'geen Chromium (node scripts/browserinstall.js)' };
  } else uit = { er: true };
  voorzieningCache.set(sleutel, uit);
  return uit;
}

/* ==========================================================================
   HET PLAN
   ========================================================================== */
function woorden(opdracht) {
  const uit = [];
  let woord = '', aanhaling = null;
  for (const c of String(opdracht)) {
    if (aanhaling) { if (c === aanhaling) aanhaling = null; else woord += c; continue; }
    if (c === '"' || c === "'") { aanhaling = c; continue; }
    if (/\s/.test(c)) { if (woord) uit.push(woord); woord = ''; continue; }
    woord += c;
  }
  if (woord) uit.push(woord);
  /* Omleidingen zijn shell en geen argument: `2>&1` doorgeven aan een proces
     dat geen shell is, maakt er een bestandsnaam van. */
  return uit.filter(w => !/^\d?[<>]/.test(w) && !/^&\d?$/.test(w));
}

/* De argumenten NA het doel: waarmee `npm audit --audit-level=high` een andere
   poort is dan `npm audit`, terwijl `npm run e2e` en `node scripts/e2e.js`
   dezelfde zijn. */
function argsVan(opdracht) {
  const w = woorden(opdracht);
  let i = w.findIndex(x => /\.js$/.test(x));
  if (i < 0) i = (w[0] === 'npm' && w[1] === 'run') ? 2 : 0;
  return w.slice(i + 1).filter(x => x !== '--');
}

/* Waar `--alleen=` en `--zonder=` op mogen wijzen: de naam, het doel of de
   STAP. Dat laatste is nodig omdat twee poorten hetzelfde doel kunnen hebben en
   alleen in hun omgeving verschillen -- de gluurronde draait een keer als
   zelfproef en een keer echt, en zonder de stapnaam zijn die twee niet uit
   elkaar te houden. */
function raakt(rij, woord) {
  const w = String(woord).toLowerCase();
  return rij.naam.toLowerCase().includes(w) || String(rij.doel || '').toLowerCase().includes(w) ||
    String(rij.gat.stap || '').toLowerCase().includes(w) || String(rij.gat.job || '').toLowerCase().includes(w);
}

function sleutelVan(gat) {
  return gat.werkstroom + ' ' + gat.opdracht + ' ' + JSON.stringify(W.stapOmgeving(gat));
}

function naamVan(gat) {
  return (gat.doel || gat.opdracht).replace(/^(?:scripts|test)\//, '').replace(/\.js$/, '');
}

function register() {
  try { return JSON.parse(fs.readFileSync(REGISTER, 'utf8')); } catch (e) { return { poorten: {} }; }
}

function plan(opties) {
  const o = opties || {};
  const gedekt = o.gedekt || gewoneRonde();
  const eerder = register().poorten || {};
  const alles = W.poorten({ map: o.map });
  const gekozen = alles.filter(g => {
    if (g.soort !== 'toets') return false;
    if (ALLE || o.alle) return true;
    return (g.aanleiding || []).includes('pull_request');
  });

  const uit = [];
  const gezien = new Set();
  const vormen = new Map();
  for (const gat of gekozen) {
    const sleutel = sleutelVan(gat);
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    const oordeel = W.oordeel(gat);
    const meting = eerder[sleutel] || null;
    const rij = { gat, sleutel, naam: naamVan(gat), doel: gat.doel, oordeel, meting,
      omgeving: W.stapOmgeving(gat), stand: null, waarom: null, opdracht: gat.opdracht, herleid: false };

    if (gat.informatief) { rij.stand = 'informatief'; rij.waarom = 'de keten zakt hier zelf niet op (`|| true`)'; uit.push(rij); continue; }

    if (!oordeel.lokaal) {
      /* Een poort die de keten VERDEELT (vier scherven, vier a11y-delen) heeft
         hier een eerlijke vorm: het hele doel in een keer. Alleen die vertaling
         maken we; de rest van de redenen blijft staan. */
      if (oordeel.soortReden === 'ketenwaarde' && gat.verdeeld && gat.doel && /\.js$/.test(gat.doel)) {
        rij.opdracht = 'node ' + gat.doel;
        rij.herleid = true;
      } else { rij.stand = 'niet-lokaal'; rij.waarom = oordeel.reden; uit.push(rij); continue; }
    }

    /* Drie scherven, een doel: na de herleiding staat er drie keer dezelfde
       opdracht. Hem drie keer draaien meet niets extra en leest als drie
       poorten. De eerste blijft staan, de rest wijst ernaar. */
    const vorm = (rij.doel || rij.opdracht) + '|' +
      argsVan(rij.herleid ? rij.opdracht : (gat.opgelost || rij.opdracht)).join(' ') + '|' + JSON.stringify(rij.omgeving);
    if (vormen.has(vorm)) {
      rij.stand = 'dubbel'; rij.waarom = 'zelfde vorm als ' + vormen.get(vorm); uit.push(rij); continue;
    }
    vormen.set(vorm, gat.werkstroom + ':' + gat.regel);

    if (!ALLES && gedekt.has(gat.doel)) {
      rij.stand = 'gedekt'; rij.waarom = 'de gewone ronde draait dit doel al'; uit.push(rij); continue;
    }
    if (ALLEEN && !ALLEEN.some(a => raakt(rij, a))) {
      rij.stand = 'overgeslagen'; rij.waarom = 'niet gevraagd (--alleen)'; uit.push(rij); continue;
    }
    if (ZONDER.some(z => raakt(rij, z))) {
      rij.stand = 'overgeslagen'; rij.waarom = 'niet gevraagd (--zonder)'; uit.push(rij); continue;
    }
    if (SNEL && meting && meting.ms > SNELGRENS) {
      rij.stand = 'overgeslagen'; rij.waarom = 'vorige ronde ' + duur(meting.ms) + ' (--snel)'; uit.push(rij); continue;
    }
    const mist = (gat.voorzieningen || []).map(v => ({ v, s: voorzieningStaat(v, gat) })).filter(x => !x.s.er);
    if (mist.length) {
      rij.stand = 'voorziening'; rij.waarom = mist.map(x => x.s.hoe).join('; '); uit.push(rij); continue;
    }
    rij.stand = 'draait';
    uit.push(rij);
  }

  /* De volgorde: eerst wat vorige ronde snel was. Een poort die nog nooit hier
     draaide heeft geen meting en gaat achteraan -- onbekende kosten laten we
     niet voor het goedkope werk staan. */
  uit.sort((a, b) => {
    if (a.stand === 'draait' && b.stand !== 'draait') return -1;
    if (b.stand === 'draait' && a.stand !== 'draait') return 1;
    const am = a.meting ? a.meting.ms : Infinity, bm = b.meting ? b.meting.ms : Infinity;
    return am - bm;
  });
  return uit;
}

function duur(ms) {
  return ms < 1000 ? ms + ' ms' : ms < 60000 ? (ms / 1000).toFixed(1) + ' s'
    : Math.floor(ms / 60000) + 'm ' + Math.round(ms % 60000 / 1000) + 's';
}

/* ==========================================================================
   DE RONDE
   ========================================================================== */
function draai(rij) {
  const w = woorden(rij.opdracht);
  const t0 = Date.now();
  const r = spawnSync(w[0], w.slice(1), { cwd: WORTEL, encoding: 'utf8', timeout: 90 * 60 * 1000,
    maxBuffer: 256 * 1024 * 1024, env: { ...process.env, ...rij.omgeving } });
  return { ok: r.status === 0, code: r.status === null ? 'afgebroken' : r.status,
    uit: String(r.stdout || '') + String(r.stderr || ''), ms: Date.now() - t0 };
}

/* WELKE BESTANDEN STAAN ER NA AFLOOP ANDERS IN DE BOOM?

   Een poort hoort te KIJKEN, maar een deel van deze poorten SCHRIJFT: de
   ladder, de rolronde en de gluurronde leggen hun uitslag vast in een register
   in de wortel. In de keten is dat prima -- die draait op een wegwerpcheckout.
   Hier blijft het staan, en dan heeft een ronde die niets mocht veranderen
   drie registers herschreven MET DE STEMPEL VAN EEN VUILE WERKBOOM. Dat is
   geen theorie: de eerste ronde hier zette `registersUitVuileBoom` van 2 op 5
   en liet `npm run norm` zakken op zijn eigen bijwerking.

   Hij ruimt niets op -- soms wil je die uitslag juist bewaren. Hij zegt het,
   en dan beslist een mens. */
function boomstand() {
  const r = spawnSync('git', ['status', '--porcelain'], { cwd: WORTEL, encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) return null;
  return new Set(String(r.stdout || '').split('\n').map(s => s.slice(3).trim()).filter(Boolean));
}

function staart(tekst, n) {
  return String(tekst).split('\n').map(s => s.replace(/\x1b\[[0-9;]*m/g, '').trimEnd())
    .filter(s => s.trim()).slice(-(n || 12)).join('\n');
}

function toon(rijen) {
  let werkstroom = null;
  for (const rij of rijen) {
    if (rij.gat.werkstroom !== werkstroom) {
      werkstroom = rij.gat.werkstroom;
      console.log('\n' + K.vet + werkstroom + K.uit + K.dim + '  (' + (rij.gat.aanleiding || []).join(', ') + ')' + K.uit);
    }
    /* Uitlijnen op de ZICHTBARE tekst: een kleurcode telt mee in .length en
       niet in de kolom, dus padEnd over een gekleurde string zet de kolommen
       scheef zodra een stand een andere kleur heeft. */
    const label = { draait: 'draait', gedekt: 'gedekt', dubbel: 'staat er al',
      'niet-lokaal': 'hier niet', voorziening: 'ontbreekt' }[rij.stand] || rij.stand;
    const kleur = rij.stand === 'draait' ? K.groen
      : rij.stand === 'niet-lokaal' || rij.stand === 'voorziening' ? K.geel : K.dim;
    console.log('  ' + rij.naam.padEnd(26) + kleur + label.padEnd(14) + K.uit + K.dim +
      (rij.waarom || rij.opdracht + (rij.herleid ? '  (de keten verdeelt dit)' : '')) + K.uit);
  }
}

function jobsZonderLokaleVorm() {
  /* Een job die uitsluitend een externe action draait (CodeQL) heeft hier geen
     vorm. Dat hoort er hardop bij te staan: anders leest een groene lokale
     ronde als "alles wat de keten doet is hier gedaan". */
  const uit = [];
  for (const ws of W.werkstromen()) {
    if (!ALLE && !(ws.aanleiding || []).includes('pull_request')) continue;
    for (const [jobId, job] of Object.entries(ws.doc.jobs || {})) {
      const stappen = Array.isArray(job.steps) ? job.steps : [];
      if (stappen.some(s => s && typeof s.run === 'string')) continue;
      const extern = stappen.filter(s => s && typeof s.uses === 'string' &&
        !/checkout|setup-node|upload-artifact|download-artifact/.test(s.uses));
      if (extern.length) uit.push({ werkstroom: ws.bestand, job: jobId, acties: extern.map(s => s.uses.split('@')[0]) });
    }
  }
  return uit;
}

function ronde() {
  const rijen = plan();
  const extern = jobsZonderLokaleVorm();

  if (JSONUIT) {
    console.log(JSON.stringify({ poorten: rijen.map(r => ({ werkstroom: r.gat.werkstroom, regel: r.gat.regel,
      job: r.gat.job, naam: r.naam, doel: r.doel, opdracht: r.opdracht, stand: r.stand, waarom: r.waarom })),
      zonderLokaleVorm: extern }, null, 2));
    return 0;
  }

  console.log('\n' + K.vet + 'DE KETEN OP DEZE MACHINE' + K.uit + K.dim +
    ' -- afgeleid uit .github/workflows, niet overgetypt' + K.uit);

  if (LIJST) {
    toon(rijen);
    for (const e of extern)
      console.log('\n  ' + K.geel + 'geen lokale vorm' + K.uit + '  ' + e.werkstroom + ' / ' + e.job +
        ': ' + e.acties.join(', ') + ' draait alleen bij GitHub.');
    const telt = rijen.filter(r => r.stand === 'draait').length;
    console.log('\n  ' + telt + ' van de ' + rijen.length + ' poorten zouden hier draaien.\n');
    return 0;
  }

  const voor = boomstand();
  const boek = register();
  boek.poorten = boek.poorten || {};
  let gezakt = 0, gedraaid = 0;
  let werkstroom = null;
  for (const rij of rijen) {
    if (rij.gat.werkstroom !== werkstroom) {
      werkstroom = rij.gat.werkstroom;
      console.log('\n' + K.vet + werkstroom + K.uit);
    }
    if (rij.stand !== 'draait') {
      console.log('  ' + rij.naam.padEnd(26) +
        (rij.stand === 'gedekt' ? K.dim + 'gedekt door de gewone ronde'
          : rij.stand === 'dubbel' ? K.dim + 'staat hier al in'
            : K.geel + 'NIET GEDRAAID') + K.uit +
        K.dim + '  ' + (rij.waarom || '') + K.uit);
      continue;
    }
    process.stdout.write('  ' + rij.naam.padEnd(26));
    const r = draai(rij);
    gedraaid++;
    boek.poorten[rij.sleutel] = { ms: r.ms, uitslag: r.ok ? 'staat' : 'gezakt', gemeten: new Date().toISOString(), opdracht: rij.opdracht };
    console.log((r.ok ? K.groen + 'staat' : K.rood + 'GEZAKT (exit ' + r.code + ')') + K.uit + K.dim + '  ' + duur(r.ms) + K.uit);
    if (!r.ok) {
      gezakt++;
      console.log(K.dim + staart(r.uit, 14).split('\n').map(s => '    ' + s).join('\n') + K.uit);
    }
  }

  boek.stempel = new Date().toISOString();
  try { fs.writeFileSync(REGISTER, JSON.stringify(boek, null, 2) + '\n'); } catch (e) {}

  const na = boomstand();
  const geschreven = voor && na ? [...na].filter(p => !voor.has(p)) : [];
  const nietGedraaid = rijen.filter(r => ['niet-lokaal', 'voorziening', 'overgeslagen', 'informatief'].includes(r.stand));
  const dubbel = rijen.filter(r => r.stand === 'dubbel');
  console.log('\n' + K.vet + 'OORDEEL' + K.uit);
  console.log('  gemeten       : ' + gedraaid + ' poorten, ' + gezakt + ' gezakt');
  console.log('  gedekt        : ' + rijen.filter(r => r.stand === 'gedekt').length + ' door de gewone ronde (npm test, npm run check, de a11y-scan)' +
    (dubbel.length ? ', ' + dubbel.length + ' stonden er al in dezelfde vorm in' : ''));
  console.log('  niet gedraaid : ' + nietGedraaid.length + (nietGedraaid.length ? ' -- en dat is geen groen:' : ''));
  for (const r of nietGedraaid) console.log('      ' + r.naam.padEnd(26) + ' ' + K.dim + r.waarom + K.uit);
  for (const e of extern)
    console.log('      ' + (e.job + ' (' + e.werkstroom + ')').padEnd(26) + ' ' + K.dim + e.acties.join(', ') + ' draait alleen bij GitHub' + K.uit);
  if (geschreven.length) {
    console.log('  geschreven    : ' + geschreven.length + ' bestand(en) veranderd door deze ronde -- de keten doet dat op een');
    console.log('                  wegwerpcheckout, hier blijft het staan. Bewaren of terugzetten is een keuze:');
    for (const p of geschreven) console.log('      ' + K.dim + p + K.uit);
  }
  console.log('  OORDEEL       : ' + (gezakt === 0 ? K.groen + 'geen poort gezakt' : K.rood + gezakt + ' POORT(EN) GEZAKT') + K.uit + '\n');
  return gezakt === 0 ? 0 : 1;
}

/* ==========================================================================
   DE CONTROLE -- loopt de lokale ronde niet achter op de keten?

   Twee vragen, en ze zijn allebei een ANDERE dan die van scripts/ci-keten.js
   (dat bewaakt de keten zelf: elke opdracht herkend, elk doel aanwezig).
     1. roept de gewone ronde deze afleiding aan? Zonder dat is dit een script
        dat je met de hand moet aanroepen, en dan is het net zo vergeetbaar als
        de lijst die het vervangt.
     2. draagt elke poort die hier NIET kan draaien een reden? Een lege reden is
        een gat dat als een keuze leest.
   ========================================================================== */
function controle() {
  const fout = [];
  if (!slotsuiteRoeptOns())
    fout.push('de Slotsuite draait scripts/ci-lokaal.js niet -- dan bereikt de gewone ronde de poorten van de keten niet.');
  for (const rij of plan({ gedekt: new Set() })) {
    if (rij.stand === 'niet-lokaal' && !rij.waarom)
      fout.push(rij.gat.werkstroom + ':' + rij.gat.regel + ' ' + rij.naam + ' kan hier niet draaien en zegt niet waarom.');
    if (rij.oordeel.soortReden === 'doel-weg')
      fout.push(rij.gat.werkstroom + ':' + rij.gat.regel + ' ' + rij.oordeel.reden);
  }
  if (fout.length) {
    console.error('De lokale keten loopt achter (' + fout.length + '):');
    fout.forEach(f => console.error(' - ' + f));
    return 1;
  }
  const rijen = plan();
  console.log('De lokale keten staat: ' + rijen.filter(r => r.stand === 'draait').length + ' poorten draaien hier, ' +
    rijen.filter(r => r.stand === 'gedekt').length + ' zitten in de gewone ronde, ' +
    rijen.filter(r => ['niet-lokaal', 'voorziening'].includes(r.stand)).length + ' dragen een reden.');
  return 0;
}

if (require.main === module) process.exitCode = CONTROLE ? controle() : ronde();

module.exports = { plan, gewoneRonde, slotsuiteRoeptOns, woorden, argsVan, controle, REGISTER };
