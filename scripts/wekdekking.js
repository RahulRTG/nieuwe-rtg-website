#!/usr/bin/env node
/* ============================================================================
   DE WEKDEKKING -- welke brongebeurtenis bereikt de publieke rail, en welke
   met opzet niet.

   DE VRAAG. STAGE.md par. 0 meet dat 5 van de 11 publieke domeinen de wekhaak
   `nieuwWerk()` aanroepen en 6 niet. Dat getal zegt WAT er ontbreekt en niet
   wat er zou MOETEN zijn -- en juist dat tweede is waar het misgaat. Een
   wekhaak overal aansluiten betekent langzaam: iedere databasewijziging wordt
   content.

   DUS TWEE DINGEN NAAST ELKAAR, EN ZE WORDEN NOOIT OPGETELD:

     HET BESLUIT   scripts/lib/wekbesluit.js -- per brongebeurtenis een klasse
                   (moment / stil / niet) met een grond. Mensenwerk.
     DE METING     dit bestand -- houdt dat besluit tegen de code: bestaat de
                   bron nog, is er een domein zonder uitspraak, en heeft een
                   belofte een mechanisme.

   Dezelfde vorm als IDEMPROEF.json naast IDEMBESLUIT.json, en om dezelfde
   reden: een besluit dat een meting overschrijft is geen besluit maar een
   doofpot, en een meting die een besluit overschrijft dwingt een mens tot
   niets.

   DE DRIE DINGEN DIE HIJ VINDT

   1. ZONDER UITSPRAAK. Een publiek domein waarover het register zwijgt. Dit is
      de teller die voorkomt dat een ZEVENDE domein over drie maanden stil
      verschijnt: hij hoort op nul te staan, en hij stijgt zodra er een publiek
      domein bijkomt waar niemand over heeft nagedacht.

   2. EEN BELOFTE ZONDER MECHANISME. Een gebeurtenis in klasse `moment` mag
      wekken -- maar kan het domein dat ook? Vandaag roepen vijf domeinen de
      haak aan en zes niet, dus elke `moment` in die zes is een belofte die
      niemand kan waarmaken. Dat staat hier als GETAL en niet als plan.

   3. IS ER IEMAND OM TE WEKKEN. De wekhaak wekt VOLGERS, en de volgerslijst
      komt uit het domein zelf. Een domein zonder volgrelatie kan dus wel een
      publiek moment hebben en toch niemand wekken. Die twee vragen lopen
      makkelijk door elkaar en worden hier apart geteld.

   DE VALKUIL DIE DEZE METER VOOR ZICHZELF ZET. `volgers` is niet overal een
   relatie. In kern/creator.js is het een GETAL over een extern platform (het
   bereik dat de maker zelf opgeeft). Wie dat voor een volgerslijst aanziet,
   bedraadt een haak die niemand wekt -- en dat valt niet op, want nul
   meldingen ziet er hetzelfde uit als nul volgers. Daarom wordt hier gezocht
   naar een FUNCTIE die volgers oplevert en nooit naar het woord.

   Draai: node scripts/wekdekking.js            (leesbaar)
          node scripts/wekdekking.js --json     (voor de ratel)
          npm run wekdekking:vast               (schrijft WEKDEKKING.json)
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');
const { BESLUITEN, MOETEN, KLASSEN } = require('./lib/wekbesluit');
const sv = require('./stagevorm.js');
const om = require('./objectmodel.js');

const WORTEL = path.join(__dirname, '..');

/* Roept dit domein de wekhaak aan? Exact dezelfde vraag als meting C van
   scripts/stagevorm.js, en daarom wordt die hergebruikt in plaats van
   nagebouwd -- twee tellers over hetzelfde lopen binnen een maand uiteen
   (LAT.md regel 4). */
function haakStand() {
  const h = sv.meet().gemeten.haak;
  const met = new Set(h.waar.map(x => x.domein));
  return { met, alle: h.publiekeDomeinen, zonder: h.zonderHaak };
}

/* Heeft dit domein een VOLGRELATIE die ledensleutels oplevert? Er wordt gezocht
   naar een functie, niet naar een woord: `volgers: 4200` in een profiel is een
   bereikgetal en geen relatie. Gevonden wordt een definitie van de vorm
   `volgersVan(` / `abonneesVan(` -- als functienaam, hoe hij ook wordt
   geschreven (const, function, of als objectveld). */
