#!/usr/bin/env node
/* HET TOESTANDSREGISTER -- welke muteerbare toestand bestaat er, en wie is ervan?

   Fase A van de verificatie-runtime: de runtime zichtbaar maken. Nog niets
   versnellen. De aanleiding staat in een getal: 647 serverstarts kosten 35% van
   alle toetstijd. Dat wordt pas minder als een server hergebruikt kan worden, en
   hergebruik mag alleen als van ELKE muteerbare wortel bekend is wie hem bezit
   en of hij aantoonbaar terug kan naar zijn beginstand.

   Een enkele onbekende singleton kan honderd keurig geisoleerde toetsen
   waardeloos maken -- en dat merk je niet, want een gedeelde server die lekt
   geeft geen fout maar een verkeerd antwoord. Daarom is dit register er eerder
   dan het hergebruik.

   WAT DIT REGISTER WEL EN NIET BEWEERT. Het beweert NIET dat de 143 wortels
   veilig te delen zijn. De meeste staan op `onbekend`, en dat is het eerlijke
   antwoord: niemand heeft ze geclassificeerd. Wat het wel doet is die
   onzekerheid ZICHTBAAR en BEGRENSD maken:

     - een wortel die de scan vindt en die hier niet staat: dat is een fout
       (staatOngeregistreerd moet 0 blijven)
     - een wortel op `onbekend` telt mee in staatOnbekend, en die meter mag
       alleen omlaag

   Zo kan er geen nieuwe onbekende toestand bijkomen zonder dat iemand er een
   besluit over neemt, en wordt het gat kleiner in plaats van vergeten.

   DE VIER LEVENSDUURKLASSEN. Elke wortel hoort er uiteindelijk een te krijgen:

     bootvast        afgeleid uit code of config, verandert nooit tijdens de rit
     toetsgebonden   mag binnen een toets muteren en moet daarna weg
     herstelbaar     mag tussen toetsen bestaan, maar moet terug naar de
                     beginstand kunnen -- en dat moet BEWEZEN zijn, niet beloofd
     procesgebonden  kan of mag niet veilig terug; een vers proces is verplicht

   Zolang een wortel op `onbekend` staat, telt hij als procesgebonden: dat is de
   veilige aanname, en hij kost dus een serverstart.

   Draai:
     node scripts/staat.js               het beeld, en exitcode 1 bij iets nieuws
     node scripts/staat.js --vastleggen  nieuwe wortels als 'onbekend' bijzetten
     node scripts/staat.js --json        machineleesbaar
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { scan, eigenaarVan } = require('./lib/staatscan.js');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'STATE.json');
const KLASSEN = ['bootvast', 'toetsgebonden', 'herstelbaar', 'procesgebonden', 'onbekend'];

function leesRegister() {
  try {
    const r = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
    return (r && typeof r === 'object' && r.wortels && typeof r.wortels === 'object') ? r : null;
  } catch (e) { return null; }
}

/* Het beeld: wat de scan vindt, naast wat het register zegt. Geen van beide is
   de waarheid op zichzelf -- de scan weet niet wat iets betekent, en het
   register weet niet wat er vandaag in de code staat. */
function vergelijk(uitslag, register) {
  const bekend = register ? register.wortels : {};
  const gevonden = new Map(uitslag.wortels.map(w => [w.id, w]));
  const ongeregistreerd = uitslag.wortels.filter(w => !bekend[w.id]);
  const verdwenen = Object.keys(bekend).filter(id => !gevonden.has(id) && bekend[id].bron !== 'hand');
  const perKlasse = {};
  for (const k of KLASSEN) perKlasse[k] = 0;
  for (const [id, r] of Object.entries(bekend)) {
    if (!gevonden.has(id) && r.bron !== 'hand') continue;
    perKlasse[KLASSEN.includes(r.levensduur) ? r.levensduur : 'onbekend']++;
  }
  return { ongeregistreerd, verdwenen, perKlasse };
}

function meet() {
  const uitslag = scan({ wortel: WORTEL });
  const register = leesRegister();
  return { uitslag, register, ...vergelijk(uitslag, register) };
}

