#!/usr/bin/env node
/* ============================================================================
   DE EFFECTDEKKING -- van hoeveel AI-bedienbare handelingen weet RTG wat zij
   veroorzaken?

   DE VRAAG DIE HIERONDER LIGT, en het is de vraag die een planner blokkeert: een
   plan mag alleen over handelingen gaan waarvan het gevolg voldoende bekend is.
   Vandaag is dat voor de meerderheid niet zo, en dat is GEMETEN en niet gevoeld --
   `server/kern/stuur/gevolg.js` leest de opslagmeting van IDEMPROEF.json en zegt
   per pad of de proef er uberhaupt bij kwam.

   TWEE ASSEN, EN ZE WORDEN NOOIT OPGETELD. Dezelfde vorm als
   scripts/machinedekking.js en scripts/kantoormacht.js, en om dezelfde reden:

     de METING     wat de proef zag veranderen (gemeten / geen-effect / onbekend)
     de VERKLARING het effectcontract van een mens (VOLLEDIG / GEDEELTELIJK / ONBEKEND)

   Een gemeten pad zonder contract weet WELKE collecties veranderen en niet wat dat
   betekent. Een contract zonder meting is een bewering. Pas samen zeggen ze iets --
   en juist daarom staan ze apart: een samengesteld getal zou verbergen welke van de
   twee bewoog. BEWIJSMACHINE.md verbiedt dat enkele getal boven een scorecard.

   ER KOMT DUS GEEN PERCENTAGE. Wat er wel komt zijn absolute tellers die maar een
   kant op mogen:

     onbekendeEffectpaden   moet DALEN  (vandaag 87 van 173 bereikbare paden)
     contractVolledig       mag STIJGEN
     contractGedeeltelijk   is een tussenstand en zegt alleen iets naast de andere twee

   DE BEREIKBAARHEID KOMT LIVE UIT `beleid.js` EN NIET UIT EXECUTION_MAP.json. Die
   kaart is een bouwartefact dat een commit kan achterlopen; ./plan.js heeft
   daarvoor al een toets die zakt zodra het oordeel uit de kaart komt in plaats van
   uit het beleid. Dezelfde regel hier.

   Draai:  node scripts/effectdekking.js
           node scripts/effectdekking.js --vastleggen
           node scripts/effectdekking.js --controle     (zakt als de tellers verkeerd bewegen)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'EFFECTDEKKING.json');
const { stempel } = require('./lib/stempel');
const { alleRoutes, isSchakel } = require('./lib/routes');

const beleid = require(path.join(WORTEL, 'server/kern/stuur/beleid.js'));
const gevolg = require(path.join(WORTEL, 'server/kern/stuur/gevolg.js'));
const contract = require(path.join(WORTEL, 'server/kern/stuur/effectcontract.js'));
const { CONTRACTEN } = require(path.join(WORTEL, 'server/kern/stuur/effectcontract/register.js'));

const argv = process.argv.slice(2);
const vastleggen = argv.includes('--vastleggen');
const controle = argv.includes('--controle');

/* De drie rollen die het AI-stuur kent. Ze komen uit beleid.js zelf, want een
   vierde rol erbij hoort deze meting mee te laten groeien. */
const ROLLEN = Object.keys(beleid.LEZEN || {});

function meet() {
  const paden = new Map();      // pad -> { rollen: Set, niveau }
  for (const r of alleRoutes()) {
    if (!r.pad.startsWith('/api/') || String(r.methode).toUpperCase() === 'GET') continue;
    if (isSchakel(r.pad)) continue;
    for (const rol of ROLLEN) {
      const b = beleid.beleidVoor(r.pad, rol);
      if (!b || b.niveau === beleid.NIVEAUS.verboden) continue;
      const huidig = paden.get(r.pad) || { rollen: new Set(), niveau: b.niveau };
      huidig.rollen.add(rol);
      paden.set(r.pad, huidig);
    }
  }

  const rijen = [];
  const meting = { gemeten: 0, 'geen-effect-gemeten': 0, onbekend: 0 };
  const verklaring = { VOLLEDIG: 0, GEDEELTELIJK: 0, ONBEKEND: 0 };
  const fouten = [];

  for (const [pad, info] of [...paden].sort((a, b) => a[0].localeCompare(b[0]))) {
    const m = gevolg.gevolgVan(pad);
    const c = CONTRACTEN[pad] || null;
    if (c) {
      const f = contract.keur(c);
      /* EEN CONTRACT DAT DE KEURING NIET HAALT, TELT NIET ALS VERKLARING. Anders
         stijgt de teller door een regel die niet draagt -- precies het valse groen
         waar deze laag tegen is gebouwd. Hij wordt met naam gemeld. */
      if (f.length) { fouten.push({ pad, fouten: f }); }
    }
    const s = (c && !contract.keur(c).length) ? contract.stand(c, pad)
      : { stand: 'ONBEKEND', open: contract.SOORTEN.slice(), nietVerklaard: m.collecties || [] };

    meting[m.graad]++;
    verklaring[s.stand]++;
    rijen.push({ pad, rollen: [...info.rollen].sort(), niveau: info.niveau,
      meting: { graad: m.graad, collecties: m.collecties, reden: m.reden },
      verklaring: { stand: s.stand, open: s.open, nietVerklaard: s.nietVerklaard || [] } });
  }

  /* CONTRACTEN BUITEN HET BEREIK VAN DE AI, met naam. De gouden weg is zo'n geval:
     /api/office/bank/incasso heeft een effectcontract maar `beleid.js` kent geen
     enkel /api/office-pad (KANTOORMACHT.md par. 9), dus hij valt buiten de noemer
     van deze meter. Hem stil weglaten zou de indruk geven dat het werk er niet is
     -- en een correctie die de vorige telling onzichtbaar maakt, is geen correctie
     (dezelfde regel als `zwaarLezend` in scripts/kantoormacht.js). */
  const buitenBereik = Object.keys(CONTRACTEN).filter(p => !paden.has(p)).sort();

  return { rijen, meting, verklaring, fouten, buitenBereik, bereikbaar: paden.size };
}

