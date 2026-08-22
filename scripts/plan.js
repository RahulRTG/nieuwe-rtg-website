#!/usr/bin/env node
'use strict';
/* DE INCREMENTELE ZEKERHEIDSPLANNER -- wat moet er draaien, en waarom?

   Dit is de plek waar de vier lagen bij elkaar komen:

     lib/werkelijkheid.js   wat er is        (index, graaf, omkering)
     lib/semdiff.js         wat er veranderde (ondergrens per bestand)
     lib/risico.js          wie dat raakt     (propagatie, eindklasse)
     lib/bewijsboek.js      wat al bewezen is (stempel, verval, steekproef)

   DE REGEL WAAR ALLES OP RUST (PROOF-INCREMENTAL.md par. 0):
     snelheid mag alleen voortkomen uit bewezen irrelevantie, nooit uit
     overgeslagen zekerheid -- en wat het systeem niet kan bewijzen als
     irrelevant, behandelt het als relevant.

   Vertaald naar wat hieronder gebeurt: een toets wordt alleen overgeslagen als
   GEEN ENKEL bestand dat hij leest is veranderd, de omgeving dezelfde is, het
   bewijs niet verlopen is en hij niet in de steekproef valt. Alles wat daar ook
   maar iets van mist, draait.

   WAT DIT NIET DOET, EN WAT HET NOOIT MAG GAAN DOEN. Het zet geen toets uit, het
   verlaagt geen eis en het geeft geen oordeel over de code. Het beantwoordt
   uitsluitend de vraag welk bewijs er AL is. Wie de uitkomst niet vertrouwt,
   draait de hele suite -- en dat moet altijd kunnen blijven.

   GEBRUIK
     node scripts/plan.js              het plan, met de redenen
     node scripts/plan.js --json       hetzelfde, machinaal leesbaar
     node scripts/plan.js --alles      toon ook de toetsen die zouden erven
     node scripts/plan.js --basis <ref>  meet tegen een andere basis
     node scripts/plan.js --vastleggen leg de huidige stand vast als bewijs
                                       (alleen draaien NA een volledig groene ronde)
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { index } = require('./lib/werkelijkheid');
const semdiff = require('./lib/semdiff');
const risico = require('./lib/risico');
const bb = require('./lib/bewijsboek');

const WORTEL = path.join(__dirname, '..');
const ARG = process.argv.slice(2);
const heeft = (v) => ARG.includes(v);

/* WAT ER GEINDEXEERD WORDT. De '.' aan het eind zijn de LOSSE bestanden in de
   wortel -- de ratelregisters en de merkdocumenten. Zonder die staat een
   gewijzigde NORM.json buiten de index, en dan is elk oordeel onbetrouwbaar;
   dat is eerlijk maar het levert ook niets op. */
const MAPPEN = ['server', 'public', 'test', 'scripts', '.github', 'docs', '.'];

function toetsbestanden() {
  const uit = [];
  for (const n of fs.readdirSync(path.join(WORTEL, 'test'))) {
    if (/\.(?:test|e2e)\.js$/.test(n)) uit.push('test/' + n);
  }
  return uit.sort();
}