function schrijfRegister(uitslag, register) {
  const bekend = (register && register.wortels) || {};
  const nieuw = {};
  for (const w of uitslag.wortels) {
    /* AFGELEID, NIET GEGOKT. Een wortel die alleen tijdens het laden wordt
       geschreven staat na de boot vast; dat leest de scanner uit de code en
       niet uit een mening (zie `naLaden` in lib/staatscan.js). Zulke wortels
       krijgen `bootvast` vanzelf, want er valt niets aan te classificeren.
       Alles wat ook NA de boot beweegt blijft `onbekend` tot een mens zegt
       wat het betekent -- en telt tot die tijd als procesgebonden, want dat is
       de veilige aanname. */
    const afgeleid = w.naLaden ? 'onbekend' : 'bootvast';
    nieuw[w.id] = bekend[w.id] || {
      eigenaar: eigenaarVan(w.bestand),
      levensduur: afgeleid,
      reset: w.naLaden ? 'onbekend' : 'niet nodig (staat vast na het laden)',
      soort: w.soort,
      bron: 'scan'
    };
    nieuw[w.id].soort = w.soort;                 // de vorm komt altijd uit de scan
    /* Ging een wortel van vast naar bewegend, dan is de oude classificatie niet
       meer waar. Stil laten staan zou het register een leugen maken. */
    if (w.naLaden && nieuw[w.id].levensduur === 'bootvast' && nieuw[w.id].bron === 'scan') {
      nieuw[w.id].levensduur = 'onbekend';
      nieuw[w.id].reset = 'onbekend';
    }
  }
  /* Met de hand toegevoegde wortels (toestand buiten dit proces: Postgres,
     Redis, de schijf) blijven staan; de scan kan die per definitie niet zien. */
  for (const [id, r] of Object.entries(bekend)) if (r.bron === 'hand') nieuw[id] = r;
  const uit = {
    vastgelegd: new Date().toISOString().slice(0, 10),
    uitleg: 'Muteerbare toestandswortels in server/. Geschreven door scripts/staat.js; ' +
      'levensduur en reset vult een MENS in. Een wortel die de scan vindt en hier niet staat, is een fout.',
    klassen: KLASSEN,
    wortels: Object.fromEntries(Object.keys(nieuw).sort().map(k => [k, nieuw[k]]))
  };
  fs.writeFileSync(REGISTER, JSON.stringify(uit, null, 2) + '\n');
  return uit;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const beeld = meet();
  const { uitslag, register, ongeregistreerd, verdwenen, perKlasse } = beeld;

  if (argv.includes('--json')) {
    console.log(JSON.stringify({
      wortels: uitslag.wortels.length, klokLezingen: uitslag.klokLezingen,
      ongeregistreerd: ongeregistreerd.map(w => w.id), verdwenen, perKlasse,
      willekeur: uitslag.willekeur, timers: uitslag.timers, listeners: uitslag.listeners
    }));
    process.exit(ongeregistreerd.length ? 1 : 0);
  }

  if (argv.includes('--vastleggen')) {
    schrijfRegister(uitslag, register);
    console.log('STATE.json geschreven: ' + uitslag.wortels.length + ' wortels' +
      (ongeregistreerd.length ? ' (' + ongeregistreerd.length + ' nieuw, als onbekend)' : '') +
      (verdwenen.length ? ', ' + verdwenen.length + ' verdwenen weggehaald' : ''));
    process.exit(0);
  }

  console.log('\nTOESTANDSREGISTER  (' + uitslag.bestanden + ' bestanden in server/)\n');
  console.log('  muteerbare wortels      ' + String(uitslag.wortels.length).padStart(6));
  for (const k of KLASSEN) {
    const merk = k === 'onbekend' && perKlasse[k] ? '   <- deze kosten een serverstart' : '';
    console.log('    ' + k.padEnd(20) + String(perKlasse[k]).padStart(6) + merk);
  }
  console.log('');
  console.log('  directe kloklezingen    ' + String(uitslag.klokLezingen).padStart(6) +
    '   (new Date() ' + uitslag.klok.datumLezing + ', Date.now ' + uitslag.klok.dateNow +
    ', hrtime ' + uitslag.klok.hrtime + ', performance ' + uitslag.klok.perf + ')');
  console.log('  new Date(x) constructie ' + String(uitslag.klok.datumBouw).padStart(6) + '   (leest de klok NIET)');
  console.log('  Math.random             ' + String(uitslag.willekeur.math).padStart(6));
  console.log('  crypto-willekeur        ' + String(uitslag.willekeur.crypto).padStart(6));
  console.log('  timers op moduleniveau  ' + String(uitslag.timers).padStart(6));
  console.log('  listeners idem          ' + String(uitslag.listeners).padStart(6));
  if (uitslag.onleesbaar.length) {
    console.log('\n  NIET TE LEZEN door de eigen parser: ' + uitslag.onleesbaar.length +
      ' (' + uitslag.onleesbaar.slice(0, 3).join(', ') + ')');
  }

  if (!register) {
    console.error('\n  STATE.json ontbreekt. Leg hem aan met: node scripts/staat.js --vastleggen\n');
    process.exit(1);
  }
  if (verdwenen.length) {
    console.log('\n  weg uit de code, nog in het register (' + verdwenen.length + '):');
    for (const id of verdwenen.slice(0, 8)) console.log('    ' + id);
    console.log('    ruim op met: node scripts/staat.js --vastleggen');
  }
  if (ongeregistreerd.length) {
    console.error('\n  NIEUWE MUTEERBARE TOESTAND ZONDER REGISTRATIE (' + ongeregistreerd.length + '):');
    for (const w of ongeregistreerd.slice(0, 12)) console.error('    ' + w.soort.padEnd(14) + w.id + '  (regel ' + w.lijn + ')');
    if (ongeregistreerd.length > 12) console.error('    ... en nog ' + (ongeregistreerd.length - 12));
    console.error('\n  Toestand die niemand bezit maakt elke gedeelde server onbetrouwbaar.');
    console.error('  Zet hem in STATE.json (node scripts/staat.js --vastleggen) en geef hem');
    console.error('  daarna een eigenaar en een levensduur.\n');
    process.exit(1);
  }
  console.log('\n  Alle muteerbare toestand staat in het register.\n');
}

module.exports = { meet, schrijfRegister, leesRegister, KLASSEN };
