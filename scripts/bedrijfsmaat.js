/* DE BEDRIJFSMAATMETER -- welke cijfers over RTG als onderneming bestaan, en
   waar precies het getal vandaan komt.

   De catalogus staat in server/kern/bedrijfsmaat/ (gegevens plus regels); deze
   meter levert het ENIGE dat de runtime niet mag doen: de bron lezen. Per maat
   staan vier elementen met citaten (bron, definitie, projectie, bewijs), en hier
   wordt nagekeken of elk citaat letterlijk in zijn bestand staat.

   ZONDER COMMENTAAR, BEHALVE BIJ EEN DEFINITIE. Een bron, projectie of bewijs is
   gedrag, en gedrag staat in code: een functienaam die alleen in een kop
   genoemd wordt, bestaat niet (BEWIJSMACHINE.md par. 6a -- een meter die zijn
   eigen commentaar leest, meet niets). Een definitie mag wel in proza staan,
   want daar legt dit huis betekenis vast.

   EEN CITAAT DAT NIET KLOPT, LAAT DE CONTROLE ZAKKEN. Dan zegt de catalogus iets
   wat de code niet zegt, en die maat telt dat element als afwezig.

   GEBRUIK
     npm run bedrijfsmaat            samenvatting
     npm run bedrijfsmaat -- --json  het hele register op stdout
     npm run bedrijfsmaat:vast       schrijft BEDRIJFSMAAT.json (alleen op een schone boom)
     npm run bedrijfsmaat:controle   vers gemeten tegen het register; schrijft niets */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel, eisSchoneBoom } = require('./lib/stempel');
const { zonderCommentaar } = require('./lib/bron');
const B = require('../server/kern/bedrijfsmaat');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'BEDRIJFSMAAT.json');
const GEDRAG = new Set(['bron', 'projectie', 'bewijs', 'groepsgrens']);

function maakKlopt() {
  const cache = new Map();
  const tekst = (bestand, metCommentaar) => {
    const sleutel = bestand + (metCommentaar ? '#vol' : '#code');
    if (cache.has(sleutel)) return cache.get(sleutel);
    const vol = path.resolve(WORTEL, bestand);
    let t = null;
    if (vol.startsWith(WORTEL + path.sep) && fs.existsSync(vol)) {
      t = fs.readFileSync(vol, 'utf8');
      if (!metCommentaar && bestand.endsWith('.js')) t = zonderCommentaar(t);
    }
    cache.set(sleutel, t);
    return t;
  };
  return (x, element) => {
    const t = tekst(x.bestand, !GEDRAG.has(element));
    return t != null && t.includes(x.citaat);
  };
}

function tel(lijst, sleutel) {
  const uit = {};
  for (const x of lijst) { const k = sleutel(x); uit[k] = (uit[k] || 0) + 1; }
  return uit;
}

function meet() {
  const inv = B.beoordeel(maakKlopt());
  const maten = inv.maten;
  const perStatus = Object.assign({ bestaat: 0, half: 0, ontbreekt: 0, onbekend: 0 }, tel(maten, m => m.status));
  const alleGaten = Object.values(B.GATEN);
  const perGat = Object.fromEntries(alleGaten.map(g => [g, maten.filter(m => m.gaten.includes(g)).length]));
  const primairGat = Object.fromEntries(alleGaten.map(g => [g, maten.filter(m => m.gaten[0] === g).length]));
  const perDomein = {};
  for (const d of B.DOMEINEN) {
    const ms = maten.filter(m => m.domein === d);
    perDomein[d] = { maten: ms.length, bestaat: ms.filter(m => m.status === 'bestaat').length,
      half: ms.filter(m => m.status === 'half').length, ontbreekt: ms.filter(m => m.status === 'ontbreekt').length };
  }
  const perWereld = tel(maten, m => m.wereld);
  return {
    uitleg: 'Het bedrijfsmaatregister: per maat over RTG als onderneming of die bestaat, en zo niet, welk van de vier ' +
      'elementen ontbreekt (bron, definitie, projectie, bewijs). Een PROJECTIE op bestaande bronnen; er staat geen enkele ' +
      'waarde in. De catalogus en de regels wonen in server/kern/bedrijfsmaat/, de meter controleert elk citaat in de bron.',
    grens: 'Dit register zegt NIET hoe groot een maat is, en niet of zijn uitkomst juist is: alleen of hij aantoonbaar ' +
      'bestaat en waar hij vandaan komt. Een maat die bestaat kan nog steeds verkeerd rekenen. De status is beschrijvend ' +
      'en wordt nooit opgeteld tot een score; perGat telt elke maat bij elk van haar gaten, primairGat alleen bij het eerste.',
    versie: B.VERSIE,
    besluiten: B.BESLUITEN,
    telling: {
      maten: maten.length, domeinen: B.DOMEINEN.length, perStatus, primairGat, perGat,
      ketens: inv.ketens.length, ketensGegrond: inv.ketens.filter(k => k.gegrond).length,
      bestaatGedeeltelijk: maten.filter(m => m.status === 'bestaat' && m.gedeeltelijk).length,
      rustOpGat: inv.rustOpGat.length, privacyGaten: inv.privacyGaten.length,
      verworpen: inv.verworpen.length, vormfouten: B.vormfouten().length
    },
    perDomein, perWereld,
    ketens: inv.ketens, rustOpGat: inv.rustOpGat, privacyGaten: inv.privacyGaten,
    verworpen: inv.verworpen, vormfouten: B.vormfouten(),
    graaf: inv.graaf, maten
  };
}

