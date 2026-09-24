#!/usr/bin/env node
/* ============================================================================
   DE MAGNAAT-GRONDWET, GEMETEN -- WAT IS ER VAN ELKE REGEL WAAR?

   MAGNAAT.md zegt wat economische waarheid in Magnaat is; scripts/lib/
   magnaatgrondwet.js zegt per regel wie hem afdwingt. Dit script gelooft
   geen van beide op hun woord. Per regel en per productvorm (World, Oefen-
   kantoor, Classic) zoekt het:

     handhaver   staat elk citaat LETTERLIJK in de code van dat bestand?
                 Commentaar is eruit gehaald: een zin die belooft dat iets
                 veilig is, dwingt niets af.
     toets       staat er een toets met die naam in dat bestand, en -- waar de
                 verklaring een `bewijst` noemt -- controleert hij dat ook?
     schending   hoe vaak staat er vandaag code die de regel breekt?

   Daaruit volgt de stand, en die wordt nergens ingevuld:

     VIOLATION   er is minstens een schending geteld
     PASS        handhaver en toets gevonden, niets geschonden, niet `deels`
     PARTIAL     een van de twee gevonden, of allebei maar met `deels`
     ABSENT      geen van beide (de handhaver is NIEMAND)

   Een regel krijgt de strengste stand van zijn scopes, met een uitzondering
   die geen versoepeling is: PASS naast ABSENT is PARTIAL -- de regel wordt
   ergens gehandhaafd en ergens niet, en dat is precies wat PARTIAL zegt.

   Vier vragen per regel, zoals ze in de opdracht staan, en ze worden apart
   geteld en nooit opgeteld:
     gedocumenteerd   id en invariant staan woordelijk in MAGNAAT.md
     geimplementeerd  in minstens een scope staat een handhaver in de code
     afgedwongen      in ELKE scope een handhaver, en nergens een schending
     getoetst         in ELKE scope een toets

   Draai:  npm run magnaat:grondwet
           npm run magnaat:grondwet -- --json
           npm run magnaat:grondwet -- --document     (schrijft het regeldeel van MAGNAAT.md)
           npm run magnaat:grondwet -- --vastleggen   (nulstand; schone boom)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./lib/bron');
const { stempel, eisSchoneBoom } = require('./lib/stempel');
const WET = require('./lib/magnaatgrondwet');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'MAGNAATGRONDWET.json');
const DOCUMENT = 'MAGNAAT.md';
const STANDEN = ['VIOLATION', 'ABSENT', 'PARTIAL', 'PASS'];

/* De meter krijgt zijn wortel mee, zodat de toets hem op een nagebouwde boom
   kan laten uitslaan (LAT.md regel 10: een meter die je niet hebt zien
   uitslaan, meet niets). */
function maakLezer(wortel) {
  const cache = new Map();
  /* `plat`: het commentaar wordt platgeslagen in plaats van weggehaald, zodat
     een schending met zijn ECHTE regelnummer wordt gemeld. Zonder die vorm
     verschoof elke plek met het aantal commentaarregels erboven, en wees de
     telling van ronde C naar regels waar niets stond. */
  return function lees(rel, { code = false, plat = false } = {}) {
    const sleutel = rel + (code ? (plat ? '#plat' : '#code') : '');
    if (!cache.has(sleutel)) {
      let tekst = null;
      try { tekst = fs.readFileSync(path.join(wortel, rel), 'utf8'); } catch (e) { tekst = null; }
      cache.set(sleutel, tekst == null ? null : (code ? zonderCommentaar(tekst, { regelsHeel: plat }) : tekst));
    }
    return cache.get(sleutel);
  };
}

/* Een map wordt ZELF gelezen, zodat een nieuw bestand in de World-map niet
   stil buiten de telling valt. */
function bestanden(wortel, spec) {
  if (Array.isArray(spec)) return spec;
  try {
    return fs.readdirSync(path.join(wortel, spec.map))
      .filter(n => n.endsWith('.js') && !(spec.zonder || []).includes(n))
      .sort().map(n => spec.map + '/' + n);
  } catch (e) { return []; }
}

