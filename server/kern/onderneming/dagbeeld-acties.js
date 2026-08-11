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

const DEBITEUREN = require('./debiteuren');
const CREDITEUREN = require('./crediteuren');
const CONTRACTEN = require('./contracten');
const BELASTING = require('./belasting');
const KAS = require('./kas');
const CAPACITEIT = require('./capaciteit');
const WERVING = require('./werving');
const PIJPLIJN = require('./pijplijn-opvolging');
const VOORRAAD = require('./voorraad');
const KLUSSEN = require('./klussen');
const TOEGANG = require('./toegang');

module.exports = ({ boekingenVanZaak, intakeOntbreekt }) => {

  function acties(o, feiten, verk, project, eersteklant, mall, rel, deb, cred, con, bel, kas, cap, wrv, pij, vrd, klu, tgn) {
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
    /* 8. klaarstaan voor de eerste klant. Dit gaat VOOR de losse aanvragen,
       want een zaak die niet online staat krijgt er ook geen. */
    if (eersteklant && eersteklant.open.length) {
      const e = eersteklant.open[0];
      zet('eersteklant', eersteklant.doel === 'klaarstaan'
        ? 'Klaarstaan voor uw eerste klant (' + eersteklant.percentage + '%)'
        : 'Nog ' + eersteklant.open.length + ' punt(en) open in uw etalage',
        e.label + ': ' + e.waarom, 'eersteklant');
    }
    if (eersteklant && eersteklant.volgende && eersteklant.klanten > 0) {
      zet('mijlpaal', 'Nog ' + eersteklant.volgende.teGaan + ' tot ' + eersteklant.volgende.label.toLowerCase(),
        eersteklant.volgende.wat, 'eersteklant');
    }
    /* 9. de kasvooruitblik. Bovenaan het geldblok, want dit is de optelsom
       van de rest: een tekort over dertig dagen zegt meer dan elke losse post
       eronder. */
    if (kas) {
      const v = KAS.kasOpvolging(kas);
      if (v) zet('kas', v.kop, v.waarom, 'kas');
    }
    /* 10. vervallen facturen. Dit is het meest concrete geld dat er ligt: al
       verdiend, alleen nog niet binnen. Het gaat daarom voor de rest van de
       opvolging. */
    if (deb) {
      const v = DEBITEUREN.debiteurenOpvolging(deb);
      if (v) zet('debiteuren', v.kop, v.waarom, 'debiteuren');
    }
    /* 11. wat u zelf te laat betaalt. Direct na de debiteuren: allebei geld
       dat al vaststaat, maar geld dat binnen moet komen gaat voor geld dat
       eruit moet -- het eerste betaalt het tweede. */
    if (cred) {
      const v = CREDITEUREN.crediteurenOpvolging(cred);
      if (v) zet('crediteuren', v.kop, v.waarom, 'crediteuren');
    }
    /* 12. de btw. Direct na het geld dat vaststaat: dit IS geld dat vaststaat,
       alleen andersom -- het staat op de rekening en is niet van de zaak. Voor
       de contractklok, want een verkeerd besteed btw-bedrag merk je pas bij de
       aangifte en dan is het op. */
    if (bel) {
      const v = BELASTING.belastingOpvolging(bel);
      if (v) zet('btw', v.kop, v.waarom, 'belasting');
    }
    /* 13. de contractklok. Na het geld dat vaststaat, maar VOOR de gewone
       opvolging: een gemiste opzegdag kost een heel jaar en is daarna niet
       meer te repareren, waar een klant die niet terugbelt dat wel is. */
    if (con) {
      for (const v of CONTRACTEN.contractenOpvolging(con)) zet('contract:' + v.id, v.kop, v.waarom, 'contracten');
    }
    /* 14. de capaciteit. Na het geld en de klok, want dit gaat niet over iets
       dat vandaag misgaat maar over de grens waar u tegenaan loopt. Wel VOOR
       de gewone opvolging: meer klanten werven terwijl de agenda vol staat,
       is werk dat u daarna moet weigeren. */
    if (cap) {
      const v = CAPACITEIT.capaciteitOpvolging(cap);
      if (v) zet('capaciteit', v.kop, v.waarom, 'capaciteit');
    }
    /* 15. de werving. Direct achter de capaciteit, want het is het antwoord op
       dezelfde vraag: een sollicitatie die blijft liggen is de duurste vorm van
       te druk zijn. */
    if (wrv) {
      for (const v of WERVING.wervingOpvolging(wrv, cap)) zet('werving:' + v.id, v.kop, v.waarom, 'werving');
    }
    /* 16. de voorraad. Direct achter de capaciteit en de werving, want het is
       dezelfde soort grens: geen agenda maar een schap dat leeg raakt. Vóór de
       verkoopkant, want wat u niet heeft kunt u ook niet verkopen. */
    if (vrd) {
      const v = VOORRAAD.voorraadOpvolging(vrd);
      if (v) zet('voorraad', v.kop, v.waarom, 'voorraad');
    }
    /* 17. de klusketen. Vlak voor de pijplijn, en met opzet ervoor: werk dat al
       is uitgevoerd en nog niet gefactureerd is geld dat u zelf tegenhoudt,
       waar een offerte nog een klant moet overtuigen. */
    if (klu) {
      for (const v of KLUSSEN.klussenOpvolging(klu)) zet('klus:' + v.id, v.kop, v.waarom, 'klussen');
    }
    /* 18. de toegang. Achter het werk en voor de verkoop: dit gaat niet over
       vandaag maar over wie er bij uw bedrijf kan. Het hoort wel op het
       dagbeeld, want juist zulke dingen ziet niemand uit zichzelf. */
    if (tgn) {
      for (const v of TOEGANG.toegangOpvolging(tgn)) zet('toegang:' + v.id, v.kop, v.waarom, 'toegang');
    }
    /* 19. de pijplijn. Vlak voor de gewone opvolging, en met opzet ervoor: een
       uitgebrachte offerte is werk dat al is gedaan en dat staat te verdampen,
       waar de opvolging hieronder over aanvragen gaat waar nog niets in zit.
       De aanvragen zonder prijs noemt ./relaties.js al; ./pijplijn.js herhaalt
       die regel niet. */
    if (pij) {
      for (const v of PIJPLIJN.pijplijnOpvolging(pij)) zet('pijplijn:' + v.id, v.kop, v.waarom, 'pijplijn');
    }
    /* 20. de opvolging. Dit gaat VOOR de Mall-pagina en voor de losse
       aanvragen: het is het enige wat over geld gaat dat al binnen handbereik
       ligt. De losse aanvragen-actie hieronder valt weg zodra de opvolging hem
       al noemt -- twee keer hetzelfde vragen leest als een storing. */
    if (rel && rel.opvolging.length) {
      for (const v of rel.opvolging) zet('opvolging:' + v.id, v.kop, v.waarom, 'relaties');
    }
    /* 21. de Mall-pagina. Na de etalage-check, want online staan gaat voor een
       mooie pagina: een pagina die niemand ziet is geen pagina. */
    if (mall && mall.open.length) {
      const m = mall.open[0];
      zet('mallprofiel', 'Uw Mall-pagina is ' + mall.percentage + '% ingevuld',
        m.label + ': ' + m.wat, 'mall');
    }
    // 22. wat er ligt
    const alGenoemd = !!(rel && rel.opvolging.some(v => v.id === 'aanvragen'));
    if (o.supplierCode && !alGenoemd) {
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
