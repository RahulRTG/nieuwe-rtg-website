#!/usr/bin/env node
/* ============================================================================
   DE SYSTEEMWETTEN -- de harde uitspraken van dit huis, met hun bewijsstand.

   WAT EEN SYSTEEMWET HIER IS

   Niet elke afspraak is een wet. Dit huis heeft merkregels, ontwerpvoorkeuren,
   werkafspraken en smaak, en die staan verspreid over tien documenten. Een
   SYSTEEMWET is de smalle categorie daarbinnen: een uitspraak die als HARD is
   opgeschreven -- "nooit", "geen enkele", "dit is de grens" -- en waarvan het
   overtreden geen slordigheid zou zijn maar een ander product.

   Ze staan in WETTEN.json en niet in dit script, want een wet is een BESLUIT en
   geen berekening. Dit script leest ze, controleert wat er statisch aan te
   controleren valt, en zet er de gemeten bewijsstand naast.

   DRIE DINGEN WORDEN HIER GECONTROLEERD, en alle drie zijn ze een keer misgegaan
   in dit huis:

     1. DE BRON BESTAAT NOG. Elke wet noemt het document en de letterlijke zin
        waar hij vandaan komt. Staat die zin er niet meer, dan is de wet hier
        gaan afwijken van waar hij vandaan kwam -- LAT.md regel 6, en de
        stilste vorm van uit elkaar lopen die er is.
     2. DE HANDHAVER BESTAAT NOG. Een wet die naar een toets verwijst die is
        weggehaald, staat vrolijk in de lijst en houdt niets tegen. Dat is wat
        `scripts/samenhang.js` voor SOORTEN doet; dit doet het per wet.
     3. DE BEWIJSSTAND IS VERS. `npm run sabotage` probeert elke wet echt te
        overtreden en schrijft de uitslag in SABOTAGE.json. Verandert daarna het
        recept of de tekst van de wet, dan hoort het oude bewijs te vervallen --
        anders staat er "bewezen" op grond van een proef die voor iets anders is
        gedraaid. Daar zit een vingerafdruk op.

        WAT DIE VINGERAFDRUK NIET DEKT, en dat hoort er eerlijk bij: hij ziet
        het RECEPT en de WETTEKST, niet de wachter. Wie de toets erachter
        verandert (of de code die hij leest), krijgt geen "verlopen" te zien --
        want dan zou elke commit het hele register laten vervallen, en dat is
        niet te dragen. Een uitslag is dus een momentopname, precies zoals
        MUTATIES.json en de waargenomen dekking dat zijn. De wekelijkse ronde
        (`.github/workflows/ronde.yml`) meet hem opnieuw; dat is de enige echte
        versheid die er is.

   WAT DIT SCRIPT NIET DOET, en dat is het belangrijkste

   Het bewijst niets. Het toont wat er is gemeten. Is er niets gemeten, dan
   staat er NIET GEMETEN en niet iets vriendelijkers: een lijst wetten met
   groene vinkjes die niemand ooit heeft geprobeerd, is gevaarlijker dan geen
   lijst -- dan koopt hij vertrouwen dat er niet is (LAT.md regel 9 en 10).

   Draai:  node scripts/wetten.js
           node scripts/wetten.js --controle    (alleen de harde fouten, voor de poort)
           node scripts/wetten.js --json
           node scripts/wetten.js --vastleggen  (zet de meter wettenOnbewezen in NORM.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const W = require('./lib/wetboek');

const WORTEL = W.WORTEL;
const NORMBESTAND = path.join(WORTEL, 'NORM.json');
/* Deze vorm is niet toevallig: keuringsregel 35 leest `const METER = '...'` uit
   scripts/*.js en eist dan een ijking in test/meterijk.test.js. Zo valt deze
   meter onder dezelfde plicht als elke andere -- een meter die zijn eigen naam
   verstopt, ontsnapt aan de enige regel die hem eerlijk houdt. */
