/* Opzet: de persoonseis op de leveranciersdeur (./leverancierpoort.js).
   Afgesplitst omdat die poort tegen de omvanggrens aan zat; supplierAuth roept
   hem nog steeds aan in hetzelfde keelgat, en de inlog leent dezelfde functie
   via de kern. `kern` is de late-gebonden kerntas van de leverancierpoort. */
'use strict';

module.exports = function maakPersoonsPoort({ kern, DEMO }) {
  /* Mag deze mens werken in een zaak van dit genre? Late binding: de kernlaag
     bouwt persoonseis pas verderop, en deze functie draait pas bij een verzoek.
     Ontbreekt de laag toch (een toets die de kern niet opbouwt), dan is dat GEEN
     stilzwijgend "ja": een genre met een eis hoort dan dicht te zijn. */
  return function persoonsPoort(supplier, actor) {
    if (!kern.persoonseis) {
      /* `../kern/` en niet `./kern/`: dit bestand woont in server/opzet/ en niet
         meer in de wortel van server/. Dat pad ging bij het verhuizen mee en was
         daarmee stuk -- op het NOODPAD, dus alleen wanneer de persoonseislaag er
         niet is, en dat is precies het pad dat een gereguleerd genre dicht hoort
         te houden. Het viel niet om in een enkele bestaande toets; het kwam
         boven toen deze poort er eindelijk een eigen kreeg. */
      const eis = require('../kern/persoonseis').EISEN[String(supplier && supplier.type || '')];
      if (!eis || !eis.werk) return { ok: true };
      return { ok: false, error: 'De persoonscontrole is niet beschikbaar; dit genre gaat dan niet open.' };
    }
    /* DE ENE UITZONDERING, EN ZIJ STAAT HIER MET NAAM. De demo-bedrijfsinlog
       (gebruikersnaam + wachtwoord, geen personeelsrij) is geen mens: hij draagt
       geen staffId en geen lidnummer, en er valt dus niets van te eisen.

       Waarom dat GEEN gat is: die weg bestaat alleen in demostand. In productie
       antwoordt /api/supplier/login op precies deze tak met 403 ("Demo-inlog is
       uitgeschakeld. Log in op uw naam met uw persoonlijke pincode"), dus er is
       buiten de demo geen inlog die hier langskomt. De voorwaarde `DEMO` staat er
       toch bij en niet alleen die 403: een poort die op een andere poort vertrouwt
       is een poort die openvalt zodra iemand die andere verzet.

       Wat hier NIET onder valt: de eigenaar die met zijn eigen RTG-account zijn
       zaak binnengaat. Die draagt wel een lidnummer, en wordt dus gewoon getoetst
       -- een kinderopvang van je eigen zaak vraagt ook van de eigenaar een VOG. */
    if (DEMO && kern.persoonseis.isGedeeldeInlog(actor)) {
      return { ok: true, demo: true };
    }
    return kern.persoonseis.magWerkenHier(supplier && supplier.type,
      kern.persoonseis.persoonVanActor(actor));
  };
};
