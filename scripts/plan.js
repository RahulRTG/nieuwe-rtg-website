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
const keuringreden = require('./lib/keuringreden');
const delen = require('./lib/delen');
const { prijzen } = require('./lib/duurprijs');
const { maakBatches, STANDAARD_MAX } = require('./lib/testbatches');
const { isGeisoleerd } = require('./lib/geisoleerd');
const { TOETSEN: PG_TOETSEN } = require('./lib/pg-toetslijst');

const WORTEL = path.join(__dirname, '..');
const MAPPEN = snapshotModule.STANDAARDMAPPEN;
/* De incrementele runners hebben ieder ook installatie-, bouw- en
   infrastructuurwerk. Van hun harde grenzen (50 en 30 minuten in ci.yml)
   blijft daarom tien minuten buiten het toetsbudget. Een selectie die hier
   niet in past gaat naar de BESTAANDE volledige scherven; er wordt geen bewijs
   weggelaten en geen timeout opgerekt. */
const INCREMENTEEL_BUDGET_MS = Object.freeze({ unit: 40 * 60 * 1000, e2e: 20 * 60 * 1000 });

function toetsbestanden() {
  return fs.readdirSync(path.join(WORTEL, 'test'))
    .filter((n) => /\.(?:test|e2e)\.js$/.test(n)).map((n) => 'test/' + n).sort();
}

function risicobaan(klasse) {
  if (klasse === 'besturing') return 'constitution';
  if (['authorization', 'money', 'security'].includes(klasse)) return 'sensitive';
  if (['implementation', 'contract', 'public API', 'schema'].includes(klasse)) return 'product';
  return 'light';
}

function modusbesluit(impact, telling, boek, bewijsMachineGewijzigd, capaciteit) {
  if (!impact.volledig) return { mode: 'full', code: 'impact-onvolledig',
    reden: 'de impactgraaf kan niet alle gewijzigde paden begrenzen' };
  if (telling.UNKNOWN === telling.REUSED + telling.REPROVE + telling.UNKNOWN && telling.UNKNOWN > 0) {
    return { mode: 'full', code: 'alle-bewijzen-onbekend',
      reden: 'geen enkel bewijs heeft begrensde invoer' };
  }
  /* DE BEWIJSMACHINE ZELF GEWIJZIGD: dan altijd volledig, ook als er bewijs
     "past". Dat bewijs is gemaakt door de oude machine (een andere
     test/helper.js, test-runner.js, ci.yml...), en hergebruik ervan bewijst
     niets over de nieuwe. Deze regel stond eerst binnen `!telling.REUSED` en
     gold dus alleen als er toch al niets te hergebruiken viel. Gevolg op
     13 oktober 2026: na de merge van #614 (test/helper.js) koos main de
     incrementele route met 1307 unit- en 332 browsertoetsen in elk EEN job,
     beide liepen tegen hun timeout, main kreeg geen nieuwe vertrouwde basis
     en elke PR daarna moest dezelfde berg opnieuw bewijzen. */
  if (bewijsMachineGewijzigd) return { mode: 'full', code: 'bewijsmachine-gewijzigd',
    reden: 'de code die bewijs selecteert of uitvoert is zelf gewijzigd' };
  if (capaciteit && !capaciteit.past) {
    const teBreed = ['unit', 'e2e'].filter((soort) => !capaciteit[soort].past)
      .map((soort) => soort + ' ' + Math.ceil(capaciteit[soort].geschatMs / 60000) +
        'm/' + Math.floor(capaciteit[soort].budgetMs / 60000) + 'm').join(', ');
    return { mode: 'full', code: 'incrementieel-te-breed',
      reden: 'de selectie past niet betrouwbaar in de onverdeelde runners (' + teBreed +
        '); gebruik de bestaande volledige scherven' };
  }
  if (!telling.REUSED) {
    if (boek && boek.ongeldig) return { mode: 'full', code: 'bewijsboek-ongeldig', reden: boek.ongeldig };
    if (!boek || !boek.bewijzen || Object.keys(boek.bewijzen).length === 0) {
      return { mode: 'full', code: 'geen-vertrouwd-bewijsboek',
        reden: 'geen vertrouwd content-addressed bewijsboek beschikbaar' };
    }
    return { mode: 'full', code: 'geen-geldig-hergebruik',
      reden: 'geen bewijsrecord past nog bij deze invoer en omgeving' };
  }
  return { mode: 'incremental', code: 'bewijs-hergebruikt',
    reden: telling.REUSED + ' bewijzen blijven inhoudelijk geldig' };
}

function belastingVan(namen, parallel, opties) {
  const o = opties || {};
  if (!namen.length) return { bestanden: 0, geschatMs: 0, gemeten: 0, ongemeten: 0 };
  const kaart = delen.gewichtenVoor(namen);
  const prijs = prijzen(kaart.gewicht, { andere: kaart.andere });
  const kost = (naam) => kaart.gewicht.get(naam) || prijs.prijsVoor(naam);
  const batches = o.batches
    ? maakBatches(namen, { maxBestanden: STANDAARD_MAX, gewicht: kost })
    : [namen];
  let geschatMs = 0;
  for (const batch of batches) {
    const bakken = delen.indeling(batch, Math.max(1, parallel));
    geschatMs += Math.max(0, ...bakken.map((bak) => bak.reduce((som, naam) => som + kost(naam), 0)));
  }
  return { bestanden: namen.length, geschatMs: Math.round(geschatMs),
    gemeten: namen.filter((naam) => kaart.gewicht.has(naam)).length,
    ongemeten: namen.filter((naam) => !kaart.gewicht.has(naam)).length };
}