function plan() {
  const nu = Date.now();
  const iBasis = ARG.indexOf('--basis');
  const ix = index(MAPPEN);
  const omg = bb.omgeving();
  const boek = bb.lees();

  const wijziging = semdiff.diff(iBasis >= 0 ? ARG[iBasis + 1] : null);
  const gewijzigd = wijziging.bestanden.map((b) => b.pad);
  const ondergrens = wijziging.bestanden.reduce(
    (a, b) => semdiff.zwaarste(a, b.klasse), 'documentatie');

  const impact = risico.raak(ix, gewijzigd, {
    verwijderd: new Set(wijziging.bestanden.filter((b) => b.verwijderd).map((b) => b.pad)) });
  const oordeel = risico.klasseVan(impact, ondergrens);

  /* Waar een gewijzigd bestand niet in de index staat, is de impactverzameling
     niet compleet. Dan is er niets te erven -- niet minder, niets. */
  const alles = !impact.volledig;

  const toetsen = [];
  for (const t of toetsbestanden()) {
    const st = bb.stempel(ix, [t], omg);
    const sleutel = t;

    /* RAAKT DEZE TOETS IETS DAT VERANDERDE? Dat is de goedkope vraag en hij
       wordt eerst gesteld: als geen enkel bestand uit zijn leesbereik in de
       impactverzameling zit, is er niets gebeurd waar hij iets over zegt. */
    const geraakt = st.paden.filter((p) => impact.geraakt.has(p));

    let besluit;
    if (alles) {
      besluit = { draaien: true, reden: 'de impactverzameling is onvolledig: ' + oordeel.waarom };
    } else if (st.onbegrensd) {
      besluit = { draaien: true, reden: 'leest door een onoplosbare require heen (' + st.onbegrensd + ')' };
    } else if (geraakt.length) {
      const wat = geraakt.slice(0, 3).join(', ') + (geraakt.length > 3 ? ' en ' + (geraakt.length - 3) + ' meer' : '');
      besluit = { draaien: true, reden: 'leest wat er veranderde: ' + wat };
    } else {
      const g = bb.geldig(boek, sleutel, st.hash, omg, nu);
      besluit = { draaien: !g.erven, reden: g.reden };
    }
    toetsen.push({ toets: t, stempel: st.hash, leest: st.aantal, geraakt: geraakt.length, ...besluit });
  }

  return { nu, ix, omg, boek, wijziging, gewijzigd, ondergrens, impact, oordeel, toetsen };
}

/* ------------------------------------------------------------- vastleggen */
/* ALLEEN NA EEN VOLLEDIG GROENE RONDE. Er is met opzet geen manier om één toets
   met de hand op groen te zetten: een bewijsboek waar je in kunt schrijven zonder
   te draaien, is een verhaal en geen bewijs (PROOF.md par. 9). */
function vastleggen() {
  const nu = Date.now();
  const ix = index(MAPPEN);
  const omg = bb.omgeving();
  const boek = bb.lees();
  let bij = 0, over = 0;
  for (const t of toetsbestanden()) {
    const st = bb.stempel(ix, [t], omg);
    if (st.onbegrensd) { over++; continue; }        // hier valt niets te bewijzen
    boek.bewijzen[t] = { stempel: st.hash, uitkomst: 'groen', tijdstip: nu,
      leest: st.aantal, omgeving: omg.hash, onbegrensd: null };
    bij++;
  }
  boek.omgeving = { hash: omg.hash, dekking: omg.dekking, ongemeten: omg.ongemeten };
  bb.schrijf(boek);
  console.log('bewijsboek bijgewerkt: ' + bij + ' toets(en) vastgelegd, ' + over +
    ' overgeslagen (onbegrensde invoer).');
  console.log('omgeving ' + omg.hash + ', dekking ' + omg.dekking + '%, houdbaar ' +
    Math.round(bb.houdbaarheid(omg) / 3600000) + 'u.');
}

/* ------------------------------------------------------------------ tonen */
const dik = (t) => '\x1b[1m' + t + '\x1b[0m';
const zacht = (t) => '\x1b[2m' + t + '\x1b[0m';

