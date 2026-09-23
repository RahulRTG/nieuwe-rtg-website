/* WERK OS-UITGAVE VIA RTG BANK -- de schakelaar van RTG en het bewijs van een
   betaling. Besluit van de eigenaar (23 september 2026): een werkruimte kiest
   zelf of een goedgekeurde uitgave buiten RTG wordt betaald of via RTG Bank, en
   RTG zet die tweede weg als geheel aan of uit.

   WAT "VIA RTG BANK" HIER BETEKENT, EN WAT NIET. De meting vooraf vond dat een
   betaalopdracht (kern/betaalopdracht/) geen wachtstand heeft: hij boekt meteen
   en de rij dient hem vanzelf in. Een uitgave daar "klaarzetten" zou dus geld
   laten vertrekken zonder dat een mens drukt -- precies wat GELD.md verbiedt.
   En er is geen rekening per werkruimte, alleen per lid. Daarom:

     - de betaling zelf is een gewone SEPA-overboeking die een MENS doet, vanaf
       zijn eigen RTG-rekening, langs de bestaande route (/api/bank/sepa);
     - deze module doet alleen het BEWIJS: bestaat die opdracht, is hij niet
       mislukt, en van welke codenaam kwam hij. Het Werk OS vergelijkt dat met de
       uitgave (bedrag, IBAN, wie) voordat hij "betaald" wordt.

   DE SCHAKELAAR staat standaard UIT: een nieuwe geldweg gaat bewust open en niet
   vanzelf. Hij verplaatst niets en verleent niets; hij bepaalt alleen of een
   werkruimte deze tweede weg mag kiezen. Staat hij uit, dan valt een werkruimte
   die hem koos terug op "extern", met de reden erbij. */
'use strict';

const MISLUKT = ['MISLUKT', 'TERUGGEBOEKT'];

module.exports = ({ db, save, opdrachten, rekeningenVanLid }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/werkbetaling', bezit: { werkBankpad: 'kaart' } });

  function stand() {
    const k = eigen.kijk('werkBankpad') || {};
    return { aan: k.aan === true, door: k.door || null, at: k.at || null,
      uitleg: k.aan === true
        ? 'Een werkruimte mag kiezen dat een goedgekeurde uitgave via RTG Bank wordt betaald: een mens die niet de indiener is, maakt de SEPA-overboeking vanaf zijn eigen RTG-rekening, en het Werk OS controleert die voordat de uitgave betaald heet.'
        : 'Uit (standaard). Werkruimtes betalen een goedgekeurde uitgave buiten RTG en noteren dat met een kenmerk.' };
  }

  function zet({ aan, wie }) {
    if (typeof aan !== 'boolean') return { status: 400, error: 'Zet de weg via RTG Bank aan (true) of uit (false).' };
    const k = eigen.bak('werkBankpad');
    k.aan = aan; k.door = wie || null; k.at = new Date().toISOString();
    save();
    return Object.assign({ ok: true }, stand());
  }

  /* Het bewijs van een opdracht, zonder meer te geven dan het Werk OS nodig heeft:
     geen saldo en geen rekening van een ander. De vraag is niet "van wie is hij"
     maar "is hij van DEZE codenaam": de bank noemt de rekeningen van die ene mens,
     en de opdracht moet van een daarvan komen. Een gemachtigde op andermans
     rekening telt hier niet -- de betaler is wie de rekening bezit. */
  function bewijs(opdrachtId, codenaam) {
    const op = opdrachten && typeof opdrachten.vind === 'function' ? opdrachten.vind(opdrachtId) : null;
    if (!op || op.soort !== 'sepa-uit') return null;
    /* Zonder de bank kan deze vraag niet worden beantwoord, en dat is iets anders
       dan "niet van u": zeg het, in plaats van een weigering die een oorzaak verzint. */
    if (typeof rekeningenVanLid !== 'function') return { onbedraad: true };
    const zijne = codenaam ? (rekeningenVanLid(codenaam).rekeningen || []) : [];
    /* bron: het bedrag komt uit de betaalopdracht zelf, niet uit het verzoek. */
    return { id: op.id, centen: op.centen, bron: 'betaalopdracht:' + op.id, bestemming: op.bestemming || null,
      vanDeze: !!op.bron && zijne.some(x => x.iban === op.bron), mislukt: MISLUKT.includes(op.status), status: op.status };
  }

  return { werkBankpadStand: stand, werkBankpadZet: zet, werkBankBewijs: bewijs };
};
