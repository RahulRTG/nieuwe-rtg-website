#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { vuileBoom } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const METING = path.join(WORTEL, 'LAATSTE_METING.json');
const NORM = path.join(WORTEL, 'NORM.json');
const MAP = path.join(WORTEL, '.release');
const START = path.join(MAP, 'beproeving-ci-start.json');
const OORDEEL = path.join(MAP, 'beproeving-ci-oordeel.json');
const CI_METING = path.join(MAP, 'beproeving-ci-meting.json');
const SCHEMA = 'rtg-beproeving-ci-bewijs-v1';
const PRESTATIES = Object.freeze({ p99Ms: 'omlaag', eventLoopP99Ms: 'omlaag' });

function schrijf(pad, waarde) {
  fs.mkdirSync(path.dirname(pad), { recursive: true });
  fs.writeFileSync(pad, JSON.stringify(waarde, null, 2) + '\n');
}

function leesJson(pad) {
  try { return { waarde: JSON.parse(fs.readFileSync(pad, 'utf8')) }; }
  catch (e) { return { fout: (fs.existsSync(pad) ? 'onleesbaar' : 'ontbreekt') + ': ' + e.message }; }
}

function gitVolledig(wortel = WORTEL) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd: wortel, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch (e) { return null; }
}

const nodeHoofdversie = versie => Number((/^v?(\d+)\./.exec(String(versie || '')) || [])[1]) || null;

function bron(meting) {
  const m = meting && meting.machine;
  if (!m) return null;
  return m.kernen + 'k/' + m.geheugenGB + 'g/' + m.platform + '/' + (meting.modus || '?');
}

function doelenUitNorm(norm, vandaag) {
  const fouten = [], doelen = {};
  const datum = String(vandaag || '').slice(0, 10);
  const nu = /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : null;
  if (!nu) fouten.push('de controledatum is geen geldige YYYY-MM-DD-datum');
  for (const [sleutel, richting] of Object.entries(PRESTATIES)) {
    const schulden = (Array.isArray(norm && norm.notities) ? norm.notities : []).filter(n =>
      n && n.soort === 'schuld' && n.sleutel === sleutel && typeof n.van === 'number' &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(n.vervalt || '')) && nu && String(n.vervalt) < nu);
    if (schulden.length) {
      const waarden = schulden.map(n => n.van);
      doelen[sleutel] = {
        waarde: richting === 'omlaag' ? Math.min(...waarden) : Math.max(...waarden),
        bron: 'verlopen schuld'
      };
      continue;
    }
    const waarde = norm && norm.prestatie && norm.prestatie[sleutel];
    if (typeof waarde !== 'number' || !Number.isFinite(waarde)) {
      fouten.push('NORM.json heeft geen numerieke prestatielat voor ' + sleutel);
    } else doelen[sleutel] = { waarde, bron: 'norm' };
  }
  return { doelen, fouten };
}

function vergelijkbaarKalibratie(huidig, basis, factor = 1.4) {
  if (!(Number.isFinite(huidig) && huidig > 0 && Number.isFinite(basis) && basis > 0)) return false;
  return Math.max(huidig / basis, basis / huidig) <= factor;
}

function isVers(meting, start, commit) {
  const s = meting && meting.stempel || {};
  return Boolean(meting && start && s.commit === commit &&
    s.instrument === 'scripts/beproeving.js' &&
    Date.parse(meting.gedraaid || '') >= Date.parse(start.gestart || ''));
}

