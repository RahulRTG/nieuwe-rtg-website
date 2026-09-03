#!/usr/bin/env node
/* ============================================================================
   WELK ENVELOPVELD HEEFT EEN DRAGER, EN WELK NIET?

   WAAROM DIT SCRIPT ER IS, EN WAT ER MIS WAS -- exact dezelfde fout als bij
   scripts/actorvormen.js, twee regels verderop in dezelfde takenlijst.
   `ENVELOP.json` droeg een lijst `veldenZonderHuis` en TAKEN.md 4.71 zei erbij:
   "Gemeten en geratelde stand in ENVELOP.json (`npm run envelop:velden`)".

   Dat commando bestond niet. Geen script berekende de lijst, geen toets
   controleerde hem: hij was met de hand getypt, en de enige lezer was
   scripts/samenhang.js die hem als waarheid overnam. Een belofte in tekst
   zonder handhaver (LAT.md regel 6) -- en deze keer met een verzonnen commando
   erbij, wat het net iets erger maakt: wie hem wilde narekenen kreeg
   "Missing script" en concludeerde dat hij iets fout deed.

   WAT DEZE METER DOET. Elk veld van de envelop staat hieronder met de plek waar
   zijn drager hoort te staan, als een LETTERLIJKE zin uit de bron -- dezelfde
   tand als TEGENSPRAKEN in scripts/gezag.js. Staat de zin er niet meer, dan is
   de drager weggehaald en zakt de meter. Een veld zonder geclaimde drager telt
   als dakloos.

   WAAROM EEN CITAAT EN NIET "STAAT HET WOORD ERGENS". Het woord `intent` komt in
   dit huis honderden keren voor. Zoeken naar de naam zou elk veld een drager
   geven en de meter op nul zetten -- de gevaarlijkste uitslag die er is, want
   dan lijkt het gat gedicht terwijl er niets is gebeurd.

   DE DRIE DIE DAKLOOS ZIJN, ZIJN DAT MET OPZET. `intent`, `risicoklasse` en
   `omkeerbaarheid` zijn geen WAARNEMINGEN maar OORDELEN: een poortwachter kan ze
   niet aflezen uit een verzoek. Ze daar verzinnen zou de envelop laten liegen,
   en daar gaat beleid op. Ze horen dus GEEN drager te krijgen tot er beleid is
   dat ze toekent -- dat staat als eis in TAKEN.md 4.71 en deze meter dwingt het
   af van de andere kant: zet iemand er stilletjes een drager onder, dan daalt
   het getal en vraagt de ratel om --vastleggen, en dan is het een besluit in
   plaats van een sluiproute.

   EN HIJ RUIMT OP WAT HIJ NIET KAN BEREKENEN. Bij het nalopen van alle registers
   op deze fout (3 september 2026) bleek ENVELOP.json nog VIER getallen te
   dragen die geen enkel script berekent en geen enkele toets leest:
   `routesZonderEnvelop`, `routesMetEnvelop`, `routesMetPoortwachter` en
   `routesTotaal`. Ze waren al uiteengelopen met de tekst die ze aanhaalde --
   TAKEN.md 4.71 sprak van "3346 van de 3706 routes" waar het register 3421 van
   3803 zei. Twee getallen over dezelfde vraag, allebei met de hand, allebei
   verouderd.

   Zo'n getal is geen informatie maar decoratie die later als feit wordt
   aangehaald. Deze meter schrijft daarom alleen de sleutels die hij en
   scripts/actorvormen.js WERKELIJK berekenen, en meldt wat hij weghaalt. Wie ze
   terug wil, bouwt eerst de meting -- en dat is precies de goede volgorde.

   Draai:  node scripts/envelopvelden.js
           node scripts/envelopvelden.js --lijst
           node scripts/envelopvelden.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'ENVELOP.json');
const argv = process.argv.slice(2);
const VASTLEGGEN = argv.includes('--vastleggen');
const LIJST = argv.includes('--lijst');

/* DE ELF VELDEN. `wat` is wat het veld betekent; `drager` is waar hij wordt
   gevuld, met een zin die er letterlijk moet staan. Geen drager = dakloos, en
   dan hoort er een REDEN te staan waarom dat zo is en geen gat. */
