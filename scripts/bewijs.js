#!/usr/bin/env node
/* ============================================================================
   HET BEWIJSREGISTER -- welke toets bewijst wat, en is die bewering nagetrokken?

   HET PROBLEEM. Deze suite heeft 612 bestanden en ruim vijftienhonderd toetsen.
   "De toetsen staan groen" zegt daarmee bijna niets: je weet niet WAT er groen
   staat, en LAT.md regel 9 waarschuwt voor het enige dat echt gevaarlijk is --
   een toets die niet kan zakken is erger dan geen toets, want hij geeft dekking
   zonder dekking te leveren. Wie hier binnenkomt moet kunnen zien welke bewering
   waar wordt gedaan, en of iemand die bewering ooit op de proef heeft gesteld.

   WAT HIER STAAT, en het is bewust mager gehouden:

     BESTAND      de toets
     BEWERING     de eerste regels van de kop -- wat dit bestand beweert te
                  bewijzen. Niet gegenereerd uit de code maar uit wat de
                  schrijver zelf heeft opgeschreven; staat er niets, dan staat
                  dat er ook (en dan is dat het gat).
     TOETSEN      hoeveel losse beweringen erin staan
     MUTATIE      of deze toets IS ZIEN ZAKKEN op een mutatie

   DIE LAATSTE KOLOM WAS EERST EEN ZWAK SIGNAAL: hij las het woord "mutatie" in
   commentaar. Iemand die dat opschrijft zonder er een te draaien kwam als groen
   door, en 586 van de 612 bestanden zeiden er niets over -- dus zei de kolom
   vooral iets over schrijfgewoonten. Nu leest hij MUTATIES.json, de uitslag van
   scripts/mutatie.js, die het echt PROBEERT:

     gezakt      een mutatie in de bron liet deze toets omvallen. Bewezen
                 gevoelig -- niet bewezen goed, want hij kan op de verkeerde
                 reden zakken.
     overleefd   geen enkele mutatie kreeg hem rood. Deze toets legt het gedrag
                 dat de motor kan raken niet vast. Dit is de werkvoorraad.
     genoemd     de kop beschrijft een mutatie maar de motor heeft hem (nog) niet
                 gedraaid. Zwakker bewijs, en het staat er als zodanig.
     --          niets van beide.

   Voor endpointgroepen bestaat daarnaast scripts/leugendetector.js: die laat een
   heel domein liegen en kijkt of een DOMEINSPECIFIEKE toets omvalt. Dat is een
   grovere maat op een hoger niveau; deze kaart is per bestand.

   GEEN DATUM IN DE UITVOER, met opzet -- zie de kop van scripts/kaart.js.

   Draai: node scripts/bewijs.js              (schrijft BEWIJS.md)
          node scripts/bewijs.js --controle   (zakt als het register achterloopt)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'BEWIJS.md');
const TEST = path.join(WORTEL, 'test');

/* De kop van een toetsbestand: het eerste blokcommentaar. Daar staat in dit huis
   wat het bestand beweert. We nemen de eerste twee zinnen, want de rest is
   toelichting en dit is een index. */
function kopVan(bron) {
  const m = /^\s*\/\*([\s\S]*?)\*\//.exec(bron);
  if (!m) return null;
  const tekst = m[1]
    .split('\n').map(r => r.replace(/^\s*[=*]*\s*/, '').trim())
    .filter(r => r && !/^=+$/.test(r) && !/^Draai/.test(r))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!tekst) return null;
  // twee zinnen, of 220 tekens -- wat eerder komt
  const stukken = tekst.split(/(?<=[.!?])\s+/);
  let uit = stukken.slice(0, 2).join(' ');
  if (uit.length > 220) uit = uit.slice(0, 217).replace(/\s+\S*$/, '') + '...';
  return uit.split('|').join('\\|');
}

/* De gemeten uitslag van scripts/mutatie.js. Ontbreekt het bestand, dan zegt de
   kolom "genoemd"/"--" op basis van de kop, en staat er in de kop van BEWIJS.md
   bij dat er niets gemeten is. Niet stilzwijgend doen alsof het gemeten is. */
function gemeten() {
  const p = path.join(WORTEL, 'MUTATIES.json');
  try { return (JSON.parse(fs.readFileSync(p, 'utf8')).toetsen) || {}; } catch (e) { return null; }
}

