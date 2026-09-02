#!/usr/bin/env node
/* ============================================================================
   DE SCHERFMETER -- vier getallen die uit elkaar houden wat steeds door elkaar
   liep: is de VERDELER onrustig, of is de PRIJS van een ongemeten bestand fout?

   WAAROM DIT ER IS. Op 2 september 2026 verplaatsten elf nieuwe toetsbestanden
   bestaande toetsen tussen scherven, en twee daarvan zakten. De diagnose kostte
   drie rondes, want er was geen enkel getal dat de twee oorzaken scheidde:

     - de verdeler optimaliseert BALANS en niet stabiliteit. Dat 23% van de
       bestanden verhuist bij een minuscuul nieuw bestand kan volstrekt normaal
       zijn terwijl de scherven prima even lang duren;
     - de PRIJS van een ongemeten bestand kan ernaast zitten, en dan verhuist er
       veel meer dan nodig.

   Zonder die twee apart te meten lijkt elke verhuizing een prijsprobleem, en de
   verleiding is dan om aan de prijs te draaien tot de verhuizing weggaat. Dat is
   precies de verkeerde knop: gemeten over het echte register is de verplaatsing
   boven de p50 VLAK (p95 verplaatst 74%, p99 73%), terwijl een lagere prijs de
   schatting alleen maar slechter maakt.

   DE VIER GETALLEN, per klasse (unit en e2e draaien elk hun eigen vier scherven):

     balans      het verschil tussen de zwaarste en de lichtste scherf, als
                 aandeel van de zwaarste. Dit is wat de verdeler PROBEERT te
                 minimaliseren; hier hoort hij goed te scoren.
     churn       het aandeel bestaande bestanden dat van scherf wisselt ten
                 opzichte van de vorige vastgelegde indeling. Dit is wat de
                 verdeler NIET probeert te minimaliseren, en dat verschil is de
                 hele reden dat deze meter bestaat.
     ongemeten   bestanden met een GESCHAT in plaats van een gemeten gewicht.
     prijsbron   welke sport van de terugvalladder elk ongemeten bestand betaalt
                 (zie scripts/lib/duurprijs.js): eigen klasse, dezelfde klasse in
                 een andere modus, of de algemene p99.

   WAT HIER (NOG) NIET AAN EEN RATEL HANGT, EN WAAROM DAT EEN BESLUIT IS.

   Geen van de vier. `churn` en `balans` horen er ook niet aan: churn hangt af
   van hoeveel bestanden er sinds de vorige vastlegging bij kwamen, dus een ratel
   erop staat rood omdat iemand toetsen heeft geschreven -- een meter die rood
   wordt van goed werk leert iedereen om hem uit te zetten. En balans beweegt met
   de echte duren mee en is geen kwaliteitsoordeel.

   `ongemeten` IS een goede ratelkandidaat -- het is precies de fout van 2
   september, en fail-closed zou hem vroeg vangen. Hij staat hier toch niet aan,
   en dat is met opzet: een ratel erop betekent dat ELKE tak die een toetsbestand
   toevoegt rood staat tot de auteur de volle suite heeft gedraaid om hem te
   meten. Dat is een beleidsbesluit over andermans werk, en het staat vandaag op
   83 -- dat zet je niet stil aan in een tak die over iets anders gaat.

   Het besluit hoort dus apart genomen te worden, met dat getal erbij. Tot die
   tijd RAPPORTEERT deze meter, en dat is ook wat hem gevraagd is: het verschil
   zichtbaar maken tussen een onrustige verdeler en een verkeerde prijs. Zie
   BESTUUR.md -- de laag die iets toont, meet het niet, en niet elke meting hoort
   een poort te worden.

   WAT DEZE METER NIET IS. Geen voorstel voor een andere verdeler. Als churn
   werkelijk schade doet, is de structurele uitweg een andere doelstelling
   ("minimaliseer de langste scherf MET een straf op verhuizing"), en dat is een
   besluit en geen meting. Deze meter maakt dat besluit alleen navraagbaar.

   DRAAIEN

     node scripts/scherfmeter.js               toont de stand
     node scripts/scherfmeter.js --vastleggen  schrijft SCHERFMETER.json
     node scripts/scherfmeter.js --json
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'SCHERFMETER.json');
const TESTMAP = path.join(WORTEL, 'test');
const SCHERVEN = 4;

const vastleggen = process.argv.includes('--vastleggen');
const alsJson = process.argv.includes('--json');

/* De twee klassen draaien elk hun eigen vier scherven, met hun eigen modus --
   scripts/test-runner.js met dekking, scripts/e2e.js zonder. De meter zet die
   modus dus ook echt, want anders meet hij een verdeling die niemand draait. */