const VELDEN = [
  { veld: 'actor', wat: 'wie handelt hier',
    drager: ['server/opzet/envelop.js', 'actor: {'] },
  { veld: 'tenant', wat: 'binnen welk huis (zaak, werkplek, gezin)',
    drager: ['server/opzet/envelop.js', 'tenant: g.tenantId'] },
  { veld: 'capability', wat: 'welk begrensd recht, als de poortwachter dat weet',
    drager: ['server/opzet/envelop.js', 'capability: tekst(g.capability'] },
  { veld: 'gezag', wat: 'waar de bevoegdheid vandaan komt',
    drager: ['server/opzet/envelop.js', 'gezag: g.gezagBron'] },
  { veld: 'context', wat: 'pad, methode, tijd',
    drager: ['server/opzet/envelop.js', 'context: context(req'] },
  { veld: 'correlatie', wat: 'req.id, dat de logmiddleware al zet',
    drager: ['server/opzet/envelop.js', "'correlatie'"] },
  { veld: 'doel', wat: 'welke collecties deze handeling raakt',
    drager: ['server/opzet/handeling.js', 'function verschil'] },
  { veld: 'wijzigingen', wat: 'wat er werkelijk is veranderd',
    drager: ['server/opzet/handeling.js', 'wijzigingen.push('] },

  /* DE DRIE OORDELEN. Geen drager, en dat is het besluit en niet het gat. */
  { veld: 'intent', wat: 'wat de actor probeert te bereiken', drager: null,
    reden: 'een intentie spreekt een MENS uit; hem afleiden uit een verzoek is raden, ' +
      'en een geraden intentie in een bonnetje is erger dan een leeg veld' },
  { veld: 'risicoklasse', wat: 'hoe zwaar deze handeling weegt', drager: null,
    reden: 'vraagt BELEID dat een handeling een klasse geeft; kern/frictie/motor.js rekent wel ' +
      'een frictiescore maar alleen voor de handelingen die RTG Command kent, en dat is geen ' +
      'klasse voor de 3800 routes' },
  { veld: 'omkeerbaarheid', wat: 'is dit terug te draaien, en hoe', drager: null,
    reden: 'HERSTELPROEF.json MEET dit voor 90 routeparen (13 exact, 30 compensatie, 1 geen-herstel, ' +
      '46 zonder wereld) en dat is een waarneming en geen beleid -- maar het dekt 90 van 3800 routes. ' +
      'Hem op de envelop zetten zou betekenen dat 3710 routes een leeg oordeel dragen dat als ' +
      'oordeel leest. Zie TAKEN.md 4.71: eerst beleid, dan een drager' }
];

function meet() {
  const stuk = [];
  const bron = new Map();
  for (const v of VELDEN) {
    if (!v.drager) continue;
    const rel = v.drager[0];
    if (bron.has(rel)) continue;
    try { bron.set(rel, fs.readFileSync(path.join(WORTEL, rel), 'utf8')); }
    catch (e) { stuk.push(rel + ': niet te lezen'); }
  }

  const rijen = VELDEN.map(v => {
    if (!v.drager) return { veld: v.veld, wat: v.wat, staat: 'dakloos', reden: v.reden || null };
    const code = bron.get(v.drager[0]);
    if (code == null) return { veld: v.veld, wat: v.wat, staat: 'BRON WEG', drager: v.drager[0] };
    if (!code.includes(v.drager[1])) {
      return { veld: v.veld, wat: v.wat, staat: 'DRAGER WEG', drager: v.drager.join(' :: ') };
    }
    return { veld: v.veld, wat: v.wat, staat: 'gedragen', drager: v.drager.join(' :: ') };
  });

  /* ZELFIJKING: een veld zonder REDEN dat dakloos heet, is een gat dat niemand
     heeft uitgelegd -- en dan meet deze lijst een mening en geen stand. */
  for (const r of rijen) {
    if (r.staat === 'dakloos' && !r.reden) stuk.push(r.veld + ': dakloos zonder reden');
  }

  const weg = rijen.filter(r => r.staat === 'DRAGER WEG' || r.staat === 'BRON WEG');
  return { stuk, rijen, dakloos: rijen.filter(r => r.staat === 'dakloos'), weg, velden: rijen.length };
}