function scopeStand(sc, lees, wortel) {
  /* In het register heet het veld `draagt` en niet `handhaver`: dat woord is
     in dit huis gesplitst in DRAAGT (de code die de regel draagt) en
     BEWAAKT_DOOR (de toets die rood wordt) -- LAT.md regel 14,
     scripts/lib/bewijsvelden.js. Hier is het de code; de toets staat in `toets`. */
  const uit = { autoriteit: sc.autoriteit, draagt: null, toets: null, schending: null, deels: sc.deels || null, missers: [] };

  if (sc.handhaver === 'NIEMAND') uit.draagt = 'NIEMAND';
  else {
    const gevonden = sc.handhaver.map(h => {
      const code = lees(h.bestand, { code: true });
      const ok = code != null && code.includes(h.citaat);
      if (!ok) uit.missers.push('handhaver niet gevonden: ' + h.bestand + ' -- "' + h.citaat + '"');
      return ok;
    });
    uit.draagt = gevonden.every(Boolean) ? 'gevonden' : 'citaat-weg';
  }

  if (sc.toets === 'NIEMAND') uit.toets = 'NIEMAND';
  else {
    const gevonden = sc.toets.map(t => {
      const bron = lees(t.bestand);
      const naamOk = bron != null && (bron.includes("test('" + t.naam + "'") || bron.includes('test("' + t.naam + '"') || bron.includes("'" + t.naam + "'"));
      const bewijsOk = !t.bewijst || (bron != null && bron.includes(t.bewijst));
      if (!naamOk) uit.missers.push('toets niet gevonden: ' + t.bestand + ' -- "' + t.naam + '"');
      else if (!bewijsOk) uit.missers.push('toets controleert niet wat hij moet: ' + t.bestand + ' mist "' + t.bewijst + '"');
      return naamOk && bewijsOk;
    });
    uit.toets = gevonden.every(Boolean) ? 'gevonden' : 'toets-weg';
  }

  if (sc.schending) {
    const re = new RegExp(sc.schending.patroon, 'g' + (sc.schending.vlaggen || ''));
    const plekken = [];
    for (const rel of bestanden(wortel, sc.schending.bestanden)) {
      const code = lees(rel, { code: true, plat: true });
      if (code == null) continue;
      code.split('\n').forEach((regel, i) => {
        const n = (regel.match(re) || []).length;
        for (let k = 0; k < n; k++) plekken.push(rel + ':' + (i + 1));
      });
    }
    uit.schending = { wat: sc.schending.wat, aantal: plekken.length, plekken };
  }

  const heeftH = uit.draagt === 'gevonden', heeftT = uit.toets === 'gevonden';
  if (uit.schending && uit.schending.aantal > 0) uit.stand = 'VIOLATION';
  else if (heeftH && heeftT && !uit.deels) uit.stand = 'PASS';
  else if (heeftH || heeftT) uit.stand = 'PARTIAL';
  else uit.stand = 'ABSENT';
  return uit;
}

function regelStand(scopes) {
  const s = Object.values(scopes).map(x => x.stand);
  if (s.includes('VIOLATION')) return 'VIOLATION';
  if (s.every(x => x === 'PASS')) return 'PASS';
  if (s.every(x => x === 'ABSENT')) return 'ABSENT';
  return 'PARTIAL';
}

