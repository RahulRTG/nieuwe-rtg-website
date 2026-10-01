#!/usr/bin/env node
'use strict';
/* Bewaak de kwaliteitsvelden van bestaande meetrapporten tegen het aftakpunt.
   Een ontbrekend rapport/veld is geen nul. Volumetellingen en machine-afhankelijke
   tijden krijgen hier geen plafond: groei van het product is geen regressie.
   Dit bewijst geen nieuw gedrag; de eigen meetinstrumenten blijven de bron.
   De tegenproeven in test/registerratel.test.js bewijzen dat elke regel bijt. */
const fs = require('fs');
const path = require('path');
const { bepaalBasis, versieBij } = require('./lib/basis');
const REGELS = {
  'AANROEPGRAAF.json': { 'gemeten.nietGelezen': 'omlaag', 'gemeten.doelOnbekend': 'omlaag' },
  'AUDITPROEF.json': { 'gemeten.gezakt': 'omlaag', 'gemeten.blindeRondes': 'omlaag', 'gemeten.ketenHeel': 'waar' },
  'CONTEXTPROEF.json': { 'gemeten.routesZonderSpoorMaarWelAanHetWerk': 'omlaag', 'gemeten.volledigeRonde': 'waar' },
  'CONTROLS.json': { 'gemeten.nietGroen': 'omlaag', 'gemeten.nietInBedrijf': 'omlaag' },
  'DUURZAAMHEIDSKOSTEN.json': { 'gemeten.blindeRondes': 'omlaag', 'gemeten.verzoekenPerRoute': 'omhoog' },
  'ENVELOP.json': { 'gemeten.veldenZonderHuis': 'omlaag', 'gemeten.actorDuplicaten': 'omlaag' },
  'GRAAFAS.json': { 'gemeten.buitenHetRegister': 'omlaag' },
  'HANDELINGPROEF.json': { 'gemeten.gezakt': 'omlaag', 'gemeten.ketenOk': 'waar' },
  'HANDLERWACHT.json': { 'gemeten.onbewaakt': 'omlaag', 'gemeten.laat': 'omlaag', 'gemeten.nietGelezen': 'omlaag' },
  'IDOR.json': { 'gemeten.doorbraak': 'omlaag', 'gemeten.lek': 'omlaag' },
  'INHOUDSKAART.json': { 'gemeten.weerlegd': 'omlaag', 'gemeten.dood': 'omlaag' },
  'KERNHERKOMST.json': { 'gemeten.onopgelost': 'omlaag' },
  'KLOKWACHT.json': { 'gemeten.totaal': 'omlaag' },
  'MAGNAATLAB.json': { 'modulesDiePratenNaarBuiten': 'omlaag' },
  'MUTATIEBOEK.json': { 'gemeten.statusSluit': 'waar', 'gemeten.sluit': 'waar' },
  'MUTATIESEMANTIEK.json': { 'gemeten.tegenspraken': 'omlaag', 'gemeten.onbekendeKlassen': 'omlaag' },
  'ONBEWEZEN.json': { 'gemeten.sluit': 'waar' },
  'ONDERZOEKSKETEN.json': { 'gemeten.ontbrekendeBestanden': 'leeg' },
  'OUTPUTPROEF.json': { 'gemeten.onbeslist': 'omlaag', 'gemeten.blind': 'omlaag', 'gemeten.bewezen': 'omhoog' },
  'ROUTEBRON.json': { 'gemeten.waarvanTegenspraak': 'omlaag', 'gemeten.routerRoutesZonderBestand': 'omlaag' },
  'SCHERMGEDRAG.json': { 'gemeten.onbekendeBewijswaarden': 'leeg' },
  'SCHERMROUTES.json': { 'gemeten.doodPad': 'omlaag', 'gemeten.nietGelezen': 'omlaag' },
  'SYMBOLEN.json': { 'gemeten.waarvanParsefout': 'omlaag', 'gemeten.uitvoerOnvolledig': 'omlaag' },
  'VERRAAD.json': { 'gemeten.blindeInjecties': 'omlaag', 'gemeten.onherhaalbareRondes': 'omlaag', 'gemeten.toegediend': 'omhoog' },
  'WAAROM.json': { 'gemeten.onbekend': 'omlaag' }
};
const veld = (obj, sleutel) => sleutel.split('.').reduce((o, k) => o && Object.hasOwn(o, k) ? o[k] : undefined, obj);
function vergelijk(naam, nu, basis) {
  const fouten = [];
  for (const [sleutel, richting] of Object.entries(REGELS[naam] || {})) {
    const waarde = veld(nu, sleutel), toen = veld(basis, sleutel);
    const prefix = naam + ' ' + sleutel + ': ';
    if (richting === 'waar' || richting === 'leeg') {
      const geldig = v => richting === 'waar' ? v === true : Array.isArray(v) && v.length === 0;
      if (!geldig(waarde)) fouten.push(prefix + 'invariant geschonden of niet gemeten');
    } else if (!Number.isFinite(waarde) || !Number.isFinite(toen)) {
      fouten.push(prefix + 'nu of in de basis niet gemeten');
    } else if (richting === 'omlaag' ? waarde > toen : waarde < toen) {
      fouten.push(prefix + toen + ' -> ' + waarde + ' is een regressie');
    }
  }
  return fouten;
}
function controleer(wortel = path.join(__dirname, '..'), gevraagd = process.env.RTG_BASIS) {
  const basis = bepaalBasis(wortel, gevraagd);
  if (basis.fout) return [basis.fout];
  const fouten = [];
  for (const naam of Object.keys(REGELS)) {
    try {
      const nu = JSON.parse(fs.readFileSync(path.join(wortel, naam), 'utf8'));
      const toen = JSON.parse(versieBij(wortel, basis.ref, naam));
      if (!nu || !toen) throw new Error('rapport ontbreekt');
      fouten.push(...vergelijk(naam, nu, toen));
    } catch (e) { fouten.push(naam + ': niet controleerbaar: ' + e.message); }
  }
  return fouten;
}
if (require.main === module) {
  const fouten = controleer();
  console.log(fouten.length ? fouten.join('\n') : Object.keys(REGELS).length + ' meetrapporten zonder regressie');
  process.exitCode = fouten.length ? 1 : 0;
}
module.exports = { REGELS, vergelijk, controleer };