function bouw() {
  const namen = fs.readdirSync(TEST).filter(n => /\.(test|e2e)\.js$/.test(n)).sort();
  const meting = gemeten();
  const rijen = [];
  let zonderKop = 0, toetsenTotaal = 0;
  const telling = { gezakt: 0, overleefd: 0, genoemd: 0, geen: 0, onmeetbaar: 0 };
  for (const naam of namen) {
    const bron = fs.readFileSync(path.join(TEST, naam), 'utf8');
    const kop = kopVan(bron);
    /* Het aantal beweringen: elke test()-aanroep. Subtests binnen een test
       tellen als een, en dat is hier de juiste maat -- het gaat om het aantal
       dingen dat afzonderlijk rood kan worden. */
    const toetsen = (bron.match(/(^|[^.\w])test\s*\(/gm) || []).length;
    const noemt = /\bmutatie|\bmuteer|\bgemuteerd|MUTATIE/.test(bron);
    const m = meting && meting[naam];
    let stand;
    if (m && m.staat === 'gezakt') { stand = 'gezakt'; telling.gezakt++; }
    else if (m && m.staat === 'overleefd') { stand = 'overleefd'; telling.overleefd++; }
    else if (m) { stand = m.staat; telling.onmeetbaar++; }
    else if (noemt) { stand = 'genoemd'; telling.genoemd++; }
    else { stand = '--'; telling.geen++; }
    toetsenTotaal += toetsen;
    if (!kop) zonderKop++;
    rijen.push({ naam, kop, toetsen, stand, bron: m || null,
      soort: naam.endsWith('.e2e.js') ? 'scherm' : 'server' });
  }

  const r = [];
  const p = (s) => r.push(s === undefined ? '' : s);
  p('# Wat bewijst welke toets?');
  p('');
  p('**Dit bestand is GEGENEREERD** door `node scripts/bewijs.js` uit de koppen van de');
  p('toetsbestanden. Wijzig het niet met de hand: regel 41 van `npm run keuring` genereert');
  p('opnieuw en vergelijkt. Er staat geen datum in -- zie `ARCHITECTUUR.md` voor waarom.');
  p('');
  p('Waarom dit bestaat: "de toetsen staan groen" zegt bij ' + namen.length + ' bestanden en ' +
    toetsenTotaal + ' beweringen');
  p('bijna niets. Je wil weten **wat** er groen staat, en of iemand die bewering ooit heeft');
  p('zien zakken. `LAT.md` regel 9: een toets die niet kan zakken is erger dan geen toets.');
  p('');
  p('## De stand');
  p('');
  p('| | Aantal |');
  p('|---|---|');
  p('| toetsbestanden | ' + namen.length + ' |');
  p('| losse beweringen (`test(...)`) | ' + toetsenTotaal + ' |');
  p('| bestanden zonder kop (dus zonder opgeschreven bewering) | ' + zonderKop + ' |');
  p('| **gezakt** op een mutatie (bewezen gevoelig) | ' + telling.gezakt + ' |');
  p('| **overleefd**: geen mutatie kreeg hem rood | ' + telling.overleefd + ' |');
  p('| niet te meten (al rood, geen module gevonden, ...) | ' + telling.onmeetbaar + ' |');
  p('| alleen in de kop *genoemd*, nog niet gemeten | ' + telling.genoemd + ' |');
  p('| niets van beide | ' + telling.geen + ' |');
  p('');
  if (!meting) {
    p('**Er is nog niets gemeten.** `MUTATIES.json` bestaat niet, dus de kolom hieronder zegt');
    p('alleen of de kop van een bestand een mutatie NOEMT -- en dat zegt vooral iets over');
    p('schrijfgewoonten. Draai `npm run mutatie` om het echt te proberen.');
  } else {
    p('De regel **overleefd** is de werkvoorraad, en het is een feit en geen verwijt: zo\'n');
    p('toets kan prima iets nuttigs doen, maar het gedrag dat de motor kan raken legt hij');
    p('niet vast. Zie `scripts/mutatie.js` voor wat de motor wel en niet probeert -- een');
    p('module die niets teruggeeft en alleen in de database schrijft, blijft daar terecht');
    p('groen. Zakken is bewezen GEVOELIG, niet bewezen goed.');
  }
  p('');
  p('Voor endpointgroepen is er een grovere maat op een hoger niveau: `LEUGENS.json`');
  p('(`npm run leugens`) laat een heel domein liegen en kijkt of er een domeinspecifieke');
  p('toets omvalt.');
  p('');
  for (const soort of ['server', 'scherm']) {
    const deel = rijen.filter(x => x.soort === soort);
    p('## ' + (soort === 'server' ? 'Servertoetsen (`npm test`)' : 'Schermtoetsen (`npm run e2e`, met een browser)'));
    p('');
    p(deel.length + ' bestanden, ' + deel.reduce((n, x) => n + x.toetsen, 0) + ' beweringen.');
    p('');
    p('| Toets | # | Mutatie | Bewering |');
    p('|---|---|---|---|');
    for (const x of deel) {
      const merk = x.stand === 'gezakt'
        ? 'gezakt op `' + (x.bron.operator || '?') + '`'
        : x.stand;
      p('| `' + x.naam + '` | ' + x.toetsen + ' | ' + merk + ' | ' +
        (x.kop || '**geen kop** -- deze toets zegt nergens wat hij bewijst') + ' |');
    }
    p('');
  }
  p('## Hoe je dit bestand bijwerkt');
  p('');
  p('```');
  p('node scripts/bewijs.js              # opnieuw genereren');
  p('node scripts/bewijs.js --controle   # zakt als het register achterloopt (regel 41)');
  p('```');
  return r.join('\n') + '\n';
}

if (require.main === module) {
  const tekst = bouw();
  if (process.argv.includes('--uit')) { process.stdout.write(tekst); process.exit(0); }
  if (process.argv.includes('--controle')) {
    const opSchijf = fs.existsSync(DOEL) ? fs.readFileSync(DOEL, 'utf8') : null;
    if (opSchijf === tekst) { console.log('BEWIJS.md is bij.'); process.exit(0); }
    console.error(opSchijf === null
      ? 'BEWIJS.md bestaat niet. Draai: node scripts/bewijs.js'
      : 'BEWIJS.md loopt achter op de toetsen. Draai: node scripts/bewijs.js');
    process.exit(1);
  }
  fs.writeFileSync(DOEL, tekst);
  console.log('BEWIJS.md geschreven (' + tekst.split('\n').length + ' regels).');
}

module.exports = { bouw, DOEL };
