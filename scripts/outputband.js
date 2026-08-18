#!/usr/bin/env node
/* ============================================================================
   DE LOPENDE BAND -- de OUTPUT-as parallel gericht meten.

   WAAROM DIT ER IS. scripts/outputproef.js --meet=N meet N routes ACHTER
   ELKAAR, en elke meting is een echte suite-start van ~13 seconden. Voor de
   ruim vierduizend onbesliste routes is dat meer dan een dag op een kern,
   terwijl deze machine er vier heeft. Deze band verdeelt het werk over meerdere
   werkers en houdt EEN schrijver op het register, zodat er geen twee processen
   tegelijk in OUTPUTPROEF.json schrijven.

   HET IS GEEN TWEEDE METING. De selectie (kiesKandidaten) en de meting zelf
   (meetEen, met de controlerun tegen vals MERKT) komen allebei uit
   scripts/outputproef.js -- deze band bepaalt alleen WIE WAT WANNEER doet, niet
   WAT een meting betekent. Een tweede oordeel hier zou binnen een week uiteen
   lopen met de seriele ronde (LAT.md regel 4).

   DE WERKER IS DIT BESTAND ZELF, met --een="METHODE /pad|toets". Hij meet
   precies een route en print een JSON-regel op stdout; hij raakt het register
   niet aan. Zo blijft de schrijver enkelvoudig en is een werker die omvalt
   (time-out, wees na een herstart) niet erger dan een route die opnieuw in de
   wachtrij komt.

   VEILIG STOPPEN EN HERVATTEN. Elke afgeronde route wordt METEEN in het
   register geschreven; valt de band halverwege om, dan is wat af is af, en de
   volgende start pikt op waar deze bleef (kiesKandidaten slaat het gemetene
   over). Geen batch die als geheel verloren gaat.

   Draai:  node --experimental-sqlite scripts/outputband.js --werkers=3
           node --experimental-sqlite scripts/outputband.js --werkers=3 --max=500
           node --experimental-sqlite scripts/outputband.js --een="POST /api/x|y.test.js"
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const op = require('./outputproef');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'OUTPUTPROEF.json');
const argv = process.argv.slice(2);

/* ---- DE WERKER: een route (of een basislijn-toets), een regel JSON ---- */
const eenArg = (argv.find(a => a.startsWith('--een=')) || '').slice(6);
const basisArg = (argv.find(a => a.startsWith('--basislijn=')) || '').slice(12);
if (basisArg) {
  let uit;
  try { uit = op.basislijnVan(basisArg); }
  catch (e) { uit = { toets: basisArg, groen: false, fout: String((e && e.message) || e) }; }
  process.stdout.write(JSON.stringify(uit) + '\n');
  process.exitCode = 0;
  return;
}
if (eenArg) {
  /* De route, de toets en de meegegeven basislijn (groen|onbekend). Staat er
     `groen` achter, dan is de toets in de basislijn groen bevonden en slaat de
     werker de controlerun over. */
  const delen = eenArg.split('|');
  const route = delen[0];
  const toets = delen[1];
  const basisGroen = delen[2] === 'groen' ? new Set([toets]) : undefined;
  let uit;
  try { uit = op.meetEen(route, toets, { basisGroen }); }
  catch (e) { uit = { staat: 'stoornis', fout: String((e && e.message) || e) }; }
  process.stdout.write(JSON.stringify({ route, toets, staat: uit.staat }) + '\n');
  process.exitCode = 0;
  return;
}

/* ---- DE COORDINATOR ---- */
if (require.main !== module) { module.exports = {}; return; }

const werkers = Math.max(1, Number((argv.find(a => a.startsWith('--werkers=')) || '').slice(10)) || 3);
const max = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;

/* Het register lezen en de gerichte metingen eruit halen; hier komt de schrijver
   vandaan die als enige aan OUTPUTPROEF.json mag komen. */
function leesGericht() {
  try { return JSON.parse(fs.readFileSync(REGISTER, 'utf8')).gericht || {}; }
  catch (e) { return {}; }
}

/* Het register herbouwen met de verse gerichte metingen erin. meet(versGericht)
   rekent de OUTPUT-cellen opnieuw en houdt de rest van het register intact. */
function schrijf(gericht) {
  const na = op.meet(gericht);
  if (na.fout) { console.error('  ' + na.fout); return na; }
  fs.writeFileSync(REGISTER, JSON.stringify(Object.assign(na, { gericht }), null, 1) + '\n');
  return na;
}

function eenRegel(args) {
  const r = spawnSync('node', ['--experimental-sqlite', __filename].concat(args),
    { cwd: WORTEL, encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024 });
  const regel = String(r.stdout || '').trim().split('\n').filter(Boolean).pop();
  if (!regel) return null;
  try { return JSON.parse(regel); } catch (e) { return null; }
}

