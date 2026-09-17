#!/usr/bin/env node
'use strict';

/* ============================================================================
   HET INCREMENTELE BEWIJSPLAN

   git diff -> RepositorySnapshot -> Evidence DAG -> REUSED / REPROVE / UNKNOWN

   REUSED   alle content-addressed bewijsinvoer is gelijk en de herkomst is een
            vertrouwde, volledige groene ronde.
   REPROVE  de bewijsgrond veranderde of er is nog geen bewijs.
   UNKNOWN  de impact of invoer is niet aantoonbaar begrensd; fail-closed.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const snapshotModule = require('./lib/repository-snapshot');
const evidenceDag = require('./lib/evidence-dag');
const semdiff = require('./lib/semdiff');
const risico = require('./lib/risico');
const bb = require('./lib/bewijsboek');

const WORTEL = path.join(__dirname, '..');
const MAPPEN = snapshotModule.STANDAARDMAPPEN;

function toetsbestanden() {
  return fs.readdirSync(path.join(WORTEL, 'test'))
    .filter((n) => /\.(?:test|e2e)\.js$/.test(n)).map((n) => 'test/' + n).sort();
}

function plan(opties) {
  const o = opties || {};
  const nu = o.nu || Date.now();
  const snapshot = o.snapshot || snapshotModule.maak(MAPPEN);
  const toetsenlijst = o.toetsen || toetsbestanden();
  const dag = evidenceDag.bouw(snapshot, toetsenlijst);
  const volledigOmgeving = o.omgeving || bb.omgeving();
  const boek = o.boek || bb.lees();
  const wijziging = o.wijziging || semdiff.diff(o.basis || null);
  const gewijzigd = wijziging.bestanden.map((b) => b.pad);
  const ondergrens = wijziging.bestanden.reduce(
    (a, b) => semdiff.zwaarste(a, b.klasse), 'documentatie');
  const impact = risico.raak(snapshot.index, gewijzigd, {
    verwijderd: new Set(wijziging.bestanden.filter((b) => b.verwijderd).map((b) => b.pad)) });
  const oordeel = risico.klasseVan(impact, ondergrens);
  const bewijsMachineGewijzigd = gewijzigd.some((pad) =>
    /^(?:\.github\/workflows\/ci\.yml|\.nvmrc|package-lock\.json|scripts\/(?:plan|evidence|evidence-base|evidence-gate|browser-host|test-runner|e2e)\.js|scripts\/lib\/(?:bewijsboek|evidence-dag|repository-snapshot|werkelijkheid|risico|semdiff)\.js|test\/helper\.js)$/.test(pad));

  const toetsen = toetsenlijst.map((toets) => {
    const omgeving = bb.omgevingVoor(toets, volledigOmgeving);
    const stempel = bb.stempel(snapshot.index, [toets], omgeving);
    const invoer = dag.bewijsInvoer(toets);
    stempel.invoerHash = invoer.hash;
    const geraakt = stempel.paden.filter((p) => impact.geraakt.has(p));
    let status, reden;

    if (bewijsMachineGewijzigd) {
      status = 'REPROVE'; reden = 'de bewijsmachine of haar runtime-contract veranderde';
    } else if (!impact.volledig) {
      status = 'UNKNOWN'; reden = 'impactverzameling is onvolledig: ' + oordeel.waarom;
    } else if (stempel.onbegrensd || invoer.onbekend) {
      status = 'UNKNOWN'; reden = 'bewijsinvoer is onbegrensd' + (stempel.onbegrensd ? ': ' + stempel.onbegrensd : '');
    } else if (geraakt.length) {
      status = 'REPROVE';
      reden = 'bewijsgrond veranderde: ' + geraakt.slice(0, 3).join(', ') +
        (geraakt.length > 3 ? ' en ' + (geraakt.length - 3) + ' meer' : '');
    } else {
      const geldig = bb.geldig(boek, toets, stempel.hash, omgeving, nu);
      status = geldig.status || (geldig.erven ? 'REUSED' : 'REPROVE');
      reden = geldig.reden;
    }
    return { toets, status, draaien: status !== 'REUSED', reden,
      bewijsSleutel: bb.bewijsSleutel(toets, stempel.hash, omgeving.hash),
      stempel: stempel.hash, invoerHash: invoer.hash, omgeving: omgeving.hash,
      profiel: omgeving.profiel, leest: stempel.aantal, geraakt: geraakt.length,
      onbegrensd: stempel.onbegrensd || null };
  });

  const telling = { REUSED: 0, REPROVE: 0, UNKNOWN: 0 };
  for (const toets of toetsen) telling[toets.status]++;
  /* UNKNOWN maakt alleen ZIJN EIGEN bewijs verplicht. Pas als de impactvraag
     zelf onvolledig is, zijn alle toetsen UNKNOWN en wordt dit vanzelf full.
     Zo dwingt één toets met een dynamische loader niet 1.926 onafhankelijke
     bewijzen opnieuw af. */
  const mode = !impact.volledig || telling.UNKNOWN === toetsen.length || !telling.REUSED
    ? 'full' : 'incremental';
  return { formaat: 'rtg-evidence-plan-v2', gemaakt: new Date(nu).toISOString(),
    basis: wijziging.basis, snapshot: { rootHash: snapshot.rootHash,
      bestanden: snapshot.aantalBestanden, duurMs: Math.round(snapshot.duurMs) },
    wijziging, gewijzigd, ondergrens, impact, oordeel, bewijsMachineGewijzigd, omgeving: volledigOmgeving,
    boek: { versie: boek.versie || 1, ongeldig: boek.ongeldig || null },
    telling, mode, toetsen };
}