function meet({ wortel = WORTEL, wet = WET } = {}) {
  const lees = maakLezer(wortel);
  const doc = lees(DOCUMENT) || '';
  const regels = wet.REGELS.map(r => {
    const scopes = {};
    for (const [naam, sc] of Object.entries(r.scope)) scopes[naam] = scopeStand(sc, lees, wortel);
    const lijst = Object.values(scopes);
    return {
      id: r.id, familie: r.familie, invariant: r.invariant,
      stand: regelStand(scopes),
      gedocumenteerd: doc.includes(r.id) && doc.includes(r.invariant),
      geimplementeerd: lijst.some(x => x.draagt === 'gevonden'),
      afgedwongen: lijst.every(x => x.draagt === 'gevonden' && !(x.schending && x.schending.aantal > 0)),
      getoetst: lijst.every(x => x.toets === 'gevonden'),
      schendingen: lijst.reduce((n, x) => n + (x.schending ? x.schending.aantal : 0), 0),
      scopes
    };
  });
  const telling = Object.fromEntries(STANDEN.map(s => [s, regels.filter(r => r.stand === s).length]));
  const vier = {
    gedocumenteerd: regels.filter(r => r.gedocumenteerd).length,
    geimplementeerd: regels.filter(r => r.geimplementeerd).length,
    afgedwongen: regels.filter(r => r.afgedwongen).length,
    getoetst: regels.filter(r => r.getoetst).length
  };
  return {
    graad: 'vermoed',
    waarom: 'handhavers en toetsen worden LEXICAAL gevonden: dat een citaat in de code staat en een toets zo heet, ' +
      'bewijst niet dat de toets groen is of dat de handhaver op elk pad zit. Of de genoemde toetsen slagen, ' +
      'beslist npm test; de schendingen zijn een telling van een patroon en dus een ONDERgrens.',
    grens: 'dit meet wat de verklaring in scripts/lib/magnaatgrondwet.js noemt. Een regel die daar niet staat, ' +
      'bestaat voor deze meter niet; een schending waar geen patroon voor is geschreven, wordt niet geteld.',
    regels: regels.length,
    telling,
    vier,
    schendingen: regels.reduce((n, r) => n + r.schendingen, 0),
    perRegel: regels
  };
}

function toon(m) {
  console.log('\nMAGNAAT-GRONDWET -- wat is er van elke regel waar?\n');
  for (const r of m.perRegel) {
    const v = (b) => (b ? 'ja ' : 'nee');
    console.log('  ' + r.id + '  ' + r.stand.padEnd(9) + '  doc ' + v(r.gedocumenteerd) + '  impl ' + v(r.geimplementeerd) +
      '  afgedwongen ' + v(r.afgedwongen) + '  getoetst ' + v(r.getoetst) + (r.schendingen ? '  schendingen ' + r.schendingen : ''));
    for (const [naam, sc] of Object.entries(r.scopes)) {
      for (const mis of sc.missers) console.log('           ' + naam + ': ' + mis);
    }
  }
  const t = m.telling;
  console.log('\n  ' + m.regels + ' invarianten: ' + t.PASS + ' PASS, ' + t.PARTIAL + ' PARTIAL, ' + t.ABSENT + ' ABSENT, ' + t.VIOLATION + ' VIOLATION');
  console.log('  ' + m.schendingen + ' geteld schendende plekken');
  console.log('  gedocumenteerd ' + m.vier.gedocumenteerd + ', geimplementeerd ' + m.vier.geimplementeerd +
    ', afgedwongen ' + m.vier.afgedwongen + ', getoetst ' + m.vier.getoetst + ' (van ' + m.regels + ')');
  console.log('\n  graad: ' + m.graad + ' -- ' + m.waarom + '\n');
}

/* HET DOCUMENT VOLGT DE METING, NIET ANDERSOM. Het deel van MAGNAAT.md dat per
   regel zegt wie hem afdwingt en hoe het ervoor staat, wordt hier geschreven,
   tussen twee merktekens. Met de hand bijgehouden zou het binnen een week iets
   anders beweren dan de code; test/magnaatgrondwet.test.js zakt zodra het
   achterloopt. Alles buiten de merktekens is mensenwerk en blijft staan. */
const BEGIN = '<!-- grondwet:begin -- gegenereerd door npm run magnaat:grondwet -- --document; niet met de hand wijzigen -->';
const EIND = '<!-- grondwet:eind -->';
const SCOPENAAM = { world: 'World', motor: 'Economische motor', academy: 'Oefenkantoor', classic: 'Classic' };

