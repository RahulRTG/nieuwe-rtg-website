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
     verklaard   wisselend, en NAGETROKKEN: er staat hieronder met de hand bij
                 WAARVAN het afhangt. Telt nooit als bewijs -- het is dezelfde
                 waarneming, met een naam eronder in plaats van een vraagteken.
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
/* EEN REGISTER HEEFT EEN SCHRIJVER, EN DIT WAS DE TWEEDE.

   Dit script schreef `AUDITPROEF.json`, en scripts/auditproef-route.js doet dat
   ook -- met een ANDERE vorm. Deze schrijft `perRoute` als een OBJECT met een
   veld `staat`; die schrijft het als een ARRAY met een veld `audit`. Wie ze door
   elkaar draait, laat het bestand van vorm wisselen zonder dat iemand het merkt.

   Dat is ook precies wat er is misgegaan. `scripts/bewijsmatrix.js` las het
   bestand met een lezer die op de OBJECT-vorm was geschreven en op `staat`
   toetste, terwijl er de ARRAY-vorm met `audit` op schijf stond. Die lezer gaf
   dus altijd niets terug, en de AUDIT-kolom meldde 0 bewezen terwijl het
   register er 860 droeg -- ruim een jaar lang, groen (TAKEN.md 7.22).

   Ze meten ook niet hetzelfde, en dat is de reden dat er niet EEN van de twee
   hoeft te verdwijnen: dit script leest het routejournaal van de gewone
   toetsenreeks (gratis, breed, waargenomen), auditproef-route.js voert elke
   schrijfroute ECHT uit tegen een wegwerpserver en leest het spoor terug via de
   kantoorroute die een auditor ook heeft (duur, zwaarder bewijs). De zware is de
   bron van de bewijsmatrix en houdt daarom de naam; deze schrijft zijn eigen
   bestand. */
const UITSLAG = path.join(WORTEL, 'AUDITPROEF-JOURNAAL.json');

/* HET OORDEEL ALS PURE FUNCTIE, om dezelfde reden als bij de outputproef: toen
   dit binnen meet() zat, kon een toets hem alleen NABOUWEN, en zo'n toets zakt
   niet als het instrument verandert. De mutatieproef ving dat -- 'wisselend' als
   bewezen laten tellen liet de suite groen. */
/* ============================================================================
   NAGETROKKEN: WAARVAN HING HET AF?

   De schuldpost audit-wisselend schreef zijn eigen sluitweg voor: "uitzoeken
   WAARVAN het afhangt. Per route na te lopen met het journaal erbij". Dat is
   gedaan voor alle veertien. Er kwamen DRIE ECHTE DEFECTEN uit, en die zijn
   gerepareerd in plaats van verklaard:

     /api/auth/login       de hoofdingang voor accounts logde niets (102 van de
                           106 geslaagde aanroepen zonder spoor)
     /api/supplier/login   de tak van het bedrijfsaccount logde niets, en de
                           personeelstak zette zijn `ok: true` neer voor twee
                           weigeringen die nog konden volgen
     /api/office/verify    het KYC-besluit zelf journaalde niet; de enige regel
                           die ontstond, liftte mee met de wachtrij in het
                           antwoord en bleef weg zodra die rij leeg was

   Wat hieronder staat is de rest: routes waar het verschil ECHT ergens van
   afhangt en waar dat terecht is. Eén regel loopt er als een draad doorheen:

     EEN JOURNAAL SCHRIJFT GEBEURTENISSEN OP, GEEN AANROEPEN.

   Een knop die niets omzette, een ronde die niets boekte, een wachtrij die leeg
   was: dan is er niets gebeurd, en een regel die zegt van wel maakt het boek
   juist minder waard. Een auditlog dat elke aanroep noteert, verdrinkt zijn
   eigen signaal -- en deze journalen zijn ringbuffers (5000 regels), dus ruis
   duwt echte sporen eruit.

   DE GRENZEN VAN DEZE KAART, zodat hij geen tapijt wordt om iets onder te
   vegen:

     1. hij verplaatst een route alleen van 'wisselend' naar 'verklaard', nooit
        naar 'bewezen'. Verklaard bewijs bestaat niet;
     2. hij raakt 'geen spoor' niet aan. Zakt een route hierheen af, dan valt
        hij dus gewoon door;
     3. een verklaring die op geen enkele wisselende route slaat, wordt gemeld
        (`ongebruikteVerklaringen` in de uitslag) -- een kaart die stil veroudert
        is erger dan geen kaart;
     4. hij staat in de BRON en niet in een register, zodat een verklaring in de
        diff van een pull request langskomt en niet in een gegenereerd bestand.
   ========================================================================== */