function meetEenViaWerker(d, groen) {
  const merk = groen && groen.has(d.toets) ? 'groen' : 'onbekend';
  return eenRegel(['--een=' + d.route + '|' + d.toets + '|' + merk]) ||
    { route: d.route, toets: d.toets, staat: 'stoornis' };
}

(async () => {
  const kandidaten = op.kiesKandidaten();
  if (!kandidaten) { console.error('geen journaal of geen MUTATIES.json'); process.exitCode = 2; return; }
  const rij = max ? kandidaten.slice(0, max) : kandidaten;
  console.log('\n=== DE LOPENDE BAND ===\n');
  console.log('  ' + rij.length + ' routes in de rij, ' + werkers + ' werkers naast elkaar\n');

  /* ---- FASE 1: DE BASISLIJN ----

     Welke van de betrokken toetsen zijn groen ZONDER leugen. Een keer per toets
     in plaats van een keer per route: auth-rol.test.js raakt 194 routes, en de
     controlerun stelde daar 194 keer dezelfde vraag. De 482 toetsen kosten samen
     ongeveer wat 482 metingen kosten; daarna is elke route nog maar EEN lie-run.
     Een toets die hier al rood is, maakt zijn routes stoornis -- daar valt niets
     aan een leugen toe te rekenen. */
  const toetsen = [...new Set(rij.map(d => d.toets))];
  console.log('  fase 1: ' + toetsen.length + ' toetsen op hun basislijn (groen zonder leugen)\n');
  const groen = new Set();
  let bIdx = 0, bKlaar = 0, rood = 0;
  const bBegin = Date.now();
  async function basiswerker() {
    while (bIdx < toetsen.length) {
      const t = toetsen[bIdx++];
      const u = eenRegel(['--basislijn=' + t]) || { toets: t, groen: false };
      bKlaar++;
      if (u.groen) groen.add(t); else rood++;
      if (bKlaar % 25 === 0 || bKlaar === toetsen.length) {
        const tempo = bKlaar / ((Date.now() - bBegin) / 1000);
        const rest = tempo > 0 ? Math.round((toetsen.length - bKlaar) / tempo / 60) : '?';
        process.stdout.write('    basislijn ' + bKlaar + '/' + toetsen.length +
          '  (' + groen.size + ' groen, ' + rood + ' rood)  ~' + rest + ' min\n');
      }
    }
  }
  await Promise.all(Array.from({ length: werkers }, () => basiswerker()));
  console.log('\n  fase 2: ' + rij.length + ' routes, elk EEN lie-run\n');

  const gericht = leesGericht();
  let volgende = 0, klaar = 0, merkt = 0, blind = 0, stoornis = 0;
  const begin = Date.now();
  /* SCHRIJVEN GEBEURT IN DE COORDINATOR, en gebundeld: het register herrekenen
     is niet gratis (het leest het journaal), dus na elke afgeronde route in de
     rij wegschrijven zou het meten vertragen. Elke tien routes is vaak genoeg om
     een herstart weinig te laten verliezen. */
  let sindsSchrijf = 0;
  const bundel = 10;

  async function werker(nr) {
    while (volgende < rij.length) {
      const i = volgende++;
      const d = rij[i];
      /* Een route die intussen al door een ander is gemeten (herstart, overlap):
         overslaan, niet dubbel doen. */
      if (gericht[d.route]) { klaar++; continue; }
      const u = await Promise.resolve().then(() => meetEenViaWerker(d, groen));
      klaar++; sindsSchrijf++;
      if (u.staat === 'merkt') { merkt++; gericht[d.route] = { toets: d.toets, merkt: true, op: new Date().toISOString() }; }
      else if (u.staat === 'blind') { blind++; gericht[d.route] = { toets: d.toets, merkt: false, op: new Date().toISOString() }; }
      else stoornis++;   // stoornis: niets vastleggen, komt vanzelf terug in een latere ronde
      const verstreken = (Date.now() - begin) / 1000;
      const tempo = klaar / verstreken;
      const rest = tempo > 0 ? Math.round((rij.length - klaar) / tempo / 60) : '?';
      const label = u.staat === 'merkt' ? 'MERKT ' : u.staat === 'blind' ? 'blind ' : 'STOORN';
      process.stdout.write('  ' + String(klaar).padStart(5) + '/' + rij.length + '  w' + nr + '  ' +
        label + '  ' + d.route.slice(0, 52).padEnd(54) + '  ~' + rest + ' min\n');
      if (sindsSchrijf >= bundel) { sindsSchrijf = 0; schrijf(gericht); }
    }
  }

  await Promise.all(Array.from({ length: werkers }, (_, n) => werker(n + 1)));
  const na = schrijf(gericht);
  console.log('\n  ' + merkt + ' merken, ' + blind + ' blind, ' + stoornis + ' stoornis.');
  if (na && na.gemeten) console.log('  register nu: ' + JSON.stringify(na.gemeten));
  process.exitCode = 0;
})().catch(e => { console.error('de band viel om: ' + (e && e.stack || e)); process.exitCode = 2; });
