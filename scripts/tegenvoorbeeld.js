#!/usr/bin/env node
/* ============================================================================
   ZOEK EEN TEGENVOORBEELD -- de zoekende tegenstander op RTG Pay
   (BEWIJSLUS.md par. 3). De motor staat in ./lib/tegenvoorbeeld.js; dit is de
   aanroep.

     npm run tegenvoorbeeld                     honderd reeksen, zaad 1
     node scripts/tegenvoorbeeld.js --zaad=7 --reeksen=500 --lengte=20

   UITGANG
     0  gezocht en niets gevonden. Dat is GEEN bewijs dat er niets is; de
        uitslag zegt hoeveel reeksen, welke assen en welk zaad.
     1  een tegenvoorbeeld, verkleind, met het zaad om hem na te spelen, en de
        eerste divergentie langs de ijkpunten E0-E8 (./lib/divergentie.js).
     2  niet vast te stellen: de motor kon niet draaien.

   RTG_SIMULATIEBANK=1 zet de as STORING aan (de npm-opdracht doet dat). Zonder
   die bank slaagt elke oplading en bestaat die as niet; dat staat dan in de
   uitslag in plaats van dat er stil op drie assen wordt gezocht.

   WAT HIJ NIET DOET: iets vastleggen. Een vondst wordt pas een toets of een
   register als een mens hem heeft gelezen (CODE.md besluit 4).
   ========================================================================== */
'use strict';

const m = require('./lib/tegenvoorbeeld');
const dv = require('./lib/divergentie');

const arg = (naam, standaard) => {
  const a = process.argv.find(x => x.startsWith('--' + naam + '='));
  const n = a ? Number(a.split('=')[1]) : standaard;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : standaard;
};

function toonOp(op) {
  const b = (x) => JSON.stringify(x);
  if (op.soort === 'laad') return 'laadOp ' + op.wie + ' ' + b(op.centen) + ' idem=' + b(op.idem);
  if (op.soort === 'stuur') return 'stuur ' + op.van + ' -> ' + op.aan + ' ' + b(op.centen) + ' idem=' + b(op.idem);
  if (op.soort === 'verzoek') return 'verzoekMaak ' + op.van + ' vraagt ' + op.aan + ' ' + b(op.centen) + ' idem=' + b(op.idem);
  if (op.soort === 'betaal') return 'verzoekBetaal ' + (op.wie || '(de ontvanger)') + ' verzoek#' + op.verzoek + ' idem=' + b(op.idem);
  return b(op);
}

async function hoofd() {
  const zaad = arg('zaad', 1), reeksen = arg('reeksen', 100), lengte = arg('lengte', 12);
  const storing = m.storingsas();
  const spelers = m.maakWereld().spelers;
  console.log('De zoekende tegenstander op RTG Pay');
  console.log('  assen: waarden, volgorde, gelijktijdigheid' + (storing.aan ? ', storing' : ''));
  if (!storing.aan) console.log('  NIET beproefd: storing -- ' + storing.reden);
  console.log('  zaad ' + zaad + ', ' + reeksen + ' reeksen van ' + lengte + ' stappen\n');

  const u = await m.zoek({ zaad, reeksen, lengte, spelers, maak: () => m.maakWereld() });
  const telling = Object.entries(u.tel).map(([k, t]) => k + ' ' + t.geslaagd + ' geslaagd / ' + t.geweigerd + ' geweigerd').join(', ');
  console.log('  uitgevoerd: ' + telling);
  if (!u.gevonden) {
    if (u.nietBeproefd.length) {
      console.log('\nNIET VAST TE STELLEN: deze soorten slaagden geen enkele keer en zijn dus niet beproefd: ' +
        u.nietBeproefd.join(', ') + '. Niets gevonden over iets wat niet gebeurde, is geen uitslag.');
      return 2;
    }
    console.log('Geen tegenvoorbeeld gevonden in ' + u.reeksen + ' reeksen.');
    console.log('Dat is geen bewijs dat er geen is: dit is wat er gezocht is, niet wat er waar is.');
    return 0;
  }
  console.log('TEGENVOORBEELD op wet "' + u.schending.wet + '"');
  console.log('  ' + u.schending.wat);
  console.log('  beloofd in: ' + u.schending.bron);
  console.log('  gevonden in reeks ' + u.reeks + ' (na ' + u.origineel + ' stappen), verkleind tot ' +
    u.stappen.length + ' stap(pen) in ' + u.pogingen + ' pogingen:\n');
  u.stappen.forEach((s, i) => {
    console.log('  stap ' + (i + 1) + (s.ops.length > 1 ? '  (tegelijk)' : ''));
    for (const op of s.ops) console.log('    ' + toonOp(op));
  });
  /* WAAR HET VOOR HET EERST ONWAAR WERD (BEWIJSLUS.md par. 4): het verkleinde
     voorbeeld nog een keer, nu langs de ijkpunten E0-E8. */
  const o = await dv.ontleed(u.stappen, () => m.maakWereld());
  if (o.gevonden) {
    const d = o.divergentie;
    console.log('\n  EERSTE DIVERGENTIE in stap ' + (o.stap + 1) + ', handeling ' + (o.op + 1) + ': ' +
      (d.van ? d.van + ' klopt, ' : '') + d.naar + ' wijkt' +
      (d.overgeslagen.length ? ' (niet waargenomen ertussen: ' + d.overgeslagen.join(', ') + ')' : ''));
    console.log('    verwacht:    ' + d.ijkpunt.verwacht);
    console.log('    waargenomen: ' + d.ijkpunt.waargenomen);
    console.log('    bron:        ' + d.ijkpunt.bron);
  } else {
    console.log('\n  EERSTE DIVERGENTIE: niet vast te stellen -- ' +
      (o.teGrof || 'de ijkpunten zijn alleen ingericht voor stuur en betaal'));
  }
  console.log('\nNaspelen: node scripts/tegenvoorbeeld.js --zaad=' + zaad + ' --reeksen=' + (u.reeks + 1) + ' --lengte=' + lengte);
  return 1;
}

hoofd().then(c => { process.exitCode = c; })
  .catch(e => { console.error('Niet vast te stellen: ' + e.message); process.exitCode = 2; });