const VERKLAARD = {
  'POST /api/login': 'de demo-inlog met wachtwoord logt (gelukt en mislukt); een GASTsessie niet. ' +
    'Een gast heeft geen inloggegevens en probeert nergens binnen te komen waar hij niet hoort, ' +
    'dus valt er geen poging te noteren. En het veiligheidsbord is een ringbuffer van 5000 regels: ' +
    'elke gastsessie erin zetten duwt de echte aanvalssporen eruit. In productie staat RTG_DEMO uit ' +
    'en is de gast de enige tak die hier zonder wachtwoord doorheen komt.',
  'POST /api/kantoor/gesprek/zeg': 'het inloggesprek van het kantoor loopt in stappen (code, dan de ' +
    'tweede factor). De TUSSENSTAP -- code klopt, vertel me nu uw authenticator-code -- is geen ' +
    'afgeronde inlogpoging en journaalt niet. De poging zelf eindigt altijd in binnen() of mis(), ' +
    'en die loggen allebei, gelukt en mislukt.',
  'POST /api/office/verifications': 'de wachtrij noteert de INZAGE in de dossiers die hij toont ' +
    '(inzagelog.noteerVeel). Is de rij leeg, dan is er niets ingezien en staat er niets in het boek. ' +
    'Dat is precies goed: een inzagejournaal dat inzage noteert die niet heeft plaatsgevonden, ' +
    'is geen journaal maar een verhaal.',
  'POST /api/office/bank/draai': 'de knop journaalt de SCHAKELING. Staat de bank al in de stand ' +
    'die u vraagt, dan komt er `ongewijzigd` terug en is er niets geschakeld. De belofte bovenaan ' +
    'routes/kantoren/bank.js is "elke schakeling komt in het auditlog", en die blijft staan.',
  'POST /api/office/bank/operationeel': 'zelfde knop, zelfde regel: aan zetten wat al aan staat is ' +
    'geen schakeling. Het opschalen loopt bovendien via vier ogen, en de AANVRAAG journaalt wel ' +
    '(relais() schrijft "AANGEVRAAGD -- wacht op een tweede persoon").',
  'POST /api/office/bank/rente': 'de renteronde journaalt wat zij BIJSCHREEF. Een ronde die op nul ' +
    'rekeningen uitkwam (geen spaarrekening, of vandaag al gedraaid) heeft geen cent verplaatst; ' +
    'daar hoort geen regel bij die suggereert van wel.',
  'POST /api/office/bank/incasso': 'zelfde vorm: de ronde journaalt de uitgevoerde vaste betalingen. ' +
    'Nul uitgevoerd is nul regels. Wat er wel gebeurde -- er is gekeken -- staat in de uitslag die ' +
    'de aanroeper terugkrijgt.',
  'POST /api/office/bank/mislukking': 'de melding van een mislukte clearing telt op tot de drempel; ' +
    'het journaal legt de GEBEURTENIS vast, namelijk dat de bank daardoor automatisch in nood ging. ' +
    'De tussenstanden staan in het bankoverzicht, dat de teller gewoon toont.',
  'POST /api/office/salon/belang/beoordeel': 'de curatieronde journaalt hoeveel posts zij beoordeelde. ' +
    'Waren er geen nieuwe posts, dan is er niets beoordeeld en dus niets te melden.',
  'POST /api/command/alarm': 'de alarmstand WEEGT bij het opvragen, en het journaal krijgt alleen een ' +
    'regel bij een aan- of afmelding. Dat staat er met zoveel woorden bij in het antwoord zelf: ' +
    '"het alarm piept op verandering en niet elke ronde: een melding die elke dertig seconden ' +
    'terugkomt, leert mensen om hem weg te klikken."',
  'POST /api/doos/meting': 'de meting zelf landt altijd in doosMetingen, maar dat is een gegevensbak ' +
    'en geen journaal. De auditregel hoort bij iets anders: de doos die een klaarstaande opdracht ' +
    '(reset, hulp, update) OPHAALT. Staat er geen opdracht klaar, dan is er niets opgehaald.'
};

