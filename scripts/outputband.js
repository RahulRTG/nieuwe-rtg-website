#!/usr/bin/env node
/* ============================================================================
   DE LOPENDE BAND -- de OUTPUT-as parallel gericht meten.

   WAAROM DIT ER IS. scripts/outputproef.js --meet=N meet N routes ACHTER
   ELKAAR, en elke meting is een echte suite-start van ~13 seconden. Voor de
   ruim vierduizend onbesliste routes is dat meer dan een dag op een kern,
   terwijl deze machine er vier heeft. Deze band verdeelt het werk over
   meerdere werkers en houdt EEN schrijver op het register, zodat er geen twee
   processen tegelijk in OUTPUTPROEF.json schrijven.

   HET IS GEEN TWEEDE METING. De selectie (kiesKandidaten) en de meting zelf
   (meetEen, met de controlerun tegen vals MERKT) komen allebei uit
   scripts/outputproef.js -- deze band bepaalt alleen WIE WAT WANNEER doet, niet
   WAT een meting betekent (LAT.md regel 4).

   DE BASISLIJN IS GEMEMORISEERD, NIET EEN FASE. Een eerdere versie mat eerst
   alle 468 betrokken toetsen op hun basislijn (groen zonder leugen) en dan pas
   de routes. Dat kostte ruim anderhalf uur vooraf -- en deze omgeving herstart
   de container vaker dan dat: elke herstart wierp de hele basislijn weg, zodat
   hij NOOIT afkwam. Nu betaalt de EERSTE route die een toets aanraakt zijn
   controlerun; het resultaat (groen/rood) komt in het register te staan, en
   elke volgende route met dezelfde toets leest het daar. Omdat het register
   periodiek wordt gecommit, overleeft die basislijn een herstart. Geen fase die
   als geheel verloren gaat -- alleen de laatste paar routes sinds de vorige
   schrijfbeurt.

   DE WERKER IS DIT BESTAND ZELF, met --een="METHODE /pad|toets|groen?". Hij
   meet precies een route en print een JSON-regel; hij raakt het register niet
   aan. Zo blijft de schrijver enkelvoudig en is een werker die omvalt (time-out,
   wees na een herstart) niet erger dan een route die opnieuw in de wachtrij
   komt.

   Draai:  node scripts/outputband.js --werkers=3
           node scripts/outputband.js --werkers=3 --max=500
           node scripts/outputband.js --een="POST /api/x|y.test.js|groen"
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const op = require('./outputproef');
const B = require('./lib/outputbinding');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'OUTPUTPROEF.json');
const argv = process.argv.slice(2);
const journal = path.resolve((argv.find(a => a.startsWith('--lees=')) || '').slice(7) || path.join(WORTEL, '.routejournaal'));
let runBinding, evidenceDir;
function prepare() {
  if (['.env', 'server/.env'].some(file => fs.existsSync(path.join(WORTEL, file))))
    throw Error('Use an isolated checkout without local environment secrets.');
  if (['DATABASE_URL', 'PG_URL', 'RTG_DATA_DIR', 'RTG_LIEG'].some(key => process.env[key]))
    throw Error('Output proof must run without inherited database, data-directory or mutation targets.');
  runBinding = B.binding(journal);
  evidenceDir = path.resolve((argv.find(a => a.startsWith('--bewijs-dir=')) || '').slice(13) || path.join(WORTEL, 'server/data/output-proof', runBinding.id));
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'BINDING.json'), JSON.stringify(runBinding, null, 2) + '\n');
}
function unchanged() {
  if (B.binding(journal).id !== runBinding.id) throw Error('Candidate or journal changed during the proof.');
}

/* ---- DE WERKER: een route, een regel JSON ----
   `groen` in het derde veld zegt dat de basislijn van deze toets al bekend en
   groen is; dan slaat meetEen de controlerun over. Staat er niets, dan is de
   basislijn onbekend en doet meetEen de controle EN meldt wat hij zag (`basis`),
   zodat de coordinator het kan onthouden. */
const eenArg = (argv.find(a => a.startsWith('--een=')) || '').slice(6);
if (eenArg) {
  prepare();
  const delen = eenArg.split('|');
  const route = delen[0];
  const toets = delen[1];
  const recorded = JSON.parse(fs.readFileSync(REGISTER, 'utf8')).basislijn?.[toets];
  const basisGroen = delen[2] === 'groen' && B.currentBaseline(recorded, runBinding.id) ? new Set([toets]) : undefined;
  let uit;
  try { uit = op.meetEen(route, toets, { basisGroen, requireHit: true }); unchanged(); }
  catch (e) { uit = { staat: 'stoornis', fout: String((e && e.message) || e) }; }
  process.stdout.write(JSON.stringify({ route, toets, ...uit, binding: runBinding.id, evidenceCommit: runBinding.commit, op: new Date().toISOString() }) + '\n');
  process.exitCode = 0;
  return;
}

/* ---- DE COORDINATOR ---- */
if (require.main !== module) { module.exports = {}; return; }