function beoordeel({ meting, norm, start, verwachteCommit, verwachteNodeMajor = 26, vandaag }) {
  const fouten = [];
  const exact = String(verwachteCommit || '');
  if (!/^[0-9a-f]{40}$/i.test(exact)) fouten.push('commitverwachting is niet volledig');
  if (!meting || typeof meting !== 'object') fouten.push('meting mist bewijsobject');
  const stempel = meting && meting.stempel || {};
  if (stempel.commit !== exact) fouten.push('meting hoort bij commit ' + (stempel.commit || 'onbekend') + ', verwacht ' + (exact || 'onbekend'));
  if (stempel.boomVuil !== false) fouten.push('codeboom niet bewezen schoon');
  if (stempel.instrument !== 'scripts/beproeving.js') fouten.push('instrument is niet scripts/beproeving.js');
  if (nodeHoofdversie(stempel.node) !== Number(verwachteNodeMajor) ||
      nodeHoofdversie(meting && meting.machine && meting.machine.node) !== Number(verwachteNodeMajor)) {
    fouten.push('meting is niet volledig met Node ' + verwachteNodeMajor + ' gedaan');
  }
  if (!start || start.schema !== SCHEMA) fouten.push('CI-start ontbreekt');
  if (start && start.commit !== exact) fouten.push('CI-startcommit wijkt af');
  const gestart = Date.parse(start && start.gestart || '');
  const gemeten = Date.parse(meting && meting.gedraaid || '');
  if (!(Number.isFinite(gestart) && Number.isFinite(gemeten) && gemeten >= gestart)) {
    fouten.push('meting is niet nieuwer dan CI-start');
  }
  if (meting && meting.oordeel !== 'PASS') fouten.push('de Beproeving zelf gaf geen PASS maar ' + (meting.oordeel || 'geen oordeel'));
  if (meting && meting.gezakteDrempels !== 0) fouten.push('drempels gezakt');

  const gemetenBron = bron(meting);
  const normBron = norm && norm.prestatieBron;
  if (!normBron || gemetenBron !== normBron) {
    fouten.push('bron onvergelijkbaar: ' + (gemetenBron || '?') + ', norm ' + (normBron || '?'));
  }
  const basisKalibratie = norm && norm.prestatieKalibratie;
  const gemetenKalibratie = meting && meting.machine && meting.machine.kalibratieBasisMs;
  if (!vergelijkbaarKalibratie(gemetenKalibratie, basisKalibratie)) {
    fouten.push('kalibratie is niet vergelijkbaar: gemeten ' + (gemetenKalibratie ?? 'onbekend') +
      ' ms, norm ' + (basisKalibratie ?? '?') + ' ms (max factor 1,4)');
  }

  const doelUitkomst = doelenUitNorm(norm, vandaag);
  fouten.push(...doelUitkomst.fouten);
  const resultaten = {};
  for (const [sleutel, richting] of Object.entries(PRESTATIES)) {
    const werkelijk = meting && meting.meters && meting.meters[sleutel];
    const doel = doelUitkomst.doelen[sleutel];
    const numeriek = typeof werkelijk === 'number' && Number.isFinite(werkelijk);
    const gehaald = Boolean(numeriek && doel && (richting === 'omlaag' ? werkelijk <= doel.waarde : werkelijk >= doel.waarde));
    resultaten[sleutel] = { werkelijk: numeriek ? werkelijk : null, doel: doel ? doel.waarde : null,
      doelbron: doel ? doel.bron : null, gehaald };
    if (!numeriek) fouten.push('meting mist een numerieke ' + sleutel);
    else if (doel && !gehaald) fouten.push(sleutel + ' is ' + werkelijk + ' en betaalt de lat van ' + doel.waarde + ' niet af');
  }
  return { ok: fouten.length === 0, fouten, bron: gemetenBron, kalibratie: {
    gemeten: gemetenKalibratie ?? null, norm: basisKalibratie ?? null, maximaalFactor: 1.4
  }, doelen: doelUitkomst.doelen, resultaten };
}

