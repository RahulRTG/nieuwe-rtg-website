/* DE SLO-TABEL IN SLO.md KOMT UIT SLO.json -- en kan daarom niet verouderen.

   De doelen stonden in SLO.md als tabel. Sinds er een meter is die ze leest
   (server/kern/command/slo.js) staan ze ook in SLO.json, en dat is precies de
   toestand waar LAT.md regel 4 over gaat: twee plaatsen die dezelfde waarheid
   dragen lopen uit elkaar, en dan is het document dat een mens leest het
   verkeerde van de twee.

   Dus staat de waarheid in SLO.json en is de tabel in SLO.md een AFDRUK. Dit
   script schrijft hem tussen twee merktekens; `npm run check` regel 43 draait
   dezelfde bouw en vergelijkt. Schuift de norm, dan wordt de keuring rood tot
   iemand `npm run slo` draait.

   De PROZA eromheen blijft handwerk, en dat hoort ook: die legt uit waarom een
   doel staat waar het staat, en dat is geen gegeven maar een afweging.

   Draai: node scripts/slo.js [--schrijf] */
'use strict';

const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'SLO.md');
const BRON = path.join(WORTEL, 'SLO.json');
const BEGIN = '<!-- uit SLO.json, geschreven door scripts/slo.js -- niet met de hand bijwerken -->';
const EIND = '<!-- einde SLO.json -->';

/* Nederlandse notatie: een komma. Dit document wordt door mensen gelezen en
   niet door een parser, en 99.9% leest hier als een tikfout. */
const nl = (n) => String(n).replace('.', ',');

/* Een snelheidsdoel onder de seconde leest in milliseconden. 0,25 s is
   hetzelfde getal en het slechtere. */
const duur = (v) => (v < 1 ? Math.round(v * 1000) + ' ms' : nl(v) + ' s');

/* Het foutbudget in mensentaal: hoeveel storing per venster past er in de
   marge tussen streefwaarde en honderd procent. */
function budgetTekst(streef, dagen) {
  const minuten = dagen * 24 * 60 * ((100 - streef) / 100);
  const m = Math.floor(minuten);
  const s = Math.round((minuten - m) * 60);
  return m + ' min' + (s ? ' ' + s + ' s' : '');
}

function blok(norm) {
  const r = [];
  r.push(BEGIN);
  r.push('');
  r.push('| # | Doel | Meting | Streefwaarde | Venster | Foutbudget |');
  r.push('|---|---|---|---|---|---|');
  norm.doelen.forEach((d, i) => {
    const streef = d.eenheid === 's' ? '< ' + duur(d.streef) : nl(d.streef) + '%';
    const budget = d.soort === 'beschikbaarheid' ? budgetTekst(d.streef, d.vensterDagen) : 'n.v.t. (snelheid)';
    r.push('| ' + (i + 1) + ' | **' + d.naam + '** | ' + d.meet + ' | ' + streef + ' | ' +
      d.vensterDagen + ' dagen | ' + budget + ' |');
  });
  r.push('');
  r.push('Een doel telt pas mee vanaf **' + norm.minimumVerzoeken + ' verzoeken** en pas als er over minstens **' +
    Math.round(norm.minimumDekking * 100) + '%** van zijn venster is gemeten. Daaronder is de uitslag ' +
    '"onvoldoende gemeten", en dat is de uitslag en geen tussenstand: de tellers in `server/meting.js` beginnen ' +
    'bij elke herstart op nul, en een vers proces met drie verzoeken en nul fouten staat op 100%.');
  r.push('');
  r.push('### De reizen van de sonde');
  r.push('');
  r.push('| Reis | Aanroep | Verwacht | Max |');
  r.push('|---|---|---|---|');
  (norm.reizen || []).forEach(reis => {
    r.push('| **' + reis.naam + '** | `' + (reis.methode || 'GET') + ' ' + reis.pad + '` | ' +
      (reis.verwacht || []).join(' / ') + ' | ' + reis.maxMs + ' ms |');
  });
  r.push('');
  r.push('De inlogreis logt **met opzet verkeerd in**: de sonde toetst dat het pad antwoordt, niet dat hij ' +
    'binnenkomt. Een 200 daar zou een bevinding zijn en geen succes.');
  r.push('');
  r.push(EIND);
  return r.join('\n');
}

/* De volle verwachte tekst van SLO.md: de proza van de schijf met het blok
   ertussen vervangen. */
function bouw(bestaand) {
  const tekst = typeof bestaand === 'string' ? bestaand : fs.readFileSync(DOEL, 'utf8');
  const norm = JSON.parse(fs.readFileSync(BRON, 'utf8'));
  const i = tekst.indexOf(BEGIN);
  const j = tekst.indexOf(EIND);
  if (i < 0 || j < 0 || j < i) {
    throw new Error('SLO.md draagt de merktekens niet. Zet ' + BEGIN + ' en ' + EIND +
      ' om de tabel heen, of draai dit script met --schrijf nadat je ze hebt geplaatst.');
  }
  return tekst.slice(0, i) + blok(norm) + tekst.slice(j + EIND.length);
}

if (require.main === module) {
  const verwacht = bouw();
  const opSchijf = fs.readFileSync(DOEL, 'utf8');
  if (process.argv.includes('--schrijf')) {
    if (verwacht === opSchijf) console.log('SLO.md stond al gelijk aan SLO.json.');
    else { fs.writeFileSync(DOEL, verwacht); console.log('SLO.md bijgewerkt uit SLO.json.'); }
  } else if (verwacht !== opSchijf) {
    console.error('SLO.md loopt achter op SLO.json -- draai: npm run slo');
    process.exit(1);
  } else {
    console.log('SLO.md klopt met SLO.json.');
  }
}

module.exports = { bouw, blok, DOEL, BRON, BEGIN, EIND };