const werkers = Math.max(1, Number((argv.find(a => a.startsWith('--werkers=')) || '').slice(10)) || 4);
const max = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;
/* DE BLINDENRONDE (--blind). De gewone rij komt uit kiesKandidaten en eist een
   toets die de mutatiemotor al gevoelig heeft bevonden; de inhoudswacht
   (test/inhoudswacht.test.js) is daar te nieuw voor. Maar de gerichte meting
   zelf heeft die eis niet: liegen over EEN route en kijken of de wacht zakt is
   direct bewijs, motor of geen motor. In deze stand is de rij dus: elke route
   die op blind staat EN een waarneembaar profiel in INHOUDSKAART.json heeft,
   met de inhoudswacht als toets -- en de oude blinde uitslag telt niet als "al
   gemeten", want die is precies wat we willen vervangen. */
const blindStand = argv.includes('--blind');
const WACHT = 'inhoudswacht.test.js';

function leesRegister() {
  try { return JSON.parse(fs.readFileSync(REGISTER, 'utf8')); }
  catch (e) { return {}; }
}

/* Het register herbouwen met de verse gerichte metingen en de gememoriseerde
   basislijn erin. meet(versGericht) rekent de OUTPUT-cellen opnieuw en houdt de
   rest intact; `basislijn` hangen we er als apart veld naast, zodat een herstart
   hem terugvindt. */
function schrijf(gericht, basislijn) {
  unchanged();
  const na = op.meet(gericht);
  if (na.fout) { console.error('  ' + na.fout); return na; }
  const thin = op.teDun(na, leesRegister()); if (thin) throw Error(thin);
  const previous = leesRegister();
  na.basislijnHistorisch = { ...(previous.basislijnHistorisch || {}),
    ...Object.fromEntries(Object.entries(previous.basislijn || {}).filter(([, value]) => !value || value.binding !== runBinding.id)) };
  na.binding = runBinding;
  na.claimValidity = { currentCandidate: Object.values(gericht).filter(v => v.binding === runBinding.id).length,
    historicalUnrevalidated: Object.values(gericht).filter(v => v.binding !== runBinding.id).length,
    note: 'Historical route outcomes retain their original provenance and are not proof for this candidate.' };
  fs.writeFileSync(REGISTER, JSON.stringify(Object.assign(na, { gericht, basislijn }), null, 1) + '\n');
  return na;
}

/* ASYNCHROON, EN DAT IS DE HELE WINST. spawnSync blokkeert de event-loop tot het
   kind klaar is; met drie "werkers" die allemaal spawnSync doen draait er in
   werkelijkheid maar EEN tegelijk -- serieel, met een extra proceslaag eromheen,
   dus trager dan de kale --meet-lus. Met spawn (async) lopen de drie kinderen
   echt naast elkaar en telt de machine zijn kernen mee. */
function eenRegel(args) {
  return new Promise((resolve) => {
    const kind = spawn(process.execPath, [__filename].concat(args, ['--lees=' + journal, '--bewijs-dir=' + evidenceDir]),
      { cwd: WORTEL });
    let uit = '';
    const dood = setTimeout(() => { try { kind.kill('SIGKILL'); } catch (e) {} }, 300000);
    kind.stdout.on('data', (d) => { uit += d; });
    kind.on('close', () => {
      clearTimeout(dood);
      const regel = uit.trim().split('\n').filter(Boolean).pop();
      if (!regel) return resolve(null);
      try { resolve(JSON.parse(regel)); } catch (e) { resolve(null); }
    });
    kind.on('error', () => { clearTimeout(dood); resolve(null); });
  });
}