function voorbereiden(env = process.env) {
  const gestart = new Date().toISOString();
  const commit = gitVolledig();
  const verwacht = String(env.RTG_BEPROEVING_EXPECTED_COMMIT || '');
  const fouten = [];
  if (!/^[0-9a-f]{40}$/i.test(verwacht)) fouten.push('verwachte commit is niet volledig');
  if (commit !== verwacht) fouten.push('HEAD is ' + (commit || 'onbekend') + ', verwacht ' + (verwacht || 'onbekend'));
  if (nodeHoofdversie(process.version) !== Number(env.RTG_BEPROEVING_NODE_MAJOR || 26)) fouten.push('de runner gebruikt ' + process.version + ', niet Node 26');
  const vuil = vuileBoom(WORTEL);
  if (!vuil) fouten.push('Git-werkboom onbekend');
  else if (vuil.code.length) fouten.push('ongecommitte code: ' + vuil.code.slice(0, 5).join(', '));

  const start = { schema: SCHEMA, gestart, commit, verwacht, node: process.version, fouten };
  schrijf(START, start);
  schrijf(CI_METING, {
    schema: 'rtg-beproeving-niet-gemeten-v1', gedraaid: gestart,
    stempel: { op: gestart, commit, boomVuil: vuil ? vuil.code.length > 0 : null,
      boomAnders: vuil ? vuil.anders.length : null, instrument: 'scripts/beproeving-ci-bewijs.js', node: process.version },
    oordeel: 'NIET_GEMETEN', gezakteDrempels: null, gezakteNamen: ['VOORCONTROLE'],
    reden: fouten.length ? fouten.join('; ') : 'wacht op de nieuwe Beproeving van deze CI-run'
  });
  try { fs.rmSync(OORDEEL, { force: true }); } catch (e) {}
  if (fouten.length) {
    for (const fout of fouten) console.error('FOUT: ' + fout);
    return 1;
  }
  console.log('Beproeving gebonden aan schone commit ' + commit + ' op Node ' + process.versions.node + '.');
  return 0;
}

function controleren(env = process.env) {
  const metingLees = leesJson(METING), normLees = leesJson(NORM), startLees = leesJson(START);
  const leesfouten = [];
  if (metingLees.fout) leesfouten.push('LAATSTE_METING.json ' + metingLees.fout);
  if (normLees.fout) leesfouten.push('NORM.json ' + normLees.fout);
  if (startLees.fout) leesfouten.push('startbinding ' + startLees.fout);
  const uitkomst = leesfouten.length ? { ok: false, fouten: leesfouten, resultaten: {} } : beoordeel({
    meting: metingLees.waarde, norm: normLees.waarde, start: startLees.waarde,
    verwachteCommit: env.RTG_BEPROEVING_EXPECTED_COMMIT,
    verwachteNodeMajor: Number(env.RTG_BEPROEVING_NODE_MAJOR || 26),
    vandaag: env.RTG_BEPROEVING_VANDAAG || new Date().toISOString().slice(0, 10)
  });
  const bewijs = Object.assign({ schema: SCHEMA, gecontroleerd: new Date().toISOString(),
    commit: env.RTG_BEPROEVING_EXPECTED_COMMIT || null }, uitkomst);
  /* Alleen bewijs uit DEZE run mag het publieke CI-artefact vervangen. */
  if (!metingLees.fout && !startLees.fout && isVers(metingLees.waarde, startLees.waarde,
    env.RTG_BEPROEVING_EXPECTED_COMMIT)) schrijf(CI_METING, metingLees.waarde);
  schrijf(OORDEEL, bewijs);
  for (const [naam, r] of Object.entries(bewijs.resultaten || {})) {
    console.log((r.gehaald ? 'PASS ' : 'FAIL ') + naam + ': ' + r.werkelijk + ' (lat ' + r.doel + ', ' + r.doelbron + ')');
  }
  if (!bewijs.ok) {
    for (const fout of bewijs.fouten) console.error('FOUT: ' + fout);
    return 1;
  }
  console.log('PASS: vergelijkbare prestatielatten bewezen.');
  return 0;
}
function hoofd() {
  if (process.argv.includes('--voorbereiden')) return voorbereiden();
  if (process.argv.includes('--controleer')) return controleren();
  console.error('Kies modus.');
  return 2;
}

if (require.main === module) process.exitCode = hoofd();
module.exports = { SCHEMA, PRESTATIES, bron, nodeHoofdversie, doelenUitNorm,
  vergelijkbaarKalibratie, isVers, beoordeel, voorbereiden, controleren };
