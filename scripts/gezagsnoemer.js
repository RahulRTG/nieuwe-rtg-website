#!/usr/bin/env node
/* DE GEDEELDE NOEMER VAN DE GEZAGSSCHALEN -- de openstaande post uit GEZAG.json,
   voor het eerst uitgerekend in plaats van beschreven.

   WAT SCRIPTS/GEZAG.JS AL WIST. Dit huis beantwoordt de vraag "mag de machine
   dit zelf?" op vijf plekken met vijf eigen woordenlijsten, en het register zegt
   er zelf bij wat het niet kan: *"geen mens en geen machine kan ze naast elkaar
   leggen"*, en een afbeelding maken is een BESLUIT en geen afleiding.

   WAT HIER BIJKOMT. Een vierdelige noemer waar elke schaal zijn treden in
   verklaart, en per verklaring of die EVIDENT is (de bron zegt het zelf, met het
   citaat erbij) of AANGENOMEN (iemand moet beslissen). De aangenomen regels zijn
   de uitkomst van dit script, niet de bijvangst: zij zijn precies de besluiten
   die de eigenaar nog moet nemen voordat PLAN (EXECUTIE.md blok 3) twee schalen
   in een keten kan mengen.

   DIT IS EEN MEETLAAG EN GEEN BESLISSER, en daarom woont hij in scripts/ en niet
   in server/. Er hangt geen gedrag aan: geen route leest hem, geen poort raadpleegt
   hem, en test/gezagsnoemer.test.js zakt zodra iets uit server/ hem importeert.
   Zou hij wel beslissen, dan was hij de ZESDE gezagsschaal -- precies wat de
   ratel in scripts/gezag.js tegenhoudt.

   HET WOORD `niveau` STAAT HIER NIET. scripts/gezag.js telt losse niveaunamen
   door te kijken naar toekenningen op een veld dat letterlijk `niveau` heet; dit
   bestand gebruikt `noemer`, zodat de meter van dat huis niet vervuild raakt
   door de meter van dit huis.

   Draaien: npm run gezagsnoemer */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');

/* DE NOEMER. Vier treden, van "de machine doet niets" naar "de machine doet het".
   Bewust vier en niet vijf: dit is de grofste indeling waarin alle vijf schalen
   nog iets zeggen. Waar een schaal fijner is dan de noemer, gaat er informatie
   verloren -- en dat meldt dit script per geval, want een projectie die stilletjes
   afrondt is erger dan geen projectie. */
const NOEMER = Object.freeze([
  { trede: 'geen', wat: 'de handeling bestaat niet voor de machine' },
  { trede: 'tonen', wat: 'de machine leest, rekent of adviseert en verandert niets' },
  { trede: 'klaarzetten', wat: 'de machine stelt samen; een mens bevestigt' },
  { trede: 'uitvoeren', wat: 'de machine voert uit, binnen beleid' }
]);
const TREDEN = NOEMER.map(n => n.trede);

/* DE PROJECTIES. Per schaal, per trede: waar hij in de noemer valt, met de grond.
   `evident` draagt een citaat uit de bron zelf; `aangenomen` draagt de vraag die
   een mens moet beantwoorden. `onbepaald` is een derde uitkomst en geen fout: een
   trede die twee noemertreden tegelijk dekt, IS niet af te beelden. */
