/* Magnaat, samen in een Oudwijk: DE STAD ONDER EEN SLOT (./stad.js).

   Met meer dan een serverproces kunnen twee spelers op hetzelfde moment als
   laatste hun dag afsluiten. Zonder slot werkt elk proces op zijn eigen kopie
   van de stad: allebei zien ze de ander nog als bezig, en niemand zet de stad
   verder -- of allebei doen het, en dan gaat de stad twee dagen tegelijk.
   Daarom loopt elke zet in een stad door EEN collectietransactie op
   `magnaatSteden` (db/collectie-bewerken.js, in PostgreSQL met een echt
   databaseslot), net als de Teamkamers: precies een proces beslist dat de
   laatste klaar is.

   Twee regels:
     - HET WERK BLIJFT SYNCHROON. De opslag wacht op het slot voordat hij het
       werk draait, en commit erna; binnen het werk wordt nergens gewacht.
     - EEN SEINTJE GAAT PAS NA DE COMMIT. Een speler die een seintje krijgt en
       meteen ververst, moet de nieuwe stand vinden. Mislukt de commit, dan gaat
       er niets uit.

   EN HET LEVEN BEWAART NIET BINNEN HET SLOT. De transactie schrijft alleen
   `magnaatSteden`; een gewone save() erbinnen opent in SQLite een tweede
   transactie in de eerste en breekt af. Daarom onthoudt `opslag` tijdens het
   slot alleen DAT er bewaard moet worden, en bewaart hij een keer erna.

   Wat het slot NIET dekt: de levens zelf (`magnaatLeven`) hebben, zoals in
   heel Van Nul sinds V5, geen eigen collectietransactie. Het slot maakt het
   BESLUIT dat de dag verder gaat eenduidig, niet elke schrijfbeweging erna. */
'use strict';

module.exports = ({ eigen, bewerkCollectie = null, sseToCustomer = null, opslag = null }) => {
  let actief = null, huidig = null;
  const steden = () => actief || eigen.bak('magnaatSteden');

  /* Onthoud wie een seintje moet krijgen, met de stand van NU; versturen doet onderSlot na de commit. */
  const sein = (s) => {
    if (huidig) huidig.set(s.code, { keys: s.leden.map(l => l.key), data: { scope: 'magnaat-stad', code: s.code, dag: s.dag, revisie: s.revisie } });
  };
  function verstuur(lijst) {
    if (typeof sseToCustomer !== 'function') return;
    for (const { keys, data } of lijst.values()) for (const k of keys) { try { sseToCustomer(k, 'sync', data); } catch (e) {} }
  }

  function onderSlot(werk) {
    const lijst = new Map();
    const doe = (bron) => {
      actief = bron || null; huidig = lijst;
      if (opslag) opslag.inSlot = true;
      try { return werk(); } finally { actief = null; huidig = null; if (opslag) opslag.inSlot = false; }
    };
    const uit = typeof bewerkCollectie === 'function' ? bewerkCollectie('magnaatSteden', doe) : doe(null);
    const klaar = (r) => { if (opslag) opslag.naSlot(); verstuur(lijst); return r; };
    return uit && typeof uit.then === 'function' ? uit.then(klaar) : klaar(uit);
  }

  return { steden, sein, onderSlot };
};