/* De getallen die dragen: dezelfde vorm als in de toets, zodat controle en toets
   nooit over iets anders gaan. */
const dragend = (r) => JSON.stringify({ telling: r.telling, status: r.maten.map(m => [m.id, m.status, m.gaten]) });

module.exports = { meet, dragend, maakKlopt, DOEL };

if (require.main === module) {
  const r = meet();
  const arg = process.argv.slice(2);
  if (arg.includes('--json')) {
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  } else if (arg.includes('--vastleggen')) {
    const poort = eisSchoneBoom('bedrijfsmaat');
    if (!poort.ok) { console.error('[bedrijfsmaat] ' + poort.reden); process.exit(2); }
    if (r.verworpen.length || r.vormfouten.length) {
      console.error('[bedrijfsmaat] de catalogus klopt niet (' + r.verworpen.length + ' citaten verworpen, ' +
        r.vormfouten.length + ' vormfouten); eerst repareren, dan vastleggen.');
      process.exit(1);
    }
    fs.writeFileSync(DOEL, JSON.stringify(Object.assign({ stempel: stempel() }, r), null, 2) + '\n');
    console.log('[bedrijfsmaat] BEDRIJFSMAAT.json vastgelegd: ' + r.telling.maten + ' maten.');
  } else if (arg.includes('--controle')) {
    const fouten = [];
    if (r.vormfouten.length) fouten.push(...r.vormfouten.map(v => 'vorm: ' + v));
    for (const v of r.verworpen) fouten.push('verworpen: ' + v.maat + ' ' + v.element + ' -- "' + v.citaat + '" staat niet in ' + v.bestand);
    if (!fs.existsSync(DOEL)) fouten.push('BEDRIJFSMAAT.json ontbreekt -- draai: npm run bedrijfsmaat:vast');
    else if (dragend(JSON.parse(fs.readFileSync(DOEL, 'utf8'))) !== dragend(r))
      fouten.push('BEDRIJFSMAAT.json loopt achter op de catalogus of de code -- draai: npm run bedrijfsmaat:vast');
    if (fouten.length) { for (const f of fouten) console.error('[bedrijfsmaat] ' + f); process.exitCode = 1; }
    else console.log('[bedrijfsmaat] in orde: ' + r.telling.maten + ' maten, register gelijk aan een verse meting.');
  } else {
    const t = r.telling;
    console.log('Bedrijfsmaten: ' + t.maten + ' over ' + t.domeinen + ' domeinen');
    console.log('  status      ' + Object.entries(t.perStatus).map(([k, v]) => k + ' ' + v).join(' · '));
    console.log('  eerste gat  ' + Object.entries(t.primairGat).map(([k, v]) => k + ' ' + v).join(' · '));
    console.log('  ketens      ' + t.ketensGegrond + ' van ' + t.ketens + ' gegrond');
    for (const k of r.ketens) console.log('    ' + k.id.padEnd(9) + (k.gegrond ? 'gegrond' : 'breekt bij ' + k.eersteBreuk) + ' (' + k.bestaand + '/' + k.van + ')');
    console.log('  privacygaten ' + t.privacyGaten + ' · rust op een gat ' + t.rustOpGat + ' · verworpen ' + t.verworpen + ' · vormfouten ' + t.vormfouten);
    for (const v of r.verworpen) console.log('    verworpen: ' + v.maat + ' ' + v.element + ' "' + v.citaat + '" in ' + v.bestand);
  }
}