(async () => {
  prepare();
  const reg = leesRegister();
  const gericht = Object.fromEntries(Object.entries(reg.gericht || {}).map(([route, value]) => [route, {
    ...value, evidenceCommit: value.evidenceCommit || reg.stempel?.commit || null,
    provenance: value.binding === runBinding.id ? 'CURRENT_CANDIDATE' : 'HISTORICAL_UNREVALIDATED' }]));
  let kandidaten;
  if (blindStand) {
    let kaart;
    try { kaart = JSON.parse(fs.readFileSync(path.join(WORTEL, 'INHOUDSKAART.json'), 'utf8')); }
    catch (e) { console.error('geen INHOUDSKAART.json; draai eerst scripts/inhoudskaart.js'); process.exitCode = 2; return; }
    /* De rij komt uit de KAART: elke waarneembare route die nog geen merkt
       draagt. Dat dekt de blinde routes (oude uitslag vervangen) EN de
       onbesliste (nooit een gericht-rij gehad) in een beweging. */
    kandidaten = Object.keys(kaart.perRoute || {})
      .filter(route => !kaart.perRoute[route].onwaarneembaar)
      .filter(route => !gericht[route] || !gericht[route].merkt)
      .map(route => ({ route, toets: WACHT, breedte: 0 }));
  } else {
    kandidaten = op.kiesKandidaten();
    if (!kandidaten) { console.error('geen journaal of geen MUTATIES.json'); process.exitCode = 2; return; }
  }
  const rij = max ? kandidaten.slice(0, max) : kandidaten;
  /* De basislijn uit het register terug in een Map, zodat een herstart de al
     gemeten toetsen niet opnieuw controleert. */
  const basislijn = new Map(Object.entries(reg.basislijn || {}).filter(([, value]) => value && value.binding === runBinding.id));

  console.log('\n=== DE LOPENDE BAND ===\n');
  console.log('  ' + rij.length + ' routes in de rij, ' + werkers + ' werkers naast elkaar');
  console.log('  basislijn al bekend voor ' + basislijn.size + ' toetsen\n');

  let volgende = 0, klaar = 0, merkt = 0, blind = 0, stoornis = 0;
  const begin = Date.now();
  let sindsSchrijf = 0;
  /* ELKE VIJF ROUTES WEGSCHRIJVEN. De container van deze omgeving herstart bij
     elke sessie-resume, en dan sneuvelt de band midden in de rij. De WERKBOOM
     overleeft dat wel (gemeten: het register stond op 161 terwijl de laatste
     commit 103 droeg), dus de schrijfbeurt is de echte reddingslijn en niet de
     commit. Bij vijf routes kost een herstart hooguit een minuut meetwerk; het
     herrekenen van het register is goedkoop genoeg om dat te dragen. */
  const bundel = 5;

  function bewaar() {
    schrijf(gericht, Object.fromEntries(basislijn));
    sindsSchrijf = 0;
  }

  // Evidence tooling never stages, commits or pushes source or results.
  // The caller reviews and records the generated register explicitly.

  async function werker(nr) {
    while (volgende < rij.length) {
      const i = volgende++;
      const d = rij[i];
      /* Al gemeten (herstart/overlap). In de blindenronde telt de oude blinde
         uitslag niet: die vervangen we juist. Wat daar WEL telt: de route is
         inmiddels merkt, of de wacht heeft hem deze ronde al gehad. */
      const oude = gericht[d.route];
      if (oude && (!blindStand || oude.merkt || oude.toets === WACHT)) { klaar++; continue; }

      /* WAT WEET DE BASISLIJN VAN DEZE TOETS?
           groen    -> geef 'groen' mee, de werker slaat de controle over
           rood     -> geen enkele route van een rode toets valt toe te rekenen;
                       niet eens uitdelen, meteen stoornis
           onbekend -> de werker doet de controle en meldt wat hij zag */
      const basis = basislijn.get(d.toets);
      if (basis && basis.staat === 'rood') { klaar++; stoornis++; continue; }

      const u = (await eenRegel(['--een=' + d.route + '|' + d.toets + '|' + (B.currentBaseline(basis, runBinding.id) ? 'groen' : 'onbekend')])) ||
        { route: d.route, toets: d.toets, staat: 'stoornis', basis: null };
      klaar++; sindsSchrijf++;

      /* Wat de werker over de basislijn zag, onthouden -- ook 'rood', zodat de
         volgende route met deze toets niet nog een keer wordt geprobeerd. */
      if (u.basis === 'groen' || u.basis === 'rood') basislijn.set(d.toets,
        { staat: u.basis, binding: runBinding.id, execution: u.evidence?.control || null });
      fs.writeFileSync(path.join(evidenceDir, B.digest(d.route) + '.json'), JSON.stringify(u, null, 2) + '\n');

      if (u.staat === 'merkt') { merkt++; gericht[d.route] = { ...u, merkt: true, provenance: 'CURRENT_CANDIDATE' }; }
      else if (u.staat === 'blind') { blind++; gericht[d.route] = { ...u, merkt: false, provenance: 'CURRENT_CANDIDATE' }; }
      else stoornis++;   // stoornis: niets vastleggen, komt vanzelf terug in een latere ronde

      const verstreken = (Date.now() - begin) / 1000;
      const tempo = klaar / verstreken;
      const rest = tempo > 0 ? Math.round((rij.length - klaar) / tempo / 60) : '?';
      const label = u.staat === 'merkt' ? 'MERKT ' : u.staat === 'blind' ? 'blind ' : 'STOORN';
      process.stdout.write('  ' + String(klaar).padStart(5) + '/' + rij.length + '  w' + nr + '  ' +
        label + '  ' + d.route.slice(0, 52).padEnd(54) + '  ~' + rest + ' min\n');
      if (sindsSchrijf >= bundel) bewaar();

    }
  }

  await Promise.all(Array.from({ length: werkers }, (_, n) => werker(n + 1)));
  const na = schrijf(gericht, Object.fromEntries(basislijn));

  console.log('\n  ' + merkt + ' merken, ' + blind + ' blind, ' + stoornis + ' stoornis.');
  if (na && na.gemeten) console.log('  register nu: ' + JSON.stringify(na.gemeten));
  console.log('  BAND KLAAR');
  process.exitCode = stoornis ? 1 : 0;
})().catch(e => { console.error('de band viel om: ' + (e && e.stack || e)); process.exitCode = 2; });