const PROJECTIES = [
  { bestand: 'server/kern/stuur/beleid.js', schaal: 'verboden|lezen|voorstel|klein',
    treden: {
      verboden: { noemer: 'geen', grond: 'evident',
        citaat: 'Alles wat niet genoemd is blijft' },
      voorstel: { noemer: 'klaarzetten', grond: 'evident',
        citaat: 'vereist een eenmalig servervoorstel dat de gebruiker' },
      lezen: { noemer: 'tonen', grond: 'evident', citaat: 'de machine leest en verandert niets' },
      klein: { noemer: 'uitvoeren', grond: 'evident',
        citaat: 'een kleine, omkeerbare handeling zonder externe gevolgen' }
    } },
  /* Verhuisd naar server/kern/frictie/ (met ./bodem.js ernaast); de schaal en
     de drie citaten zijn ongewijzigd meegegaan, alleen de plek is nieuw. */
  { bestand: 'server/kern/frictie/motor.js', schaal: 'hand|assist|auto',
    treden: {
      hand: { noemer: 'geen', grond: 'evident', citaat: 'een mens doet het zelf' },
      assist: { noemer: 'klaarzetten', grond: 'evident', citaat: 'de machine bereidt het voor, een mens drukt af' },
      auto: { noemer: 'uitvoeren', grond: 'evident', citaat: 'de machine doet het volledig, binnen beleid' }
    } },
  { bestand: 'server/kern/geldbeleid/regels.js', schaal: 'kijken|voorstellen|klaarzetten|automatisch',
    treden: {
      kijken: { noemer: 'tonen', grond: 'evident', citaat: 'kijken' },
      voorstellen: { noemer: 'tonen', grond: 'besloten',
        besluit: 'Een voorstel is informatie; KLAARZETTEN betekent dat er iets staat dat met een ' +
          'enkele bevestiging wordt uitgevoerd. Dat verschil is precies waarom die schaal beide ' +
          'woorden heeft, en het houdt "klaarzetten" een harde betekenis in de hele execution plane.' },
      klaarzetten: { noemer: 'klaarzetten', grond: 'evident', citaat: 'klaarzetten' },
      automatisch: { noemer: 'uitvoeren', grond: 'evident', citaat: 'automatisch' }
    } },
  { bestand: 'server/kern/stadsweefsel/ainiveau.js', schaal: 'waarnemen|adviseren|voorbereiden|begrensd|verboden',
    treden: {
      waarnemen: { noemer: 'tonen', grond: 'evident', citaat: 'waarnemen' },
      adviseren: { noemer: 'tonen', grond: 'evident', citaat: 'adviseren' },
      voorbereiden: { noemer: 'klaarzetten', grond: 'evident', citaat: 'voorbereiden' },
      begrensd: { noemer: 'uitvoeren', grond: 'besloten',
        besluit: 'De grens is een EIGENSCHAP van de uitvoering en geen trede. Wat de machine mag is ' +
          'een vraag, hoe ver hij mag gaan is een tweede; de grens hoort waar hij afdwingbaar is ' +
          '(het beleid) en niet in het woord.' },
      verboden: { noemer: 'geen', grond: 'evident', citaat: 'verboden' }
    } },
  { bestand: 'server/kern/bureau/delegatie.js', schaal: 'informeren|aanbevelen|voorbereiden|uitvoeren|autonoom',
    treden: {
      informeren: { noemer: 'tonen', grond: 'evident', citaat: 'informeren' },
      aanbevelen: { noemer: 'tonen', grond: 'evident', citaat: 'aanbevelen' },
      voorbereiden: { noemer: 'klaarzetten', grond: 'evident', citaat: 'voorbereiden' },
      uitvoeren: { noemer: 'uitvoeren', grond: 'evident', citaat: 'uitvoeren' },
      autonoom: { noemer: 'uitvoeren', grond: 'besloten',
        besluit: '"Zonder opdracht per geval" is een eigenschap van het staande MANDAAT en niet van ' +
          'de handeling. De noemer blijft vier treden; dit sluit aan op grens 2 van EXECUTIE.md -- ' +
          'een mandaat verleent nooit vermogen, het versmalt bestaand vermogen.' }
    } }
];

/* Staat de schaal nog letterlijk in zijn bestand? Zonder deze zelfijking meet
   dit script een register en niet de code (LAT.md regel 3). */
function schaalStaatEr(bestand, treden) {
  let tekst;
  try { tekst = fs.readFileSync(path.join(WORTEL, bestand), 'utf8'); } catch (e) { return { ok: false, reden: 'bestand niet leesbaar' }; }
  const mist = Object.keys(treden).filter(t => !new RegExp("'" + t + "'|\"" + t + "\"|\\b" + t + "\\b").test(tekst));
  return mist.length ? { ok: false, reden: 'trede(n) niet gevonden in de bron: ' + mist.join(' ') } : { ok: true };
}