function oordeelUit(perRoute) {
  const uitslag = {};
  const telling = { bewezen: 0, verklaard: 0, wisselend: 0, 'geen spoor': 0 };
  for (const [route, waarnemingen] of perRoute) {
    const alle = [...waarnemingen];
    /* DE KLASSE-VORM WINT. Sinds de meting de uitkomstklasse meeschrijft
       ('2xx|securityLog', '4xx|geen') valt te onderscheiden waar een 'geen'
       bij hoorde -- en precies dat onderscheid hield 92 routes op wisselend.
       Zodra een route klasse-waarnemingen heeft tellen alleen die; de oude
       vorm kan de vraag niet beantwoorden die hier wordt gesteld. */
    const metKlasse = alle.filter(x => /^\dxx\|/.test(x));
    const obs = (metKlasse.length ? metKlasse : alle).map(x => {
      const i = x.indexOf('|');
      return i < 0 || !/^\dxx\|/.test(x) ? { klasse: null, sporen: x } : { klasse: x.slice(0, i), sporen: x.slice(i + 1) };
    });
    const namen = (lijst) => [...new Set(lijst.filter(o => o.sporen !== 'geen')
      .map(o => o.sporen).join(',').split(',').filter(Boolean))].join(', ');
    const metSpoor = obs.filter(o => o.sporen !== 'geen');
    const zonder = obs.filter(o => o.sporen === 'geen');
    const geslaagd = obs.filter(o => o.klasse === '2xx');

    let staat, reden;
    if (metSpoor.length && !zonder.length) {
      staat = 'bewezen';
      reden = 'liet bij elke waarneming een spoor na in: ' + namen(obs);
    } else if (geslaagd.length && geslaagd.every(o => o.sporen !== 'geen')) {
      /* Het verfijnde geval: elke GESLAAGDE aanroep journaalt, het "soms geen"
         zat bij weigeringen. Dan is "geslaagd werk laat een spoor na" wel
         degelijk een eigenschap van de route -- een weigering die niet
         journaalt is een keuze, geen wispelturigheid. */
      staat = 'bewezen';
      reden = 'liet bij elke GESLAAGDE aanroep een spoor na in: ' + namen(geslaagd) +
        '; een geweigerde aanroep journaalt hier niet, en dat is een keuze en geen wispelturigheid';
    } else if (metSpoor.length && zonder.length) {
      staat = 'wisselend';
      const binnenGeslaagd = geslaagd.some(o => o.sporen !== 'geen') && geslaagd.some(o => o.sporen === 'geen');
      reden = 'soms wel een spoor (' + namen(obs) + '), soms geen' +
        (binnenGeslaagd ? ', ook binnen de geslaagde aanroepen' :
          (metKlasse.length && !geslaagd.length ? '; alleen weigeringen zijn waargenomen, dus over geslaagd werk zegt dit niets' : '')) +
        '. Het hangt dus ergens van af, en dan is "laat een spoor na" ' +
        'geen eigenschap van deze route.';
    } else {
      staat = 'geen spoor';
      reden = 'bij elke waarneming groeide geen enkel journaal';
    }
    /* De kaart hierboven grijpt ALLEEN op wisselend in, en verplaatst nooit
       iets naar bewezen. De gemeten reden blijft staan; de verklaring komt er
       als apart veld naast, zodat zichtbaar blijft wat gemeten is en wat een
       mens erbij heeft opgeschreven. */
    if (staat === 'wisselend' && VERKLAARD[route]) {
      staat = 'verklaard';
      uitslag[route] = { staat, reden, verklaring: VERKLAARD[route], waarnemingen: alle.length };
      telling.verklaard++;
      continue;
    }
    uitslag[route] = { staat, reden, waarnemingen: alle.length };
    telling[staat]++;
  }
  /* Een verklaring die nergens meer op slaat, is een verklaring die stil is
     verouderd -- bijvoorbeeld omdat de route is gerepareerd (mooi) of omdat hij
     naar 'geen spoor' is afgezakt (niet mooi). Beide horen zichtbaar te zijn. */
  const ongebruikt = Object.keys(VERKLAARD).filter(r => !uitslag[r] || uitslag[r].staat !== 'verklaard');
  return { telling, perRoute: uitslag, ongebruikteVerklaringen: ongebruikt };
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
    /* De nieuwe vorm draagt een uitkomstklasse ('AUDIT POST /pad 2xx sporen');
       die komt als '2xx|sporen' in de waarneming zodat oordeelUit hem kan
       onderscheiden van de oude vorm zonder klasse. */
    const waarneming = /^\dxx$/.test(v[2]) && v.length >= 4
      ? v[2] + '|' + v.slice(3).join(' ')
      : v.slice(2).join(' ');
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
    gemeten: telling, routes: Object.keys(uitslag).length,
    ongebruikteVerklaringen: o.ongebruikteVerklaringen, perRoute: uitslag };
}

module.exports = { meet, oordeelUit, VERKLAARD };

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
console.log('  verklaard (wisselend, nagetrokken): ' + uit.gemeten.verklaard);
console.log('  wisselend (soms wel, soms niet)   : ' + uit.gemeten.wisselend);
console.log('  geen spoor                        : ' + uit.gemeten['geen spoor']);
if (uit.ongebruikteVerklaringen.length) {
  console.log('\n  LET OP -- verklaringen die nergens meer op slaan:');
  for (const r of uit.ongebruikteVerklaringen) console.log('    ' + r + ' (staat nu: ' + ((uit.perRoute[r] || {}).staat || 'ongemeten') + ')');
}
console.log('\n  weggeschreven in AUDITPROEF-JOURNAAL.json\n');
process.exitCode = 0;