const METER = 'wettenOnbewezen';
const RICHTING = 'omlaag';           // een plafond: meer onbewezen wetten is slechter
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[90m', vet: '\x1b[1m', uit: '\x1b[0m' };

const argv = process.argv.slice(2);
const vlag = n => argv.includes('--' + n);

const lees = p => { try { return fs.readFileSync(path.join(WORTEL, p), 'utf8'); } catch (e) { return null; } };
const bestaat = p => fs.existsSync(path.join(WORTEL, p));

/* DE BRONCONTROLE. Het anker is een letterlijk stukje tekst uit het document.
   Bewust letterlijk en niet een regelnummer of een kopje: een regelnummer
   schuift bij de eerste alinea die erbij komt, en dan meldt deze controle
   ruzie waar er geen is. Een zin die verdwijnt is wel een echte gebeurtenis. */
function bronstand(wet) {
  const tekst = lees(wet.bron.bestand);
  if (tekst === null) return { ok: false, waarom: 'het bronbestand ' + wet.bron.bestand + ' bestaat niet' };
  if (!tekst.includes(wet.bron.anker)) return { ok: false, waarom: 'de zin "' + wet.bron.anker + '" staat niet (meer) in ' + wet.bron.bestand };
  return { ok: true };
}

function meet() {
  const { boek, vormfouten } = W.lees();
  const uitslag = W.leesUitslag();
  const rijen = boek.wetten.map(wet => {
    const bron = bronstand(wet);
    const missendeHandhaver = wet.handhaver.filter(h => !bestaat(h));
    const stand = W.standVan(wet, uitslag);
    return { wet, bron, missendeHandhaver, ...stand };
  });
  return { boek, vormfouten, uitslag, rijen };
}

/* De harde fouten: alles waarvan je met zekerheid kunt zeggen dat het register
   niet meer klopt met de code. Een wet die AFGESLAGEN is, staat hier NIET bij --
   dat is een eerlijke bevinding over de codebase en geen kapot register. Wie die
   twee door elkaar haalt, krijgt een poort die rood staat om iets waars, en die
   wordt binnen een week weggeklikt. */
function hardeFouten(m) {
  const uit = [];
  for (const f of m.vormfouten) uit.push('vorm: ' + f);
  for (const r of m.rijen) {
    if (!r.bron.ok) uit.push(r.wet.id + ': ' + r.bron.waarom);
    for (const h of r.missendeHandhaver) uit.push(r.wet.id + ': de handhaver ' + h + ' bestaat niet');
    if (r.stand === 'losgeraakt') uit.push(r.wet.id + ': het sabotagerecept wijst nergens naar (' + r.reden + ')');
    if (r.stand === 'verlopen') uit.push(r.wet.id + ': de meting is verlopen (' + r.reden + ') -- draai npm run sabotage ' + r.wet.id);
  }
  return uit;
}

const MERK = {
  raak: [K.groen, 'BEWEZEN   ', 'de handhaver werd rood toen de wet echt werd overtreden'],
  afgeslagen: [K.rood, 'TANDELOOS ', 'de wet werd echt overtreden en er werd niets rood'],
  blind: [K.geel, 'BLIND     ', 'de wachter was al rood; deze proef bewijst niets'],
  losgeraakt: [K.rood, 'LOSGERAAKT', 'het recept wijst nergens naar'],
  nietGeprobeerd: [K.grijs, 'NIET GEPR.', 'overgeslagen in de laatste ronde'],
  mensenwerk: [K.grijs, 'MENSENWERK', 'met opzet geen machine; de reden staat erbij'],
  nietGemeten: [K.geel, 'NIET GEMETEN', 'er is nooit iets geprobeerd'],
  verlopen: [K.geel, 'VERLOPEN  ', 'het recept veranderde na de meting']
};

function main() {
  let m;
  try { m = meet(); }
  catch (e) { console.error('\n  ' + K.rood + 'Het wetboek is niet te lezen: ' + e.message + K.uit + '\n'); return 2; }

  const fouten = hardeFouten(m);
  const onbewezen = W.onbewezen(m.boek, m.uitslag);

  if (vlag('json')) {
    console.log(JSON.stringify({ wetten: m.rijen.map(r => ({ id: r.wet.id, soort: r.wet.soort, wet: r.wet.wet,
      bron: r.wet.bron, bronOk: r.bron.ok, handhaver: r.wet.handhaver, stand: r.stand, reden: r.reden })),
      onbewezen, fouten }, null, 2));
    return fouten.length ? 1 : 0;
  }

  if (vlag('controle')) {
    if (!fouten.length) { console.log('Het wetboek klopt: ' + m.rijen.length + ' wetten, elke bron en elke handhaver bestaat.'); return 0; }
    console.error('Het wetboek klopt niet:');
    for (const f of fouten) console.error('  - ' + f);
    return 1;
  }

  console.log('\n' + K.vet + 'DE SYSTEEMWETTEN' + K.uit + K.grijs + ' -- ' + m.rijen.length + ' harde uitspraken, met hun bewijsstand' + K.uit + '\n');

  let vorigeSoort = null;
  for (const r of m.rijen) {
    if (r.wet.soort !== vorigeSoort) {
      console.log('  ' + K.vet + (r.wet.soort || 'overig').toUpperCase() + K.uit);
      vorigeSoort = r.wet.soort;
    }
    const [kleur, woord] = MERK[r.stand] || [K.grijs, r.stand];
    console.log('    ' + kleur + woord.padEnd(12) + K.uit + r.wet.wet);
    console.log('      ' + K.grijs + r.wet.bron.bestand + (r.bron.ok ? '' : K.rood + '  (de zin staat er niet meer!)' + K.grijs) +
      (r.wet.handhaver.length ? '  [' + r.wet.handhaver.join(', ') + ']' : '  [geen machinale handhaver]') + K.uit);
    if (r.missendeHandhaver.length)
      console.log('      ' + K.rood + 'ontbreekt: ' + r.missendeHandhaver.join(', ') + K.uit);
    if (r.reden) console.log('      ' + K.grijs + '> ' + r.reden.slice(0, 150) + K.uit);
    if (r.wet.kanttekening) console.log('      ' + K.geel + '! ' + r.wet.kanttekening.slice(0, 150) + K.uit);
  }

  const per = {};
  for (const r of m.rijen) per[r.stand] = (per[r.stand] || 0) + 1;
  console.log('\n  ' + Object.entries(per).map(([s, n]) => (MERK[s] ? MERK[s][0] : '') + n + ' ' + s + K.uit).join(K.grijs + ' · ' + K.uit));

  const norm = JSON.parse(lees('NORM.json') || '{}');
  const plafond = norm.meters ? norm.meters[METER] : undefined;
  console.log('  ' + METER + ': ' + onbewezen + ' van de ' + m.rijen.length +
    (plafond === undefined ? K.grijs + '  (nog geen norm; leg vast met --vastleggen)' + K.uit : K.grijs + '  (norm: ' + plafond + ')' + K.uit));

  if (!m.uitslag) {
    console.log('\n  ' + K.geel + 'Er is nog nooit iets geprobeerd.' + K.uit + ' SABOTAGE.json bestaat niet, dus de kolom hierboven');
    console.log('  ' + K.grijs + 'zegt alleen wat er is OPGESCHREVEN. Draai: npm run sabotage' + K.uit);
  }

  if (vlag('vastleggen')) {
    norm.meters = norm.meters || {};
    norm.meters[METER] = onbewezen;
    fs.writeFileSync(NORMBESTAND, JSON.stringify(norm, null, 2) + '\n');
    console.log('  ' + K.groen + METER + ' vastgelegd op ' + onbewezen + '.' + K.uit + '\n');
    return 0;
  }

  if (fouten.length) {
    console.log('\n  ' + K.rood + 'Het register klopt niet meer met de code:' + K.uit);
    for (const f of fouten) console.log('    - ' + f);
    console.log('');
    return 1;
  }
  if (plafond !== undefined && onbewezen > plafond) {
    console.log('\n  ' + K.rood + 'Er is een wet onbewezen bijgekomen' + K.uit + ' (' + onbewezen + ' tegen een norm van ' + plafond + ').');
    console.log('  ' + K.grijs + 'Geef hem een handhaver, of verhoog de norm met de hand -- dan staat het als keuze in de historie.' + K.uit + '\n');
    return 1;
  }
  console.log('');
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { meet, hardeFouten, bronstand, METER };
