#!/usr/bin/env node
/* ============================================================================
   DE AUDIT-PROEF -- LAAT DEZE ROUTE EEN SPOOR NA?

   DE TWEEDE AS DIE NOOIT EEN INSTRUMENT HAD. In de bewijsmatrix stond AUDIT voor
   alle 4185 routes op ongemeten, met als reden "een hashketen over het auditlog;
   die bestaat nog niet als algemene voorziening". Die reden was ACHTERHAALD: de
   keten bestaat wel (server/lib/keten.js, AUDIT-KETEN-LOKAAL, in bedrijf) en
   beschermt het inzagejournaal.

   De vraag valt namelijk uiteen in twee stukken:

     1  laat deze route een spoor na?     <- deze proef
     2  is dat spoor onuitwisbaar?        <- de keten, bestond al

   Stuk twee was er; stuk een niet. En zonder stuk een is stuk twee een garantie
   over een journaal waarvan niemand weet welke routes erin schrijven.

   HOE. server/opzet/verzoekketen.js neemt onder RTG_ROUTELOG net voor en net na
   elk verzoek de lengtes op van de journalen in server/kern/auditsporen.js, en
   schrijft `AUDIT METHODE /pad <gegroeide journalen>|geen`. De gewone suite
   levert dat dus gratis mee -- er hoeft geen ronde bij die elke schrijfroute nog
   eens echt uitvoert.

   HET OORDEEL:

     bewezen     deze route liet bij ELKE waarneming een spoor na. Dat is een
                 uitspraak over wat hij DEED, waargenomen en niet geraden.
     wisselend   soms wel, soms geen spoor. Dat is een BEVINDING en geen ruis:
                 het betekent dat het ergens van afhangt (geslaagd of geweigerd,
                 welke rol, welke invoer) en dan is "laat een spoor na" niet waar
                 als eigenschap van de route.
     geen spoor  bij elke waarneming niets. Voor een leesroute is dat gewoon
                 juist; voor een schrijfroute is het een vraag.
     ongemeten   geen enkele waarneming.

   WAT DIT NIET ZEGT, en dat hoort erbij: of het spoor GENOEG zegt (wie, wat,
   waarom), en of de route die het spoor overslaat dat terecht doet. Een spoor
   tellen is niet een spoor lezen.

   Draai:  node scripts/auditproef.js
           node scripts/auditproef.js --lees <journaal>
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');
const sporen = require('../server/kern/auditsporen');

const WORTEL = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const JOURNAAL = (argv.find(a => a.startsWith('--lees=')) || '').slice(7) ||
  (argv.includes('--lees') ? argv[argv.indexOf('--lees') + 1] : '') ||
  path.join(WORTEL, '.routejournaal');
const UITSLAG = path.join(WORTEL, 'AUDITPROEF.json');

/* HET OORDEEL ALS PURE FUNCTIE, om dezelfde reden als bij de outputproef: toen
   dit binnen meet() zat, kon een toets hem alleen NABOUWEN, en zo'n toets zakt
   niet als het instrument verandert. De mutatieproef ving dat -- 'wisselend' als
   bewezen laten tellen liet de suite groen. */
function oordeelUit(perRoute) {
  const uitslag = {};
  const telling = { bewezen: 0, wisselend: 0, 'geen spoor': 0 };
  for (const [route, waarnemingen] of perRoute) {
    const w = [...waarnemingen];
    const metSpoor = w.filter(x => x !== 'geen');
    const zonder = w.filter(x => x === 'geen');
    let staat, reden;
    if (metSpoor.length && !zonder.length) {
      staat = 'bewezen';
      reden = 'liet bij elke waarneming een spoor na in: ' +
        [...new Set(metSpoor.join(',').split(','))].join(', ');
    } else if (metSpoor.length && zonder.length) {
      staat = 'wisselend';
      reden = 'soms wel een spoor (' + [...new Set(metSpoor.join(',').split(','))].join(', ') +
        '), soms geen. Het hangt dus ergens van af, en dan is "laat een spoor na" ' +
        'geen eigenschap van deze route.';
    } else {
      staat = 'geen spoor';
      reden = 'bij elke waarneming groeide geen enkel journaal';
    }
    uitslag[route] = { staat, reden, waarnemingen: w.length };
    telling[staat]++;
  }
  return { telling, perRoute: uitslag };
}

function meet() {
  let tekst = '';
  try { tekst = fs.readFileSync(JOURNAAL, 'utf8'); }
  catch (e) { return { fout: 'geen journaal op ' + JOURNAAL + '; draai de suite met RTG_ROUTELOG' }; }

  /* Per route de VERZAMELING waarnemingen. De journaalregels zijn ontdubbeld op
     de hele regel, dus een route die de ene keer wel en de andere keer geen
     spoor naliet, staat er twee keer in -- en juist dat verschil is de
     bevinding. */
  const perRoute = new Map();
  for (const regel of tekst.split('\n')) {
    const r = regel.trim();
    if (!r.startsWith('AUDIT ')) continue;
    const v = r.slice(6).split(' ').filter(Boolean);
    if (v.length < 3) continue;
    const sleutel = v[0] + ' ' + v[1];
    const waarneming = v.slice(2).join(' ');
    if (!perRoute.has(sleutel)) perRoute.set(sleutel, new Set());
    perRoute.get(sleutel).add(waarneming);
  }
  if (!perRoute.size) {
    return { fout: 'het journaal bevat geen AUDIT-regels. Die schrijft de verzoekketen sinds ' +
      'de AUDIT-as bestaat; een journaal van voor die tijd kan deze vraag niet beantwoorden.' };
  }

  const o = oordeelUit(perRoute);
  const uitslag = o.perRoute;
  const telling = o.telling;

  return { stempel: stempel({ journaal: path.relative(WORTEL, JOURNAAL) }),
    uitleg: 'Per route: groeide er tijdens het verzoek een journaal (server/kern/auditsporen.js). ' +
      'Waargenomen tijdens de gewone suite, niet nagespeeld.',
    grens: 'zegt of er een spoor IS, niet of het spoor genoeg zegt (wie, wat, waarom), en niet ' +
      'of een route die geen spoor nalaat dat terecht doet. Of het spoor onuitwisbaar is, ' +
      'meet server/lib/keten.js.',
    sporen: sporen.SPOREN.map(([naam, wat]) => ({ naam, wat })),
    gemeten: telling, routes: Object.keys(uitslag).length, perRoute: uitslag };
}

module.exports = { meet, oordeelUit };

if (require.main !== module) return;

const uit = meet();
if (uit.fout) { console.error('\n  ' + uit.fout + '\n'); process.exitCode = 2; return; }
if (argv.includes('--json')) { console.log(JSON.stringify(uit, null, 1)); process.exitCode = 0; return; }

fs.writeFileSync(UITSLAG, JSON.stringify(uit, null, 1) + '\n');
console.log('\n=== DE AUDIT-PROEF ===\n');
console.log('  journaal                : ' + path.relative(WORTEL, JOURNAAL));
console.log('  routes met waarnemingen : ' + uit.routes);
console.log('');
console.log('  BEWEZEN (elke keer een spoor)     : ' + uit.gemeten.bewezen);
console.log('  wisselend (soms wel, soms niet)   : ' + uit.gemeten.wisselend);
console.log('  geen spoor                        : ' + uit.gemeten['geen spoor']);
console.log('\n  weggeschreven in AUDITPROEF.json\n');
process.exitCode = 0;