function commit() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: WORTEL, encoding: 'utf8' }).trim(); }
  catch (e) { return null; }
}

function vastleggen(opties) {
  const o = opties || {};
  if (!o.vertrouwd && process.env.RTG_FULL_PROOF !== '1') {
    throw new Error('bewijs vastleggen vereist --trusted na een volledige groene clean-room-ronde');
  }
  const snapshot = o.snapshot || snapshotModule.maak(MAPPEN);
  const volledigOmgeving = o.omgeving || bb.omgeving();
  const boek = bb.nieuwBoek();
  const provenance = { vertrouwd: true, commit: commit(), run: process.env.GITHUB_RUN_ID || null,
    bron: process.env.GITHUB_ACTIONS ? 'github-main-clean-room' : 'lokale-clean-room' };
  let bij = 0, onbekend = 0;
  const lijst = toetsbestanden();
  const dag = evidenceDag.bouw(snapshot, lijst);
  for (const toets of lijst) {
    const omgeving = bb.omgevingVoor(toets, volledigOmgeving);
    const stempel = bb.stempel(snapshot.index, [toets], omgeving);
    stempel.invoerHash = dag.bewijsInvoer(toets).hash;
    if (stempel.onbegrensd) { onbekend++; continue; }
    boek.bewijzen[toets] = bb.bewijsRecord(toets, stempel, omgeving, 'groen', provenance);
    bij++;
  }
  boek.gemaakt = new Date().toISOString();
  boek.snapshot = snapshot.rootHash;
  boek.omgeving = { hash: volledigOmgeving.hash, dekking: volledigOmgeving.dekking,
    ongemeten: volledigOmgeving.ongemeten };
  boek.provenance = provenance;
  bb.schrijf(boek);
  return { vastgelegd: bij, onbekend, pad: bb.BOEK, snapshot: snapshot.rootHash, provenance };
}

function serialiseer(p) {
  return {
    formaat: p.formaat, gemaakt: p.gemaakt, basis: p.basis,
    snapshot: p.snapshot, gewijzigd: p.gewijzigd, ondergrens: p.ondergrens,
    klasse: p.oordeel.klasse, betrouwbaar: p.oordeel.betrouwbaar,
    geraakt: p.impact.geraakt.size, impactTelling: p.impact.telling,
    omgeving: { hash: p.omgeving.hash, dekking: p.omgeving.dekking,
      ongemeten: p.omgeving.ongemeten }, boek: p.boek, mode: p.mode,
    telling: p.telling,
    reused: p.toetsen.filter((t) => t.status === 'REUSED').map((t) => t.toets),
    reprove: p.toetsen.filter((t) => t.status === 'REPROVE').map((t) => t.toets),
    unknown: p.toetsen.filter((t) => t.status === 'UNKNOWN').map((t) => t.toets),
    toetsen: p.toetsen
  };
}

function toon(p, alles) {
  console.log('\nHET BEWIJSPLAN  ' + String(p.basis).slice(0, 8) + ' -> ' + p.mode.toUpperCase());
  console.log('  snapshot  ' + p.snapshot.bestanden + ' bestanden in ' + p.snapshot.duurMs + 'ms, ' + p.snapshot.rootHash.slice(0, 16));
  console.log('  wijziging ' + p.gewijzigd.length + ' bestand(en), klasse ' + p.oordeel.klasse);
  console.log('  bewijs    ' + p.telling.REUSED + ' REUSED · ' + p.telling.REPROVE +
    ' REPROVE · ' + p.telling.UNKNOWN + ' UNKNOWN');
  for (const status of ['UNKNOWN', 'REPROVE', 'REUSED']) {
    const rij = p.toetsen.filter((t) => t.status === status);
    if (!rij.length) continue;
    console.log('\n  ' + status + ' (' + rij.length + ')');
    for (const t of rij.slice(0, alles ? rij.length : 5)) console.log('    ' + t.toets + ' :: ' + t.reden);
    if (!alles && rij.length > 5) console.log('    … en ' + (rij.length - 5) + ' meer');
  }
}

function schrijfUitvoer(p, bestand) {
  fs.mkdirSync(path.dirname(path.resolve(bestand)), { recursive: true });
  fs.writeFileSync(bestand, JSON.stringify(serialiseer(p), null, 2) + '\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const waarde = (naam) => {
    const gelijk = args.find((a) => a.startsWith(naam + '='));
    if (gelijk) return gelijk.slice(naam.length + 1);
    const i = args.indexOf(naam); return i >= 0 ? args[i + 1] : null;
  };
  try {
    if (args.includes('--vastleggen')) {
      const uit = vastleggen({ vertrouwd: args.includes('--trusted') });
      console.log('bewijsboek: ' + uit.vastgelegd + ' vertrouwde bewijzen, ' + uit.onbekend + ' onbegrensd; ' + uit.pad);
    } else {
      const p = plan({ basis: waarde('--basis') });
      const out = waarde('--out');
      if (out) schrijfUitvoer(p, out);
      if (args.includes('--json')) console.log(JSON.stringify(serialiseer(p), null, 2));
      else toon(p, args.includes('--alles'));
    }
  } catch (e) {
    console.error('[bewijsplan] ' + e.message);
    process.exitCode = 1;
  }
}

module.exports = { plan, vastleggen, serialiseer, schrijfUitvoer, toetsbestanden, MAPPEN };
