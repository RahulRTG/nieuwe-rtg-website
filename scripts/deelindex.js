#!/usr/bin/env node
/* DE INDEX VAN DE BUNDELDELEN.

   Vijftig bundels worden geserveerd als EEN bestand en bewerkt als 394 losse
   delen. De delen heten naar hun volgnummer -- app-main-04aa.js,
   app-main-09a2.js -- en dat zegt niets, dus je moet ze openen om te vinden
   waar iets woont. Hernoemen is overwogen en afgeslagen: vijftig mappen die van
   naam veranderen botst met elke tak die openstaat, en er gaan er hier dertien
   per anderhalve dag doorheen.

   Dus blijft de naam en komt de betekenis erbij. Elk deel draagt een
   onderwerpregel bovenin (zo schreef dit huis toch al: 204 van de 394 hadden er
   een), en dit script zet ze in BUNDELS.md. De regel dat een deel er een MOET
   dragen, zit in de meter `delenZonderOnderwerp` van NORM.json -- die mag
   alleen omlaag, dus het gat kan niet groeien.

   Draai:  node scripts/deelindex.js            (schrijft BUNDELS.md)
           node scripts/deelindex.js --controle (zakt als het bestand achterloopt)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { bundels } = require('./bundel');
const { onderwerpVan } = require('./lib/bundeldeel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'BUNDELS.md');

function delenVan(map) {
  const dir = path.join(WORTEL, 'public', map);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(n => n.endsWith('.js')).sort().map(naam => {
    const bron = fs.readFileSync(path.join(dir, naam), 'utf8');
    /* De sluitende regelovergang telt niet als regel. De som per bundel komt
       daarmee dicht bij de bundel zelf maar hoeft er niet gelijk aan te zijn:
       app-main-31.js eindigt zonder regelovergang, dus zijn laatste regel en de
       eerste van app-main-31c.js zijn in de bundel EEN regel. Vandaar dat er
       'regels in de delen' staat en niet 'regels'. */
    const regels = bron.split('\n').length - (bron.endsWith('\n') ? 1 : 0);
    return { naam, onderwerp: onderwerpVan(bron), regels };
  });
}

/* Een onderwerpregel in een tabelcel. De PIJP moet ontsnappen, anders splijt
   hij de cel -- maar de BACKSLASH eerst, en dat stond er niet.

   Wat er misging als een onderwerp zelf een backslash draagt: `a\\|b` werd
   `a\\\\|b`, en Markdown leest die twee backslashes als een ontsnapte backslash
   waarna de pijp weer gewoon een celgrens is. De rij schuift dan een kolom op.
   CodeQL noemt dat js/incomplete-sanitization (bevinding 119) en heeft gelijk:
   wie ontsnapt, ontsnapt eerst zijn eigen ontsnappingsteken.

   Een regelovergang kan er niet in zitten (onderwerpVan geeft een enkele regel),
   maar hij staat er toch bij: een cel met een harde regelovergang breekt de
   tabel op dezelfde stille manier, en dit is de plek waar dat hoort. */
function tabelveilig(tekst) {
  return String(tekst).replace(/([\\|])/g, '\\$1').replace(/[\r\n]+/g, ' ');
}

function bouw() {
  const uit = [];
  uit.push('# De bundeldelen', '');
  uit.push('**Dit bestand wordt voortgebracht door `node scripts/deelindex.js`.** Wijzig het');
  uit.push('niet met de hand; wijzig de onderwerpregel bovenin het deel zelf.', '');
  uit.push('Vijftig bundels in `public/` worden aan de browser geserveerd als één bestand en');
  uit.push('bewerkt als losse delen. `test/bundeldelen.test.js` bewaakt dat die twee niet');
  uit.push('uiteenlopen; deze index zegt waar je moet zijn. Een deel zonder onderwerp staat');
  uit.push('er als een liggend streepje; de meter `delenZonderOnderwerp` in `NORM.json` telt ze en mag alleen');
  uit.push('omlaag.', '');

  let totaal = 0, zonder = 0;
  const namen = Object.keys(bundels).sort();
  const kop = uit.length;          // hier komt de telling, zodra hij bekend is
  for (const bundel of namen) {
    const delen = delenVan(bundels[bundel]);
    if (!delen.length) continue;
    const kaal = delen.filter(d => !d.onderwerp).length;
    totaal += delen.length; zonder += kaal;
    uit.push('## `' + bundel + '`', '');
    uit.push('`public/' + bundels[bundel] + '/` -- ' + delen.length + ' delen, ' +
      delen.reduce((s, d) => s + d.regels, 0) + ' regels in de delen' + (kaal ? ', waarvan ' + kaal + ' zonder onderwerp' : ''), '');
    uit.push('| deel | onderwerp |', '|---|---|');
    for (const d of delen) uit.push('| `' + d.naam + '` | ' + (d.onderwerp ? tabelveilig(d.onderwerp) : '--') + ' |');
    uit.push('');
  }
  uit.splice(kop, 0, '**' + namen.length + ' bundels, ' + totaal + ' delen, ' + zonder + ' zonder onderwerp.**', '');
  return uit.join('\n') + '\n';
}

function main() {
  const tekst = bouw();
  if (process.argv.includes('--controle')) {
    const oud = fs.existsSync(DOEL) ? fs.readFileSync(DOEL, 'utf8') : '';
    if (oud === tekst) { console.log('BUNDELS.md is bij.'); return 0; }
    console.error('BUNDELS.md loopt achter op de delen -- draai: node scripts/deelindex.js');
    return 1;
  }
  fs.writeFileSync(DOEL, tekst);
  console.log('BUNDELS.md geschreven (' + tekst.split('\n').length + ' regels).');
  return 0;
}

module.exports = { bouw, delenVan, tabelveilig, DOEL };
if (require.main === module) process.exit(main());