function toon(p) {
  const draaien = p.toetsen.filter((t) => t.draaien);
  const erven = p.toetsen.filter((t) => !t.draaien);

  console.log(dik('\nHET PLAN') + zacht('  (basis ' + p.wijziging.basis.slice(0, 8) + ')'));

  console.log('\n  gewijzigd  ' + p.gewijzigd.length + ' bestand(en), ondergrens uit de vorm: ' + p.ondergrens);
  const perKlasse = {};
  for (const b of p.wijziging.bestanden) perKlasse[b.klasse] = (perKlasse[b.klasse] || 0) + 1;
  console.log(zacht('             ' + Object.entries(perKlasse).sort((a, b) =>
    semdiff.GEWICHT.indexOf(b[0]) - semdiff.GEWICHT.indexOf(a[0]))
    .map(([k, n]) => n + ' ' + k).join(', ')));

  console.log('\n  geraakt    ' + p.impact.geraakt.size + ' module(s) -- ' +
    p.impact.telling.zeker + ' zeker, ' + p.impact.telling.mogelijk + ' mogelijk, ' +
    p.impact.telling.onopgelost + ' onopgelost');
  console.log('  gebied     ' + p.impact.gebied + '  ->  klasse ' + dik(p.oordeel.klasse) +
    (p.oordeel.betrouwbaar ? '' : '  ' + zacht('(ONBETROUWBAAR: ' + p.oordeel.waarom + ')')));

  console.log('\n  omgeving   ' + p.omg.hash + ', dekking ' + p.omg.dekking + '% -- ' +
    p.omg.ongemeten.length + ' ongemeten (' + p.omg.ongemeten.join(', ') + ')');
  console.log(zacht('             daardoor is een bewijs ' +
    Math.round(bb.houdbaarheid(p.omg) / 3600000) + 'u houdbaar in plaats van ' +
    (bb.BASISDAGEN * 24) + 'u'));

  console.log('\n  ' + dik('toetsen    ' + draaien.length + ' draaien, ' + erven.length + ' geërfd') +
    '  (' + p.toetsen.length + ' totaal)');

  const per = {};
  for (const t of draaien) {
    const kop = t.reden.split(':')[0].split('(')[0].trim();
    (per[kop] = per[kop] || []).push(t);
  }
  for (const [kop, rij] of Object.entries(per).sort((a, b) => b[1].length - a[1].length)) {
    console.log('\n    ' + rij.length + '  ' + kop);
    for (const t of rij.slice(0, heeft('--alles') ? 999 : 3)) {
      console.log(zacht('       ' + t.toets.replace(/^test\//, '') + ' -- ' + t.reden));
    }
    if (!heeft('--alles') && rij.length > 3) console.log(zacht('       ... en nog ' + (rij.length - 3)));
  }

  if (erven.length) {
    console.log('\n    ' + erven.length + '  geërfd (zelfde invoer, zelfde omgeving)');
    for (const t of erven.slice(0, heeft('--alles') ? 999 : 5)) {
      console.log(zacht('       ' + t.toets.replace(/^test\//, '') + ' -- ' + t.reden));
    }
    if (!heeft('--alles') && erven.length > 5) console.log(zacht('       ... en nog ' + (erven.length - 5)));
  }

  /* HET SLOTOORDEEL, en het is met opzet somber gesteld: alleen wanneer er
     niets onbeoordeelbaars overblijft mag hier BEWEZEN staan. */
  const winst = p.toetsen.length ? Math.round((erven.length / p.toetsen.length) * 100) : 0;
  console.log('\n  ' + (erven.length && p.oordeel.betrouwbaar
    ? dik('\x1b[32mDEELS BEWEZEN\x1b[0m') + ' -- ' + winst + '% van de toetsen hoeft niet opnieuw'
    : dik('\x1b[33mNIETS TE ERVEN\x1b[0m') + ' -- alles draait') + '\n');
}

if (heeft('--vastleggen')) {
  vastleggen();
} else {
  const p = plan();
  if (heeft('--json')) {
    console.log(JSON.stringify({
      basis: p.wijziging.basis, gewijzigd: p.gewijzigd.length, ondergrens: p.ondergrens,
      klasse: p.oordeel.klasse, betrouwbaar: p.oordeel.betrouwbaar,
      geraakt: p.impact.geraakt.size, telling: p.impact.telling,
      omgeving: { hash: p.omg.hash, dekking: p.omg.dekking, ongemeten: p.omg.ongemeten },
      draaien: p.toetsen.filter((t) => t.draaien).map((t) => t.toets),
      erven: p.toetsen.filter((t) => !t.draaien).map((t) => t.toets)
    }, null, 2));
  } else {
    toon(p);
  }
}