const VOLGVORM = /\b(?:function\s+)?(volgersVan|abonneesVan|volgerskeys)\s*(?:=\s*)?(?:\(|=>|function)/;

function volgrelaties() {
  const paden = om.BRONNEN.reduce((a, m) => om.bestanden(m, a), []);
  const uit = new Map();
  for (const p of paden) {
    if (!sv.DOMEINEN.test(p)) continue;
    const d = sv.stageDomein(p);
    if (!uit.has(d)) uit.set(d, []);
    const s = om.wring(fs.readFileSync(path.join(WORTEL, p), 'utf8'));
    if (VOLGVORM.test(s)) uit.get(d).push(p);
  }
  return uit;
}

function meet() {
  const haak = haakStand();
  const volg = volgrelaties();

  /* Elke bron in het register moet bestaan. Een besluit dat naar een verdwenen
     bestand wijst, is geen besluit meer maar een herinnering. */
  const bronWeg = BESLUITEN.filter(b => !fs.existsSync(path.join(WORTEL, b.bron)))
    .map(b => ({ gebeurtenis: b.gebeurtenis, bron: b.bron }));

  const foutKlasse = BESLUITEN.filter(b => !KLASSEN.includes(b.klasse))
    .map(b => ({ gebeurtenis: b.gebeurtenis, klasse: b.klasse }));

  /* Domeinen zonder uitspraak: publiek, geen wekhaak, en het register zwijgt.
     De lijst MOETEN wordt hier NIET geloofd maar vergeleken met wat
     stagevorm.js meet -- anders kan het register zichzelf gelijk geven door een
     domein uit zijn eigen lijst te laten. */
  const besproken = new Set(BESLUITEN.map(b => b.domein));
  const zonderUitspraak = haak.zonder.filter(d => !besproken.has(d));
  const registerLoopUit = MOETEN.filter(d => !haak.zonder.includes(d) && !haak.met.has(d));

  /* Een `moment` in een domein dat de haak niet aanroept, is een belofte zonder
     mechanisme. Dat is geen fout in het register -- het is de opdracht. */
  const momenten = BESLUITEN.filter(b => b.klasse === 'moment');

  /* EEN MOMENT ZONDER AANLEIDING. Elk `moment` noemt het stukje code dat hem
     veroorzaakt; hier wordt gekeken of dat er ook echt staat. Een belofte
     waarvan de oorzaak nergens te vinden is, is een wachter zonder bron -- en
     die hoort te zeggen dat hij niet kijkt in plaats van groen te staan.
     Gezocht wordt in de GEWRONGEN bron: een aanleiding die alleen in een
     commentaarregel voorkomt, is geen aanleiding. */
  const zonderAanleiding = momenten.filter(b => {
    if (!b.aanleiding) return true;
    const vol = path.join(WORTEL, b.bron);
    if (!fs.existsSync(vol)) return true;
    return !om.wring(fs.readFileSync(vol, 'utf8')).includes(b.aanleiding);
  }).map(b => ({ gebeurtenis: b.gebeurtenis, bron: b.bron, aanleiding: b.aanleiding || null }));
  const zonderWekweg = momenten.filter(b => !haak.met.has(b.domein))
    .map(b => ({ gebeurtenis: b.gebeurtenis, domein: b.domein }));
  const zonderVolgers = momenten.filter(b => !(volg.get(b.domein) || []).length)
    .map(b => ({ gebeurtenis: b.gebeurtenis, domein: b.domein }));

  const perDomein = MOETEN.map(d => ({
    domein: d,
    besluiten: BESLUITEN.filter(b => b.domein === d).length,
    moment: BESLUITEN.filter(b => b.domein === d && b.klasse === 'moment').length,
    stil: BESLUITEN.filter(b => b.domein === d && b.klasse === 'stil').length,
    niet: BESLUITEN.filter(b => b.domein === d && b.klasse === 'niet').length,
    haak: haak.met.has(d),
    volgrelatie: (volg.get(d) || []).length ? (volg.get(d) || []) : null
  }));

  return {
    gemeten: {
      besluiten: BESLUITEN.length,
      moment: momenten.length,
      stil: BESLUITEN.filter(b => b.klasse === 'stil').length,
      niet: BESLUITEN.filter(b => b.klasse === 'niet').length,
      publiekeDomeinen: haak.alle,
      domeinenMetHaak: haak.met.size,
      zonderUitspraak: zonderUitspraak.length,
      momentZonderWekweg: zonderWekweg.length,
      momentZonderVolgers: zonderVolgers.length,
      momentZonderAanleiding: zonderAanleiding.length,
      bronWeg: bronWeg.length,
      foutKlasse: foutKlasse.length,
      registerLoopUit: registerLoopUit.length
    },
    zonderUitspraak, zonderWekweg, zonderVolgers, zonderAanleiding, bronWeg, foutKlasse, registerLoopUit, perDomein
  };
}

module.exports = { meet };

if (require.main === module) {
  const r = meet();
  const g = r.gemeten;
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r)); process.exitCode = 0; return; }
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'WEKDEKKING.json'), JSON.stringify(Object.assign({
      stempel: stempel({ instrument: 'scripts/wekdekking.js' }),
      uitleg: 'Gemeten met scripts/wekdekking.js tegen het besluitregister scripts/lib/wekbesluit.js. Het besluit (welke brongebeurtenis mag de publieke rail op) is mensenwerk; deze meting houdt dat besluit tegen de code. De twee worden nooit opgeteld.',
      grens: 'Wat deze meter NIET aantoont: dat de klassen JUIST zijn gekozen -- dat is een besluit van een mens en geen meetuitslag. Hij toont ook niet dat een gebeurtenis werkelijk optreedt in de code: hij controleert dat het genoemde BRONBESTAND bestaat, niet dat er een regel in staat die precies deze gebeurtenis veroorzaakt. En `zonderUitspraak` telt alleen publieke domeinen ZONDER wekhaak: een domein dat de haak al aanroept, wordt hier niet opnieuw beoordeeld.',
      vastgelegd: new Date().toISOString().slice(0, 10)
    }, r), null, 2) + '\n');
    console.log('WEKDEKKING.json geschreven.');
  }
  console.log('\nDE WEKDEKKING -- wat mag de publieke rail op?\n');
  console.log('  besluiten          : ' + g.besluiten + '  (moment ' + g.moment + ', stil ' + g.stil + ', niet ' + g.niet + ')');
  console.log('  publieke domeinen  : ' + g.publiekeDomeinen + ', met wekhaak ' + g.domeinenMetHaak);
  console.log('  ZONDER UITSPRAAK   : ' + g.zonderUitspraak + (r.zonderUitspraak.length ? '  ' + r.zonderUitspraak.join(' ') : ''));
  console.log('  moment zonder wekweg  : ' + g.momentZonderWekweg + (r.zonderWekweg.length ? '  ' + r.zonderWekweg.map(x => x.gebeurtenis).join(' ') : ''));
  console.log('  moment zonder volgers : ' + g.momentZonderVolgers + (r.zonderVolgers.length ? '  ' + r.zonderVolgers.map(x => x.gebeurtenis).join(' ') : ''));
  console.log('  moment zonder aanleiding: ' + g.momentZonderAanleiding + (r.zonderAanleiding.length ? '  ' + r.zonderAanleiding.map(x => x.gebeurtenis).join(' ') : ''));
  console.log('  bron verdwenen     : ' + g.bronWeg + (r.bronWeg.length ? '  ' + r.bronWeg.map(x => x.bron).join(' ') : ''));
  console.log('  register loopt uit : ' + g.registerLoopUit + (r.registerLoopUit.length ? '  ' + r.registerLoopUit.join(' ') : ''));
  console.log('\n  per domein:');
  for (const d of r.perDomein) {
    console.log('    ' + d.domein.padEnd(16) + String(d.besluiten).padStart(2) + ' besluit(en)  haak: ' +
      (d.haak ? 'ja ' : 'nee') + '  volgrelatie: ' + (d.volgrelatie ? d.volgrelatie[0] : 'geen'));
  }
  console.log('');
}