function documentBlok(m, wet = WET) {
  const code = (s) => '`' + String(s).replace(/`/g, "'") + '`';
  const uit = [BEGIN, '', '### De stand per regel', '',
    '| Regel | Familie | Stand | Gedocumenteerd | Geimplementeerd | Afgedwongen | Getoetst |',
    '|---|---|---|---|---|---|---|'];
  const jn = (b) => (b ? 'ja' : 'nee');
  for (const r of m.perRegel) {
    uit.push('| ' + r.id + ' | ' + wet.FAMILIES[r.familie].naam + ' | **' + r.stand + '** | ' + jn(r.gedocumenteerd) +
      ' | ' + jn(r.geimplementeerd) + ' | ' + jn(r.afgedwongen) + ' | ' + jn(r.getoetst) + ' |');
  }
  const t = m.telling;
  uit.push('', m.regels + ' invarianten: ' + t.PASS + ' PASS, ' + t.PARTIAL + ' PARTIAL, ' + t.ABSENT + ' ABSENT, ' +
    t.VIOLATION + ' VIOLATION; ' + m.schendingen + ' geteld schendende plekken.', '');
  for (const r of m.perRegel) {
    const def = wet.REGELS.find(x => x.id === r.id);
    uit.push('### ' + r.id + ': ' + wet.FAMILIES[r.familie].naam, '', '> ' + r.invariant, '', 'Stand: **' + r.stand + '**', '');
    for (const [naam, sc] of Object.entries(def.scope)) {
      const gemeten = r.scopes[naam];
      uit.push('- **' + SCOPENAAM[naam] + '**: ' + gemeten.stand);
      uit.push('  - Autoriteit: ' + sc.autoriteit);
      uit.push('  - Handhaver: ' + (sc.handhaver === 'NIEMAND' ? 'NIEMAND'
        : sc.handhaver.map(h => code(h.bestand) + ', ' + code(h.citaat)).join('; ')));
      uit.push('  - Toets: ' + (sc.toets === 'NIEMAND' ? 'NIEMAND'
        : sc.toets.map(x => code(x.bestand) + ', "' + x.naam + '"').join('; ')));
      if (gemeten.schending) {
        uit.push('  - Schending: ' + gemeten.schending.aantal + ', ' + gemeten.schending.wat);
      }
      if (sc.deels) uit.push('  - Waarom hooguit PARTIAL: ' + sc.deels);
    }
    uit.push('', '**Migratie.** ' + def.migratie, '', '**Faalwijze.** ' + def.faalwijze, '');
  }
  uit.push(EIND);
  return uit.join('\n');
}

function blokUitDocument(tekst) {
  const a = tekst.indexOf(BEGIN), b = tekst.indexOf(EIND);
  if (a < 0 || b < a) return null;
  return tekst.slice(a, b + EIND.length);
}

/* NIET UITVOEREN BIJ HET REQUIREN (meetkeuring, regel `wacht`): de toets laadt
   deze module, en een laadcontrole met --vastleggen in argv zou de nulstand
   overschrijven. */
/* Het blok schrijven verandert zelf een uitkomst (de regel staat daarna in het
   document), dus wordt er gemeten tot het blok niet meer beweegt. Twee rondes
   zijn genoeg; de derde is een vangnet en geen verwachting. */
function schrijfDocument() {
  const pad = path.join(WORTEL, DOCUMENT);
  let tekst = fs.readFileSync(pad, 'utf8');
  if (blokUitDocument(tekst) == null) throw new Error(DOCUMENT + ' mist de merktekens van het gegenereerde deel.');
  for (let i = 0; i < 3; i++) {
    const nieuw = tekst.replace(blokUitDocument(tekst), documentBlok(meet()));
    if (nieuw === tekst) return;
    fs.writeFileSync(pad, nieuw);
    tekst = nieuw;
  }
}

if (require.main === module) {
  if (process.argv.includes('--document')) { schrijfDocument(); console.log(DOCUMENT + ' bijgewerkt.'); }
  const m = meet();
  if (process.argv.includes('--vastleggen')) {
    const poort = eisSchoneBoom('magnaatgrondwet');
    if (!poort.ok) { console.error('[magnaatgrondwet] ' + poort.reden); process.exit(2); }
    fs.writeFileSync(DOEL, JSON.stringify(Object.assign({ stempel: stempel() }, m), null, 2) + '\n');
    console.log('MAGNAATGRONDWET.json geschreven.');
  }
  if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(m, null, 2) + '\n');
  else toon(m);
}

module.exports = { meet, STANDEN, documentBlok, blokUitDocument, DOCUMENT };