const KLASSEN = [
  { id: 'unit', achtervoegsel: '.test.js', modus: 'dekking' },
  { id: 'e2e', achtervoegsel: '.e2e.js', modus: 'normaal' }
];

function metModus(modus, fn, behoudWeging) {
  const oud = process.env.RTG_TOETSMODUS;
  process.env.RTG_TOETSMODUS = modus;
  /* delen.js onthoudt het register per proces; dat geheugen moet leeg voordat
     de volgende klasse zijn eigen modus vraagt, anders meet de tweede klasse de
     weging van de eerste.

     `behoudWeging` is de naad voor test/scherfmeter.test.js: die legt met
     zetDuren() een verzonnen wereld op en zou hem hier meteen kwijtraken. Zonder
     die naad zou de toets de formules moeten NABOUWEN, en dan toetst hij zijn
     eigen kopie -- dat is precies een keer gebeurd en het kostte vier mutaties
     die alle vier niets deden. */
  const delen = require('./lib/delen');
  if (!behoudWeging) delen.zetDuren(null);
  try { return fn(delen); } finally {
    if (oud === undefined) delete process.env.RTG_TOETSMODUS;
    else process.env.RTG_TOETSMODUS = oud;
    if (!behoudWeging) delen.zetDuren(null);
  }
}

function meetKlasse(k, vorige, opties) {
  const o = opties || {};
  const bestanden = o.bestanden
    ? [...o.bestanden].sort()
    : fs.readdirSync(TESTMAP).filter((f) => f.endsWith(k.achtervoegsel)).sort();

  return metModus(k.modus, (delen) => {
    const { prijzen } = require('./lib/duurprijs');
    const w = delen.weging(bestanden);
    const bakken = delen.indeling(bestanden, SCHERVEN);

    /* De gewichten opnieuw ophalen langs dezelfde weg als de verdeler, zodat
       "ongemeten" hier hetzelfde betekent als daar. */
    const kaart = delen.gewichtenVoor(bestanden);
    const prijs = prijzen(kaart.gewicht, { andere: kaart.andere });

    const kost = (n) => kaart.gewicht.get(n) || prijs.prijsVoor(n);
    const lasten = bakken.map((b) => b.reduce((s, n) => s + kost(n), 0));
    const zwaarste = Math.max(...lasten), lichtste = Math.min(...lasten);

    const ongemeten = bestanden.filter((n) => !kaart.gewicht.get(n));
    const prijsbron = {};
    for (const n of ongemeten) {
      const b = prijs.bronVoor(n);
      const sleutel = 'sport' + b.sport + '-' + b.grond;
      prijsbron[sleutel] = (prijsbron[sleutel] || 0) + 1;
    }

    /* De plaatsing van nu, en de churn ten opzichte van de vorige vastlegging.
       Bestanden die er toen nog niet waren tellen NIET mee: die zijn niet
       verhuisd, die zijn nieuw. Anders leest elke nieuwe toets als churn. */
    const plaats = {};
    bakken.forEach((b, i) => b.forEach((n) => { plaats[n] = i; }));

    const toen = (vorige && vorige.klassen && vorige.klassen[k.id] &&
      vorige.klassen[k.id].plaatsing) || null;
    let churn = null;
    if (toen) {
      const gedeeld = Object.keys(plaats).filter((n) => toen[n] !== undefined);
      const verhuisd = gedeeld.filter((n) => toen[n] !== plaats[n]);
      churn = { gedeeld: gedeeld.length, verhuisd: verhuisd.length,
        pct: gedeeld.length ? Math.round((verhuisd.length / gedeeld.length) * 1000) / 10 : 0,
        nieuw: Object.keys(plaats).length - gedeeld.length };
    }

    return {
      bestanden: bestanden.length,
      modus: { gevraagd: w.gevraagd, gebruikt: w.modus, vertrouwen: w.vertrouwen },
      balans: { zwaarsteMs: zwaarste, lichtsteMs: lichtste,
        spreidingPct: zwaarste ? Math.round(((zwaarste - lichtste) / zwaarste) * 1000) / 10 : 0,
        perScherf: lasten },
      churn,
      ongemeten: ongemeten.length,
      ongemetenNamen: ongemeten.slice(0, 20),
      prijsbron,
      plaatsing: plaats
    };
  }, o.behoudWeging);
}

