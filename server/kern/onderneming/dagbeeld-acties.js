/* Onderneming-deelmodule "dagbeeld-acties": wat er vandaag toe doet.

   Los van ./dagbeeld.js omdat dat bestand over de 10 kB van het modulebeleid
   ging. De naad is inhoudelijk: daar staat wat het scherm TOONT (groet,
   cijfers, gezondheid), hier staat wat de ondernemer moet DOEN. Een actie
   erbij verandert het scherm dus niet van vorm.

   DE VOLGORDE IS DE INHOUD. Wat het plan breekt gaat voorop, dan wat er
   ontbreekt, dan wat er kan. En elke actie zegt WAAROM hij er staat: een
   lijstje opdrachten zonder reden wordt een afvinklijst, en daarin verdwijnt
   ook de belangrijke. */
'use strict';

module.exports = ({ boekingenVanZaak, intakeOntbreekt }) => {

  function acties(o, feiten, verk, project) {
    const uit = [];
    const zet = (id, kop, waarom, waarheen) => uit.push({ id, kop, waarom, waarheen });

    // 1. wat het plan breekt gaat voorop
    if (verk && verk.stress && verk.stress.ok) {
      for (const b of verk.stress.bevindingen.filter(x => x.zwaarte === 'blokkerend')) {
        zet('stress:' + b.id, b.kop, b.wat + ' ' + b.doen, 'verkenning');
      }
    }
    // 2. de verkenning afmaken
    const mistSim = intakeOntbreekt(o.intake || {}, 'simulatie');
    if (mistSim && mistSim.length) {
      zet('intake-simulatie', 'Maak uw cijfers af',
        'Zonder ' + mistSim.join(', ') + ' kunnen we uw plan niet doorrekenen.', 'intake');
    }
    const mistPlan = intakeOntbreekt(o.intake || {}, 'plan');
    if (mistPlan && mistPlan.length) {
      zet('intake-plan', 'Vul uw plan aan',
        'Nog te beschrijven: ' + mistPlan.join(', ') + '.', 'intake');
    }
    // 3. het plan vastleggen
    if (verk && verk.plan && verk.plan.volledig && !(o.plan && o.plan.vastgelegd)) {
      zet('plan-vastleggen', 'Leg uw ondernemingsplan vast',
        'Uw plan is compleet. Vastleggen bevriest deze versie en brengt u naar de volgende fase.', 'plan');
    }
    // 4. de rechtsvorm
    if (!o.rechtsvorm) {
      zet('rechtsvorm', 'Kies een rechtsvorm',
        'Eenmanszaak, B.V. of stichting bepaalt uw aansprakelijkheid, uw belasting en wat u moet regelen.', 'rechtsvorm');
    }
    // 5. het oprichtingsproject, zodra er een rechtsvorm is om het op te bouwen
    if (project && project.stand === 'bezig' && project.totaal) {
      const open = project.totaal - project.gedaan;
      zet('oprichtingsproject', 'Nog ' + open + ' van de ' + project.totaal + ' oprichtingsstappen',
        'Wat u moet regelen hangt af van uw rechtsvorm, uw branche en uw plan. De lijst staat klaar.', 'oprichting');
    }
    // 6. inschrijven
    if (o.plan && o.plan.vastgelegd && !o.kvk) {
      zet('inschrijven', 'Schrijf uw onderneming in',
        'Uw plan ligt er. De inschrijving maakt de onderneming officieel.', 'oprichting');
    }
    // 7. de zaak aanvragen of koppelen
    if (o.kvk && !o.supplierCode) {
      zet(o.aanmeldingId ? 'aanvraag-loopt' : 'vraag-zaak-aan',
        o.aanmeldingId ? 'Uw aanvraag ligt bij RTG' : 'Vraag uw zaak aan',
        o.aanmeldingId
          ? 'Een medewerker beoordeelt hem. Zodra de zaak klaarstaat, kunt u hem hier koppelen.'
          : 'U bent ingeschreven. Met een zaak kunt u verkopen, factureren en in de Mall staan.',
        'zaak');
    }
    // 8. wat er ligt
    if (o.supplierCode) {
      const wacht = (boekingenVanZaak(o.supplierCode) || []).filter(b => b && b.status === 'aangevraagd').length;
      if (wacht) {
        zet('aanvragen', wacht + ' aanvra' + (wacht === 1 ? 'ag wacht' : 'gen wachten') + ' op antwoord',
          'Een aanvraag die blijft liggen, wordt een klant die ergens anders koopt.', 'zaak');
      }
    }
    return uit;
  }

  return { acties };
};