function main() {
  const nu = meet();
  let oud = null;
  try { oud = JSON.parse(fs.readFileSync(UITSLAG, 'utf8')); } catch (e) { oud = null; }

  console.log('\n=== DE VELDEN VAN DE ENVELOP ===\n');

  if (nu.stuk.length) {
    console.log('  DE METER IS STUK:\n');
    for (const s of nu.stuk) console.log('    - ' + s);
    return 2;
  }

  console.log('  velden            : ' + nu.velden);
  console.log('  met een drager    : ' + (nu.velden - nu.dakloos.length - nu.weg.length));
  console.log('  DAKLOOS (met reden): ' + nu.dakloos.length + '  ' + nu.dakloos.map(r => r.veld).join(', '));
  if (nu.weg.length) {
    console.log('\n  EEN DRAGER IS WEG uit de bron:');
    for (const r of nu.weg) console.log('    ' + r.veld + '  <- ' + r.drager);
  }

  if (LIJST) {
    console.log('');
    for (const r of nu.rijen) {
      console.log('    ' + r.veld.padEnd(16) + r.staat.padEnd(12) + (r.drager || ''));
      if (r.reden) console.log('        ' + r.reden.replace(/(.{92})\s/g, '$1\n        '));
    }
  }

  if (nu.weg.length) {
    console.log('\n  ZAKT: een veld dat een drager HAD, heeft er geen meer.');
    console.log('  Zet hem terug, of verklaar in scripts/envelopvelden.js waarom hij nu ergens');
    console.log('  anders vandaan komt -- met de nieuwe zin erbij.');
    return 1;
  }

  const stand = () => {
    const e = oud || {};
    /* DEZELFDE SLEUTEL als er al stond, en geen tweede ernaast. `gemeten.
       veldenZonderHuis` was het met de hand getypte getal; hij wordt nu
       BEREKEND en houdt zijn naam. Er een `veldenZonderHuisAantal` naast zetten
       zou twee namen voor een waarheid geven -- precies de fout die deze hele
       ronde opruimt (LAT.md regel 4). */
    /* ALLEEN WAT ER GEMETEN IS. Elke sleutel hieronder wordt door een script
       berekend; wat er verder in `gemeten` stond, gaat eruit met een melding.
       De twee van scripts/actorvormen.js blijven staan omdat die meter ze zelf
       bijwerkt -- ze staan hier bij naam zodat deze lijst niet stilzwijgend
       andermans werk weggooit. */
    const BEREKEND = ['envelopVelden', 'veldenZonderHuis',
      'actorVormen', 'actorDuplicaten', 'actorSessies'];
    const oudGemeten = (e.gemeten || {});
    const weggehaald = Object.keys(oudGemeten).filter(k => !BEREKEND.includes(k));
    const gemeten = {};
    for (const k of BEREKEND) if (oudGemeten[k] != null) gemeten[k] = oudGemeten[k];
    gemeten.envelopVelden = nu.velden;
    gemeten.veldenZonderHuis = nu.dakloos.length;
    e.gemeten = gemeten;
    if (weggehaald.length) {
      console.log('\n  WEGGEHAALD uit `gemeten` (geen enkel script berekent ze): ' + weggehaald.join(', '));
      console.log('  Een getal dat niemand narekent is geen informatie maar decoratie,');
      console.log('  en het wordt later als feit aangehaald. Wie ze terug wil, bouwt eerst de meting.');
    }
    e.veldenZonderHuis = nu.dakloos.map(r => ({ veld: r.veld, wat: r.wat, reden: r.reden }));
    e.veldenZonderHuisUitleg =
      'AFGELEID door scripts/envelopvelden.js -- hier stond een met de hand getypte lijst waarvan ' +
      'TAKEN.md 4.71 beweerde dat hij geratelde was, met een commando erbij (npm run envelop:velden) ' +
      'dat niet bestond. Elk veld met een drager noemt een LETTERLIJKE zin uit de bron; verdwijnt die, ' +
      'dan zakt de meter. De drie daklozen horen dakloos te blijven tot er beleid is dat ze toekent: ' +
      'een verzonnen risicoklasse is gevaarlijker dan geen.';
    e.envelopVelden = nu.rijen.map(r => ({ veld: r.veld, staat: r.staat, drager: r.drager || null }));
    return e;
  };

  if (VASTLEGGEN) {
    const o = oud || {};
    if (o.gemeten && o.gemeten.veldenZonderHuis != null &&
        nu.dakloos.length > o.gemeten.veldenZonderHuis) {
      console.log('\n  GEWEIGERD: de ratel legt geen verslechtering vast (' +
        o.gemeten.veldenZonderHuis + ' -> ' + nu.dakloos.length + ').');
      return 1;
    }
    fs.writeFileSync(UITSLAG, JSON.stringify(stand(), null, 2) + '\n');
    console.log('\n  vastgelegd in ENVELOP.json');
    return 0;
  }

  if (!oud || !oud.gemeten || oud.gemeten.veldenZonderHuis == null) {
    console.log('\n  Nog geen stand. Leg hem vast met --vastleggen.');
    return 0;
  }
  if (nu.dakloos.length > oud.gemeten.veldenZonderHuis) {
    console.log('\n  ZAKT: daklozen ' + oud.gemeten.veldenZonderHuis + ' -> ' + nu.dakloos.length + '.');
    return 1;
  }
  if (nu.dakloos.length < oud.gemeten.veldenZonderHuis) {
    console.log('\n  BETER dan ENVELOP.json. Zet de ratel strakker met --vastleggen -- en schrijf');
    console.log('  erbij WELK beleid het veld nu toekent, want dat is de vraag die 4.71 stelt.');
    return 0;
  }
  console.log('\n  De stand is gelijk aan ENVELOP.json.');
  return 0;
}

module.exports = { meet, main, VELDEN };

if (require.main === module) process.exit(main());