/* De projectie gebruikt exact dezelfde gewichten, onbekend-prijs, batches en
   isolatielijst als de uitvoerders. Dit is een capaciteitsbesluit en geen
   bewijsbesluit: te groot betekent VOLLEDIG en dus dezelfde toetsen over de
   bestaande scherven, nooit minder toetsen. */
function werkbelasting(toetsen, budgetten) {
  const budget = { ...INCREMENTEEL_BUDGET_MS, ...(budgetten || {}) };
  const draaien = (toetsen || []).filter((t) => t.status !== 'REUSED')
    .map((t) => path.basename(t.toets));
  /* De incrementele unitrunner stelt de canonieke PostgreSQL-lijst uit aan de
     verplichte PG-job in dezelfde keten (suite-pg.js). Alleen wat werkelijk in
     deze onverdeelde runner komt, hoort dus tegen zijn 40-minutenbudget. */
  const pg = new Set(PG_TOETSEN.map((naam) => path.basename(naam)));
  const unit = draaien.filter((naam) => naam.endsWith('.test.js') && !pg.has(naam));
  const gewoon = unit.filter((naam) => !isGeisoleerd(naam));
  const geisoleerd = unit.filter(isGeisoleerd);
  const unitGewoon = belastingVan(gewoon, 4, { batches: true });
  const unitGeisoleerd = belastingVan(geisoleerd, 1);
  const unitUit = {
    bestanden: unit.length,
    geschatMs: unitGewoon.geschatMs + unitGeisoleerd.geschatMs,
    gemeten: unitGewoon.gemeten + unitGeisoleerd.gemeten,
    ongemeten: unitGewoon.ongemeten + unitGeisoleerd.ongemeten,
    budgetMs: budget.unit
  };
  const e2eNamen = draaien.filter((naam) => naam.endsWith('.e2e.js'));
  const e2eUit = { ...belastingVan(e2eNamen, 1), budgetMs: budget.e2e };
  unitUit.past = unitUit.geschatMs <= unitUit.budgetMs;
  e2eUit.past = e2eUit.geschatMs <= e2eUit.budgetMs;
  return { unit: unitUit, e2e: e2eUit, past: unitUit.past && e2eUit.past };
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
  const capaciteit = werkbelasting(toetsen, o.budgetten);
  const besluit = o.forceFull ? { mode: 'full', code: 'volledige-ijking-afgedwongen',
    reden: 'deze ronde kalibreert het selectieve bewijs tegen de volledige werkelijkheid' }
    : modusbesluit(impact, telling, boek, bewijsMachineGewijzigd, capaciteit);
  const baan = risicobaan(oordeel.klasse);
  /* Welke regels er afgingen, uitgeschreven (ARCHITECTOPDRACHT.md fase 6).
     Dit besluit niets; het maakt het besluit hierboven navolgbaar. */
  const redenen = keuringreden.redenen({ wijziging, impact, oordeel, besluit, mode: besluit.mode, telling, gewijzigd });
  return { formaat: 'rtg-evidence-plan-v2', gemaakt: new Date(nu).toISOString(),
    basis: wijziging.basis, snapshot: { rootHash: snapshot.rootHash,
      bestanden: snapshot.aantalBestanden, duurMs: Math.round(snapshot.duurMs) },
    wijziging, gewijzigd, ondergrens, impact, oordeel, bewijsMachineGewijzigd, omgeving: volledigOmgeving,
    boek: { versie: boek.versie || 1, ongeldig: boek.ongeldig || null,
      bewijzen: Object.keys(boek.bewijzen || {}).length },
    telling, capaciteit, mode: besluit.mode, besluit, baan, gedwongenVolledig: !!o.forceFull, redenen, toetsen };
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
  let controlHash = null;
  const controlPad = process.env.RTG_CONTROL_FILE;
  if (controlPad) {
    const control = JSON.parse(fs.readFileSync(path.resolve(WORTEL, controlPad), 'utf8'));
    if (!control.controlHash) throw new Error('Evidence Control Plane mist controlHash');
    controlHash = control.controlHash;
  }
  const provenance = { vertrouwd: true, commit: commit(), run: process.env.GITHUB_RUN_ID || null,
    bron: process.env.GITHUB_ACTIONS ? 'github-main-clean-room' : 'lokale-clean-room',
    controlHash };
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
    besluit: p.besluit, baan: p.baan, gedwongenVolledig: p.gedwongenVolledig, redenen: p.redenen,
    impactClaims: [...p.impact.geraakt].map(([pad, staat]) => ({ pad, ...staat })),
    telling: p.telling, capaciteit: p.capaciteit,
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
  console.log('  route     ' + p.baan + ' · ' + p.besluit.code + ': ' + p.besluit.reden);
  if (p.redenen) {
    console.log('\n  AFGEGANE REGELS (de strengste wint' + (p.redenen.klopt.ja ? '' : '; NAREKENING WIJKT AF: ' + p.redenen.klopt.strengste) + ')');
    for (const r of p.redenen.regels) {
      console.log('    ' + (r.wet || '(geen wet: ' + r.bron + ')') + '  ' + r.regel + (r.klasse ? ' -> ' + r.klasse : '') + '  [' + r.graad + ']  ' + JSON.stringify(r.gemeten).slice(0, 120));
    }
  }
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
      const p = plan({ basis: waarde('--basis'),
        forceFull: args.includes('--full') || process.env.RTG_FORCE_FULL === '1' });
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

module.exports = { plan, vastleggen, serialiseer, schrijfUitvoer, toetsbestanden,
  risicobaan, modusbesluit, werkbelasting, belastingVan, INCREMENTEEL_BUDGET_MS, MAPPEN };