function bouw() {
  const rijen = [];
  for (const p of PROJECTIES) {
    const ijk = schaalStaatEr(p.bestand, p.treden);
    for (const [trede, v] of Object.entries(p.treden))
      rijen.push({ bestand: p.bestand, trede, noemer: v.noemer, grond: v.grond,
        citaat: v.citaat, vraag: v.vraag, besluit: v.besluit, bronGevonden: ijk.ok });
    if (!ijk.ok) rijen.push({ bestand: p.bestand, trede: null, grond: 'meterstuk', reden: ijk.reden, bronGevonden: false });
  }
  const dekking = {};
  for (const t of TREDEN)
    dekking[t] = PROJECTIES.filter(p => Object.values(p.treden)
      .some(v => v.noemer === t || (Array.isArray(v.noemer) && v.noemer.includes(t)))).map(p => p.bestand);
  return {
    uitleg: 'De vier-tredige noemer waarin de vijf gezagsschalen van GEZAG.json worden verklaard, ' +
      'met per trede of de verklaring EVIDENT is (citaat uit de bron), AANGENOMEN (een mens moet beslissen) ' +
      'BESLOTEN (de eigenaar heeft de vraag beantwoord, met de reden erbij) of ONBEPAALD (de trede dekt ' +
      'twee noemertreden en is niet af te beelden). Dit is een meetlaag: ' +
      'er hangt geen gedrag aan, en test/gezagsnoemer.test.js zakt zodra server/ hem importeert.',
    noemer: NOEMER,
    schalen: PROJECTIES.length,
    treden: rijen.filter(r => r.trede).length,
    evident: rijen.filter(r => r.grond === 'evident').length,
    besloten: rijen.filter(r => r.grond === 'besloten'),
    aangenomen: rijen.filter(r => r.grond === 'aangenomen'),
    onbepaald: rijen.filter(r => r.grond === 'onbepaald'),
    meterstuk: rijen.filter(r => r.grond === 'meterstuk'),
    tredenZonderSchaal: TREDEN.filter(t => !dekking[t].length),
    dekking, rijen
  };
}

function main() {
  const r = bouw();
  console.log('DE GEDEELDE NOEMER VAN DE GEZAGSSCHALEN\n');
  for (const n of NOEMER) console.log('  ' + n.trede.padEnd(12) + n.wat);
  console.log('\n  ' + r.schalen + ' schalen, ' + r.treden + ' treden verklaard: ' +
    r.evident + ' evident, ' + r.besloten.length + ' besloten, ' +
    r.aangenomen.length + ' aangenomen, ' + r.onbepaald.length + ' onbepaald.\n');

  for (const p of PROJECTIES) {
    console.log('  ' + p.bestand);
    for (const [trede, v] of Object.entries(p.treden))
      console.log('    ' + trede.padEnd(14) + '-> ' + (Array.isArray(v.noemer) ? v.noemer.join('|') : v.noemer).padEnd(16) +
        (v.grond === 'evident' ? '' : '[' + v.grond.toUpperCase() + ']'));
  }

  if (r.meterstuk.length) {
    console.error('\nMETER STUK: een geregistreerde schaal staat niet meer in zijn bron.');
    for (const m of r.meterstuk) console.error('  ' + m.bestand + ': ' + m.reden);
  }

  const open = r.aangenomen.concat(r.onbepaald);
  console.log('\nWAT DE EIGENAAR MOET BESLISSEN (' + open.length + '):');
  if (!open.length) console.log('  niets meer open.');
  for (const a of open)
    console.log('  [' + a.grond + '] ' + a.bestand + ' :: ' + a.trede + '\n      ' + a.vraag);

  if (r.besloten.length) {
    console.log('\nAL BESLOTEN (' + r.besloten.length + '), met de reden die de eigenaar gaf:');
    for (const b of r.besloten) console.log('  ' + b.bestand + ' :: ' + b.trede + '\n      ' + b.besluit);
  }

  if (r.tredenZonderSchaal.length)
    console.log('\nNoemertreden die geen enkele schaal kent: ' + r.tredenZonderSchaal.join(', '));
  console.log('\nWAT DIT NIET DOET: het beslist niets, en het bewijst niet dat de vijf schalen');
  console.log('met elkaar kloppen. Het maakt alleen zichtbaar WAAR ze niet op elkaar passen.');

  fs.writeFileSync(path.join(WORTEL, 'GEZAGSNOEMER.json'), JSON.stringify(r, null, 1) + '\n');
  console.log('\nGEZAGSNOEMER.json geschreven.');
  if (r.meterstuk.length) process.exit(1);
}

if (require.main === module) main();
module.exports = { bouw, NOEMER, TREDEN, PROJECTIES };
