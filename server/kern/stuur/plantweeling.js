/* DE PLAN TWIN -- een tijdelijke, geisoleerde projectie van een gewogen plan.

   Dit is bewust geen kopie van productie. Hij krijgt alleen het plan, de reeds
   berekende gevolgvoorspelling en de contractprojectie. Er is geen db, save,
   fetch of uitvoerder in deze module. Daardoor kan een scenario niets boeken,
   betalen of reserveren.

   De simuleerbaarheid heeft de drie woorden die EXECUTIE.md al reserveert:
   `exact`, `benaderend`, `niet-beschikbaar`. De huidige generieke gevolglaag
   kent collecties en verklaringen maar geen waarden, dus zij claimt nooit
   `exact`. Een domeinsimulator kan dat later alleen via een expliciete, geteste
   adapter toevoegen. */
'use strict';

const { voorspelMet } = require('./gevolgcontract/voorspelling');
const { projecteer } = require('./waarborgcontract');

const VORMEN = Object.freeze(['exact', 'benaderend', 'niet-beschikbaar']);

function vormVan(stap) {
  if (!stap) return 'niet-beschikbaar';
  if (stap.graad !== 'onbekend') return 'benaderend';
  if (stap.verklaring && stap.verklaring.stand === 'VOLLEDIG') return 'benaderend';
  return 'niet-beschikbaar';
}

function bouw(plan, opties) {
  const o = opties || {};
  const gevolg = o.gevolg || voorspelMet(plan, o.contracten);
  const perId = new Map((gevolg.stappen || []).map(s => [s.id, s]));
  const scenarios = (plan && Array.isArray(plan.stappen) ? plan.stappen : []).map(s => {
    const g = perId.get(s.id) || null;
    const waarborg = projecteer(s.capability, o.contracten);
    const simuleerbaarheid = vormVan(g);
    const onbekenden = [];
    if (!g || g.graad === 'onbekend') onbekenden.push('het directe opslaggevolg is niet gemeten');
    if (g && g.verklaring && g.verklaring.stand !== 'VOLLEDIG')
      onbekenden.push(g.verklaring.reden || 'de gevolgverklaring is niet volledig');
    if (waarborg.stand !== 'VOLLEDIG') onbekenden.push('het waarborgcontract is ' + waarborg.stand.toLowerCase());
    return {
      id: s.id, capability: s.capability, afhankelijkVan: (s.afhankelijkVan || []).slice(),
      simuleerbaarheid,
      basis: { soort: 'gevolgprojectie', actueel: false,
        reden: 'afgeleid uit de laatste gevolgmeting en het gevolgcontract; niet uit een live kopie van productie' },
      gevolg: g ? {
        graad: g.graad, collecties: (g.collecties || []).slice(), verklaring: g.verklaring,
        reden: g.reden
      } : { graad: 'onbekend', collecties: [], reden: 'geen gevolgprojectie voor deze stap' },
      waarborg, onbekenden
    };
  });
  const telling = { exact: 0, benaderend: 0, 'niet-beschikbaar': 0 };
  scenarios.forEach(s => telling[s.simuleerbaarheid]++);
  return {
    soort: 'plan-twin', versie: 1, doel: String((plan && plan.doel) || ''),
    tijdelijk: true, geisoleerd: true, verandertWerkelijkheid: false,
    scenarios, telling,
    uitvoerbaar: !!(plan && plan.uitvoerbaar) && telling['niet-beschikbaar'] === 0,
    grens: 'Deze Plan Twin vergelijkt verklaringen en eerdere metingen. Hij reserveert niets, ' +
      'verleent geen toestemming en garandeert geen actuele beschikbaarheid. Voor uitvoering ' +
      'moet RTG de live toestand en bevoegdheid opnieuw lezen.'
  };
}

module.exports = { bouw, vormVan, VORMEN };
