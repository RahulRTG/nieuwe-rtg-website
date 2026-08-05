#!/usr/bin/env node
/* ============================================================================
   DE LEUGENDETECTOR -- welke endpoints kunnen liegen zonder dat iemand het ziet?

   HET PROBLEEM. De dekkingsmeting noemt een endpoint gedekt zodra zijn pad
   ergens in een toetsbestand voorkomt. Dat meet aanwezigheid en geen juistheid.
   Ik heb dat op 2026-08-05 zelf gebruikt: zevenendertig endpoints van rood naar
   groen door de paden voluit te schrijven. De toets erachter deed echt werk,
   maar het getal betekende niet wat het leek te betekenen. Zolang dat de enige
   meter is, weet niemand hoeveel van die tweeduizend routes ECHT wordt
   nagerekend.

   DE EERLIJKE VRAAG. Als dit endpoint iets anders zou antwoorden, zou er dan een
   toets rood worden? Zo nee, dan controleert niemand hem -- hoe vaak hij ook
   wordt aangeroepen.

   HOE DIT WERKT. Per GROEP endpoints (een padvoorvoegsel, bijvoorbeeld
   /api/school/) draait de toetsenkast een keer met RTG_LIEG op die groep. De
   liegpoort (server/opzet/liegpoort.js) laat die endpoints dan een geldig maar
   LEEG antwoord geven: status 200, JSON, `ok: true`. Geen 500 en geen 404 -- die
   vallen op door de ruwste toets, en dan meet je of de route bestaat.

     valt er een DOMEINSPECIFIEKE toets om -> iemand kijkt naar de inhoud. Goed.
     valt er niets om, of alleen VEEGTOETSEN -> deze groep kan liegen.

   DAT ONDERSCHEID IS DE HELE TRUC, en het kostte de eerste versie zijn geldigheid.
   Deze suite heeft een handvol toetsen die ALLE endpoints aflopen: "geen enkel
   endpoint valt om", "de kluis blijft dicht", "elk /api-pad dat de app aanroept
   bestaat". Die vallen om zodra er ergens iets liegt, ongeacht waar. Zonder ze
   eruit te filteren meldt de detector bij elke groep "wordt nagerekend" -- en dan
   is het een meter die altijd groen geeft.

   De veegtoetsen worden niet met de hand opgesomd maar AFGELEID: het zijn de
   toetsen die bij ELKE gedraaide groep omvallen. Met een groep kan dat niet, dus
   de detector eist er minstens twee.

   Wat dat opleverde bij de eerste echte meting (2026-08-05): bij /api/school/
   vielen negen toetsen om en alle negen waren veegtoetsen -- geen enkele
   school-toets kijkt naar de inhoud van een school-antwoord. Bij /api/agenda/
   vielen er drieentwintig, waarvan veertien specifiek. Beide heetten "gedekt".

   WAAROM PER GROEP EN NIET PER ENDPOINT. Tweeduizend suite-ronden van tien
   minuten is honderdveertig dagen. Per groep is het een handvol ronden, en het
   antwoord is even bruikbaar: een groep die kan liegen bevat geen enkele toets
   die naar inhoud kijkt, en dat is precies de plek waar je begint. Wie het per
   endpoint wil weten, draait de detector daarna binnen die ene groep.

   WAT DIT NIET BEWIJST, en dat hoort erbij:

   - Een endpoint dat zijn werk in de DATABASE doet en weinig teruggeeft (wissen,
     boeken, boeken bijwerken) kan hier terecht slagen: de leugen zit in het
     antwoord, en de toets kijkt in de data.
   - Een groep die omvalt bewijst dat er EEN toets naar de inhoud kijkt, niet dat
     alle endpoints erin gedekt zijn. Het is een ondergrens, geen cijfer.
   - Het zegt niets over de kwaliteit van de assertie.

   Draai:  node scripts/leugendetector.js                 (alle groepen -- lang)
           node scripts/leugendetector.js /api/school/    (een groep)
           node scripts/leugendetector.js --json
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');

/* De groepen. Bewust met de hand en niet afgeleid uit de routekaart: een
   afgeleide lijst schuift mee met de code, en dan verandert de betekenis van het
   getal zonder dat iemand dat besluit. Dit zijn de domeinen zoals dit huis ze
   zelf benoemt (server/opzet/routes.js) plus de grote eigen takken. */
const GROEPEN = [
  '/api/member/', '/api/supplier/', '/api/office/', '/api/staff/', '/api/social/',
  '/api/techniek/', '/api/zakelijk/', '/api/auth/', '/api/foundation/',
  '/api/school/', '/api/bank/', '/api/pay/', '/api/bestanden/', '/api/agenda/'
];