function meet() {
  let vorige = null;
  try { vorige = JSON.parse(fs.readFileSync(REGISTER, 'utf8')); } catch (e) { vorige = null; }
  const klassen = {};
  for (const k of KLASSEN) klassen[k.id] = meetKlasse(k, vorige);
  return { klassen, vorige };
}

function toon(uit) {
  const K = { vet: '\x1b[1m', grijs: '\x1b[2m', groen: '\x1b[32m', geel: '\x1b[33m', reset: '\x1b[0m' };
  console.log('\n' + K.vet + 'DE SCHERFMETER' + K.reset + K.grijs +
    ' -- balans is wat de verdeler wil, churn is wat hij niet probeert' + K.reset + '\n');
  for (const k of KLASSEN) {
    const m = uit.klassen[k.id];
    console.log('  ' + K.vet + k.id + K.reset + K.grijs + '  ' + m.bestanden + ' bestanden, modus ' +
      m.modus.gebruikt + ' (' + m.modus.vertrouwen + ')' + K.reset);
    console.log('    balans      ' + m.balans.spreidingPct + '% tussen de zwaarste en de lichtste scherf' +
      K.grijs + '  [' + m.balans.perScherf.map((x) => Math.round(x / 1000) + 's').join(' ') + ']' + K.reset);
    console.log('    churn       ' + (m.churn
      ? m.churn.verhuisd + ' van ' + m.churn.gedeeld + ' verhuisd (' + m.churn.pct + '%), ' +
        m.churn.nieuw + ' nieuw'
      : K.grijs + 'geen vorige indeling vastgelegd -- niets om mee te vergelijken' + K.reset));
    const kleur = m.ongemeten ? K.geel : K.groen;
    console.log('    ongemeten   ' + kleur + m.ongemeten + K.reset +
      (m.ongemeten ? K.grijs + '  ' + m.ongemetenNamen.slice(0, 4).join(', ') +
        (m.ongemeten > 4 ? ' ...' : '') + K.reset : ''));
    const bronnen = Object.entries(m.prijsbron);
    console.log('    prijsbron   ' + (bronnen.length
      ? bronnen.map(([s, n]) => s + ': ' + n).join(', ')
      : K.grijs + 'geen enkel bestand op een geschatte prijs' + K.reset));
    console.log('');
  }
  console.log(K.grijs + '  balans hoort laag te zijn; churn hoort alleen VERKLAARD te zijn.' + K.reset);
  console.log(K.grijs + '  Geen van deze getallen hangt aan een ratel; zie de kop van dit script.\n' + K.reset);
}

function main() {
  const uit = meet();
  const totaalOngemeten = KLASSEN.reduce((n, k) => n + uit.klassen[k.id].ongemeten, 0);

  if (alsJson) {
    console.log(JSON.stringify({ klassen: uit.klassen, ongemeten: totaalOngemeten }, null, 2));
    return 0;
  }
  toon(uit);

  if (vastleggen) {
    const inhoud = {
      stempel: { op: new Date().toISOString(), instrument: 'scripts/scherfmeter.js',
        node: process.version },
      uitleg: 'Vier getallen per toetsklasse, zodat "de verdeler is onrustig" en "de prijs van een ' +
        'ongemeten bestand is fout" uit elkaar te houden zijn. Geen van deze getallen hangt aan een ' +
        'ratel: churn hangt af van hoeveel toetsen er bij kwamen, en een meter die rood ' +
        'wordt van goed werk leert iedereen om hem uit te zetten. Bijwerken: npm run scherfmeter:vast',
      meters: { ongemeten: totaalOngemeten },
      nietGeratelde: 'Geen van deze getallen hangt aan een ratel; zie de kop voor waarom, en voor het ' +
        'besluit dat over `ongemeten` openstaat.',
      klassen: uit.klassen
    };
    fs.writeFileSync(REGISTER, JSON.stringify(inhoud, null, 1) + '\n');
    console.log('  geschreven: SCHERFMETER.json (ongemeten = ' + totaalOngemeten + ')\n');
  }
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { meet, meetKlasse, KLASSEN };
