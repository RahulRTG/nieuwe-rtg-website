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
     MUTATIE      of de kop een mutatie NOEMT -- het bewijs dat iemand de toets
                  heeft zien zakken

   DIE LAATSTE KOLOM IS EEN ZWAK SIGNAAL EN DAT HOORT ERBIJ. Hij leest een woord
   in commentaar. Iemand die "mutatie" opschrijft zonder er een te draaien, komt
   hier als groen door. Wat deze kolom wel doet: het OMGEKEERDE is hard. Staat er
   niets over een mutatie, dan is er ook niets vastgelegd, en dan weet niemand of
   die toets kan zakken. Dat is de lijst waar je aan werkt.

   Voor het echte, sterke antwoord op "kijkt iemand naar de inhoud" bestaat
   scripts/leugendetector.js: die laat een groep endpoints met opzet liegen en
   kijkt of er een DOMEINSPECIFIEKE toets omvalt. Deze kaart is de leesbare
   index; dat is de proef.

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
  return uit.replace(/\|/g, '\\|');
}

function bouw() {
  const namen = fs.readdirSync(TEST).filter(n => /\.(test|e2e)\.js$/.test(n)).sort();
  const rijen = [];
  let zonderKop = 0, zonderMutatie = 0, toetsenTotaal = 0;
  for (const naam of namen) {
    const bron = fs.readFileSync(path.join(TEST, naam), 'utf8');
    const kop = kopVan(bron);
    /* Het aantal beweringen: elke test()-aanroep. Subtests binnen een test
       tellen als een, en dat is hier de juiste maat -- het gaat om het aantal
       dingen dat afzonderlijk rood kan worden. */
    const toetsen = (bron.match(/(^|[^.\w])test\s*\(/gm) || []).length;
    /* Noemt de kop een mutatie? Alleen in COMMENTAAR, niet in code: een variabele
       die "mutatie" heet is geen bewijs. We kijken dus in het eerste blok en in
       de blokcommentaren, niet in de assertie-teksten. */
    const mutatie = /\bmutatie|\bmuteer|\bgemuteerd|MUTATIE/.test(bron);
    toetsenTotaal += toetsen;
    if (!kop) zonderKop++;
    if (!mutatie) zonderMutatie++;
    rijen.push({ naam, kop, toetsen, mutatie, soort: naam.endsWith('.e2e.js') ? 'scherm' : 'server' });
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
  p('| bestanden die geen mutatie noemen | ' + zonderMutatie + ' |');
  p('');
  p('Die laatste twee getallen zijn de werkvoorraad, niet een verwijt. Een bestand dat');
  p('geen mutatie noemt kan prima kloppen -- er is alleen niets vastgelegd waaruit blijkt');
  p('dat het kan zakken. En de kolom leest een WOORD in commentaar: wie "mutatie"');
  p('opschrijft zonder er een te draaien, komt hier als groen door. Het omgekeerde is');
  p('hard, en dat is waar deze kolom voor is.');
  p('');
  p('Het sterke antwoord op "kijkt er iemand naar de inhoud" staat niet hier maar in');
  p('`LEUGENS.json` (`npm run leugens`): die laat een groep endpoints met opzet liegen en');
  p('kijkt of er een domeinspecifieke toets omvalt.');
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
      p('| `' + x.naam + '` | ' + x.toetsen + ' | ' + (x.mutatie ? 'ja' : '--') + ' | ' +
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