function draaiSuite(patroon) {
  const t0 = Date.now();
  const r = spawnSync('npm', ['test'], {
    cwd: WORTEL, encoding: 'utf8', timeout: 3600000, maxBuffer: 512 * 1024 * 1024,
    env: Object.assign({}, process.env, { RTG_LIEG: patroon || '' })
  });
  const uit = String(r.stdout || '');
  const gezakt = (uit.match(/^not ok /gm) || []).length;
  const namen = (uit.match(/^not ok \d+ - (.*)$/gm) || []).map(s => s.replace(/^not ok \d+ - /, ''));
  const geteld = /^# tests (\d+)/m.exec(uit);
  return { gezakt, namen: namen.slice(0, 8), alleNamen: namen,
    toetsen: geteld ? Number(geteld[1]) : null,
    seconden: Math.round((Date.now() - t0) / 1000) };
}

if (require.main === module) {
  const arg = process.argv.filter(a => !a.startsWith('--'))[2];
  const groepen = arg ? [arg] : GROEPEN;
  const alsJson = process.argv.includes('--json');

  if (!alsJson) {
    console.log('\n\x1b[1mDE LEUGENDETECTOR\x1b[0m \x1b[2m-- kan deze groep liegen zonder dat een toets omvalt?\x1b[0m');
    console.log('\x1b[2m  Elke ronde is een volle toetsenkast; dit duurt.\x1b[0m\n');
  }

  /* EERST DE NULMETING. Zonder deze bewijst de rest niets: staat de suite al
     rood, dan is "er valt iets om" geen bewijs dat iemand de inhoud nakijkt. */
  const nul = draaiSuite('');
  if (nul.gezakt > 0) {
    console.error('  De toetsenkast is NIET groen zonder leugen (' + nul.gezakt +
      ' gezakt). Repareer dat eerst; anders meet deze proef niets.');
    console.error('  ' + nul.namen.join('\n  '));
    process.exit(1);
  }
  if (!alsJson) console.log('  nulmeting: ' + nul.toetsen + ' toetsen groen in ' + nul.seconden + ' s\n');

  if (groepen.length < 2) {
    console.error('  Minstens TWEE groepen nodig: de veegtoetsen worden afgeleid uit wat bij');
    console.error('  elke groep omvalt, en met een groep is dat niet te onderscheiden.');
    process.exit(1);
  }

  const ruw = [];
  for (const g of groepen) {
    const r = draaiSuite(g);
    ruw.push({ groep: g, gezakt: r.gezakt, namen: r.alleNamen, seconden: r.seconden });
    if (!alsJson) console.log('  ' + g.padEnd(22) + '\x1b[2m' + r.gezakt + ' omgevallen, ' + r.seconden + ' s\x1b[0m');
  }

  /* De veegtoetsen: wat bij ELKE groep omvalt. Vallen er bij een groep nul om,
     dan is de doorsnede leeg en zou alles specifiek lijken -- daarom tellen
     alleen de groepen mee die iets lieten omvallen. */
  const metVal = ruw.filter(r => r.namen.length);
  const veeg = metVal.length
    ? metVal.reduce((acc, r) => acc.filter(n => r.namen.includes(n)), metVal[0].namen.slice())
    : [];

  const uitslag = ruw.map(r => {
    const specifiek = r.namen.filter(n => !veeg.includes(n));
    return { groep: r.groep, gezakteToetsen: r.gezakt, veegtoetsen: r.namen.length - specifiek.length,
      specifiekeToetsen: specifiek.length, kanLiegen: specifiek.length === 0,
      seconden: r.seconden, voorbeelden: specifiek.slice(0, 5) };
  });

  if (!alsJson) {
    console.log('\n  \x1b[2mveegtoetsen (vallen bij elke groep om, dus geen bewijs): ' + veeg.length + '\x1b[0m\n');
    for (const u of uitslag) {
      const merk = u.kanLiegen ? '\x1b[31mKAN LIEGEN\x1b[0m' : '\x1b[32mwordt nagerekend\x1b[0m';
      console.log('  ' + u.groep.padEnd(22) + merk + '  \x1b[2m(' + u.specifiekeToetsen +
        ' specifieke toets(en), ' + u.veegtoetsen + ' veeg)\x1b[0m');
      if (u.voorbeelden.length) console.log('      \x1b[2m' + u.voorbeelden[0].slice(0, 88) + '\x1b[0m');
    }
  }

  const kunnen = uitslag.filter(u => u.kanLiegen);
  const rapport = { gedraaid: new Date().toISOString(), nulmeting: nul.toetsen,
    veegtoetsen: veeg, groepen: uitslag, groepenDieKunnenLiegen: kunnen.length };
  fs.writeFileSync(path.join(WORTEL, 'LEUGENS.json'), JSON.stringify(rapport, null, 2) + '\n');

  if (alsJson) { console.log(JSON.stringify(rapport, null, 2)); process.exit(0); }
  console.log('\n  \x1b[1m' + kunnen.length + ' van de ' + uitslag.length +
    ' groepen kan liegen zonder dat een toets omvalt.\x1b[0m');
  if (kunnen.length) console.log('  ' + kunnen.map(u => u.groep).join(' '));
  console.log('\n  \x1b[2mcijfers in LEUGENS.json; scripts/norm.js ratelt groepenDieKunnenLiegen.\x1b[0m\n');
}

module.exports = { GROEPEN, draaiSuite };