const u = meet();
const tellers = {
  bereikbaarPerRol: u.bereikbaar,
  onbekendeEffectpaden: u.meting.onbekend,
  effectGemeten: u.meting.gemeten,
  effectGeenEffectGemeten: u.meting['geen-effect-gemeten'],
  contractVolledig: u.verklaring.VOLLEDIG,
  contractGedeeltelijk: u.verklaring.GEDEELTELIJK,
  contractOnbekend: u.verklaring.ONBEKEND,
  contractenGezakt: u.fouten.length,
  contractenBuitenBereik: u.buitenBereik.length
};

if (argv.includes('--json')) {
  process.stdout.write(JSON.stringify({ tellers, rijen: u.rijen, fouten: u.fouten }, null, 1) + '\n');
} else {
  console.log('\n\x1b[1mDE EFFECTDEKKING\x1b[0m \x1b[2m(twee assen, nooit opgeteld)\x1b[0m\n');
  console.log('  AI-bereikbare handelingen   : ' + tellers.bereikbaarPerRol + '   \x1b[2m(live uit beleid.js)\x1b[0m');
  console.log('\n  \x1b[1mde METING\x1b[0m \x1b[2m(wat de proef zag veranderen)\x1b[0m');
  console.log('    gemeten                   : ' + tellers.effectGemeten);
  console.log('    geen effect gemeten       : ' + tellers.effectGeenEffectGemeten);
  console.log('    \x1b[31mONBEKEND\x1b[0m                  : ' + tellers.onbekendeEffectpaden + '   \x1b[2m(moet dalen)\x1b[0m');
  console.log('\n  \x1b[1mde VERKLARING\x1b[0m \x1b[2m(het effectcontract van een mens)\x1b[0m');
  console.log('    VOLLEDIG                  : ' + tellers.contractVolledig + '   \x1b[2m(mag stijgen)\x1b[0m');
  console.log('    GEDEELTELIJK              : ' + tellers.contractGedeeltelijk);
  console.log('    ONBEKEND                  : ' + tellers.contractOnbekend);
  if (tellers.contractenBuitenBereik) {
    console.log('\n  \x1b[2mcontracten BUITEN het AI-bereik (wel verklaard, niet in de noemer):\x1b[0m');
    for (const p of u.buitenBereik) console.log('    ' + p);
  }
  if (tellers.contractenGezakt) {
    console.log('\n  \x1b[31mcontracten die de keuring niet halen: ' + tellers.contractenGezakt + '\x1b[0m');
    for (const f of u.fouten) { console.log('    ' + f.pad); for (const r of f.fouten) console.log('      - ' + r); }
  }
  console.log('\n  \x1b[2mEr staat met opzet geen percentage boven deze tellers: een samengesteld getal');
  console.log('  verbergt welke van de twee assen bewoog (BEWIJSMACHINE.md).\x1b[0m\n');
}

if (vastleggen) {
  fs.writeFileSync(DOEL, JSON.stringify({
    stempel: stempel(),
    uitleg: 'Per AI-bereikbare handeling twee assen: de METING (wat de idempotentieproef zag ' +
      'veranderen, via kern/stuur/gevolg.js) en de VERKLARING (het effectcontract van een mens, ' +
      'via kern/stuur/effectcontract.js). Ze worden nooit opgeteld.',
    grens: 'De meting zegt WELKE collecties, nooit hoeveel erin verandert, en zij kijkt niet buiten ' +
      'de opslag (geen mail, geen provider, geen bank). De verklaring mag MEER zeggen dan de meting ' +
      'maar nooit iets anders: waar zij `gemeten` claimt, moet de meting dat bevestigen.',
    tellers, fouten: u.fouten, buitenBereik: u.buitenBereik, rijen: u.rijen
  }, null, 1) + '\n');
  console.log('  EFFECTDEKKING.json geschreven.\n');
}

if (controle) {
  let oud = null;
  try { oud = JSON.parse(fs.readFileSync(DOEL, 'utf8')); } catch (e) { oud = null; }
  if (!oud) { console.error('  Geen EFFECTDEKKING.json om tegen te vergelijken; leg eerst vast.'); process.exit(2); }
  const fout = [];
  if (tellers.onbekendeEffectpaden > oud.tellers.onbekendeEffectpaden)
    fout.push('onbekendeEffectpaden steeg van ' + oud.tellers.onbekendeEffectpaden + ' naar ' +
      tellers.onbekendeEffectpaden + ' -- deze teller mag alleen dalen');
  if (tellers.contractVolledig < oud.tellers.contractVolledig)
    fout.push('contractVolledig zakte van ' + oud.tellers.contractVolledig + ' naar ' +
      tellers.contractVolledig + ' -- een verklaring die verdwijnt is een verklaring die niet droeg');
  if (tellers.contractenGezakt > 0)
    fout.push(tellers.contractenGezakt + ' effectcontract(en) halen de keuring niet');
  if (fout.length) { console.error('\n  DE EFFECTDEKKING IS VERSLECHTERD\n'); for (const f of fout) console.error('    ' + f); console.error(''); process.exit(1); }
  console.log('  in orde: ' + tellers.onbekendeEffectpaden + ' onbekend (was ' +
    oud.tellers.onbekendeEffectpaden + '), ' + tellers.contractVolledig + ' volledig (was ' +
    oud.tellers.contractVolledig + ').\n');
}
