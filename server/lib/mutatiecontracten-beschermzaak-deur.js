/* ============================================================================
   MUTATIECONTRACTEN -- DE VIER ROUTES VAN DE VOORDEUR.

   Hoort bij ./mutatiecontracten-beschermzaak.js; de meetronde en de vorm staan
   daar. Afgesplitst op de 10 KB van keuringsregel 13, en niet omdat ze minder
   wegen: dit zijn de enige routes van deze klasse ZONDER poort.
   ========================================================================== */
'use strict';

const { AFGETEKEND, OP } = require('./mutatiecontracten-beschermzaak-op');

/* OPEN IS EEN BESLUIT, EN DE KEURING EIST DE REDEN. Vier routes van deze klasse
   staan zonder poort, en het is dezelfde reden voor alle vier: de mens om wie
   het gaat heeft geen kantoorinlog en heel vaak geen RTG-account. Een deur die
   eerst een account vraagt, is voor hem geen deur (HDI.md par. 7 regel 4).

   WAT OPEN ZIJN HIER NIET BETEKENT. De klasse weigert adres, telefoon, naam,
   geboortedatum en BSN (kern/beschermzaak/klasse.js), dus langs deze weg kan er
   niets herleidbaars binnenkomen. De twee leesroutes geven per constructie het
   minimum: namen van plaatsen, en een stand zonder inhoud. En alle vier dragen
   een rem, per bron en per code (routes/rtfos/voordeur.js). */
const OPEN = {
  klasse: 'PUBLIC',
  waarom: 'De voordeur van HDI.md par. 7 regel 4. Wie hier binnenkomt heeft per definitie geen ' +
    'kantoorinlog en meestal geen RTG-account; een poort ervoor zou de deur sluiten voor precies ' +
    'de mens waarvoor hij bestaat. De klasse weigert elk herleidbaar veld, de twee leesroutes geven ' +
    'het minimum, en alle vier dragen een rem per bron en per code.'
};


/* De start-route doet bij herhaling een tweede handeling; dezelfde vorm als de
   helper in ./mutatiecontracten-beschermzaak.js, hier uitgeschreven omdat die
   twee bestanden elkaar niet horen te laden (kringverwijzing). */
const CONTRACTEN = Object.fromEntries([
  ['POST /api/bescherming/deur/start', {
    mutatieId: 'bescherming.deur.start', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: OPEN,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Zelfde reden als bij de kantoorroute /bescherming/open, en hier zwaarder: twee ' +
      'meldingen zijn twee zorgen. Aan deze kant komt er nog iets bij -- wie in paniek twee keer op ' +
      'verzenden drukt, mag nooit een WEIGERING krijgen. Een dubbele zaak is hinderlijk en te ' +
      'sluiten; een geweigerde melding kan de laatste poging zijn geweest.',
    bewijs: {
      gemeten: 'dubbeltik-ronde: twee keer hetzelfde lijf gaf TWEE zaken met verschillende codes (aantal +2)',
      op: OP
    },
    afgetekend: AFGETEKEND
  }],

  ['POST /api/bescherming/deur/intrekken', {
    mutatieId: 'bescherming.deur.intrekken', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: OPEN,
    stand: 'PROTECTED',
    bewijs: {
      gemeten: 'dubbeltik-ronde: de tweede oproep gaf 200 met "Dit was al ingetrokken" en liet geen ' +
        'tweede effect na. Dit is GEEN toestandscontrole zoals bij de kantoorroutes (par. 5o): de ' +
        'route weigert niet maar antwoordt hetzelfde, door een eigen vroege afhandeling. Dat is met ' +
        'opzet -- iemand die twijfelt en nog een keer op intrekken drukt, hoort geen foutmelding te ' +
        'krijgen op het moment dat hij het al zwaar heeft',
      op: OP
    },
    afgetekend: AFGETEKEND
  }],

  ['POST /api/bescherming/deur/steden', {
    mutatieId: 'bescherming.deur.steden', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: OPEN,
    stand: 'NOT_APPLICABLE',
    nagekeken: 'Claude (Opus 5), 2026-09-02: steden() in kern/beschermzaak/voordeur.js filtert ' +
      'S().steden en geeft id plus naam terug; geen save(), geen audit(), geen toewijzing.',
    bewijs: { gemeten: 'dubbeltik-ronde: twee oproepen gaven een identiek antwoord en nul nieuwe zaken', op: OP },
    afgetekend: AFGETEKEND
  }],

  ['POST /api/bescherming/deur/stand', {
    mutatieId: 'bescherming.deur.stand', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: OPEN,
    stand: 'NOT_APPLICABLE',
    nagekeken: 'Claude (Opus 5), 2026-09-02: stand() zoekt de zaak op de code en stelt een antwoord ' +
      'samen; geen save() en geen audit(). Met opzet OOK geen auditregel, anders zou het bekijken ' +
      'van je eigen melding een spoor in het dossier van de organisatie achterlaten.',
    bewijs: { gemeten: 'dubbeltik-ronde: twee oproepen gaven een identiek antwoord en nul nieuwe zaken', op: OP },
    afgetekend: AFGETEKEND
  }]
]);

module.exports = { CONTRACTEN, OPEN };
