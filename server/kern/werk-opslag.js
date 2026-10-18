/* ============================================================================
   HET OPSLAGCONTRACT VAN DE WERVING -- de ene schrijvende deur naar de vijf
   collecties van werk en sollicitatie.

   Vijf bestanden schreven rechtstreeks in dezelfde vijf collecties: de
   ledenkant (routes/member/werk.js, werk/rtf.js, werk/talent.js), de zaakkant
   (routes/supplier/werving/sollicitaties.js) en de werklaag zelf
   (kern/werk.js, de sollicitatiechat). Elk deed de "maak de lijst als hij er
   niet is"-regel op zijn eigen manier, en twee deden het VOOR de keuring van
   het verzoek -- een sollicitatie of interesse die met 400/403/404 werd
   geweigerd, liet een lege lijst achter. Hier bestaat een lijst pas als er
   werkelijk iets in komt.

   Dezelfde discipline als kern/connect/opslag.js en kern/mobiliteit/opslag.js
   (een register, lezen tegen schrijven) en met opzet geen gedeelde klasse:
   kern/eigencollectie.js past hier niet, want initdata zet deze collecties
   bij de start en kern/vergeten wist het cv. Een eigencollectie-declaratie
   zou die twee als indringers laten zakken in keuringsregel 63, terwijl ze
   het recht hebben dat ze hebben.

   LEZEN MAAKT NIETS AAN. Elke lezer hieronder geeft een lege waarde terug als
   er niets is, en schrijft die niet terug. `zet...` is de enige weg erin.

   WAT DIT BESTAND MET OPZET NIET DOET: geen kap (de 100 sollicitaties, 40
   vacatures en 5000 interesses blijven bij de route die ze kent), geen
   rechten, geen privacyfilter (werkgeverSollicitatie in kern/werk.js). En de
   LEZERS buiten de werving (kantoor, lid, zaak, vergeten, foundation, comm,
   berichten) staan hier nog niet achter: dat is een volgende ronde, met een
   eigen toets per lezer.
   ========================================================================== */
'use strict';
const { eigenVeld } = require('./util');

const REGISTER = {
  applications:     { soort: 'kaart', wat: 'per zaakcode: de sollicitaties, nieuwste eerst' },
  vacatures:        { soort: 'kaart', wat: 'per zaakcode: de vacatures (ook zichtbaar in de RTFoundation)' },
  applyChats:       { soort: 'kaart', wat: 'per sollicitatie-id: de chat met de werkgever (berichten in kern/comm/werk.js)' },
  cvs:              { soort: 'kaart', wat: 'per lid (sleutel): het cv uit de cv-builder' },
  talentInteresses: { soort: 'lijst', wat: 'anonieme werkmatches uit de RTF-app' }
};

const isKaart = (w) => !!w && typeof w === 'object';

module.exports = function maakWerkOpslag({ db }) {
  if (!db) throw new Error('kern/werk-opslag: zonder db is er niets om te bewaren');

  const kaart = (naam) => (isKaart(db.data[naam]) ? db.data[naam] : null);
  const pakKaart = (naam) => { if (!kaart(naam)) db.data[naam] = {}; return db.data[naam]; };
  /* Een eigen veld van een kaart, nooit een prototype-sleutel. */
  const veld = (naam, sleutel) => eigenVeld(kaart(naam), sleutel);

  return {
    REGISTER,
    // sollicitaties per zaak
    sollicitatiesVan: (code) => veld('applications', code) || [],
    alleSollicitaties: () => kaart('applications') || {},
    zetSollicitaties: (code, lijst) => (pakKaart('applications')[code] = lijst),
    // vacatures per zaak
    vacaturesVan: (code) => veld('vacatures', code) || [],
    alleVacatures: () => kaart('vacatures') || {},
    zetVacatures: (code, lijst) => (pakKaart('vacatures')[code] = lijst),
    // de sollicitatiechat
    chat: (id) => veld('applyChats', id),
    zetChat: (id, chat) => (pakKaart('applyChats')[id] = chat),
    // het cv van een lid
    cv: (key) => veld('cvs', key),
    zetCv: (key, cv) => (pakKaart('cvs')[key] = cv),
    // de anonieme werkmatches
    talent: () => (Array.isArray(db.data.talentInteresses) ? db.data.talentInteresses : []),
    zetTalent: (lijst) => (db.data.talentInteresses = lijst)
  };
};

module.exports.REGISTER = REGISTER;
