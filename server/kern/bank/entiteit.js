/* RTG Rekening, deel "entiteit": een zakelijke rekening op naam van een entiteit
   uit de concerngraaf (besluit van de eigenaar, 24 september 2026).

   GEEN TWEEDE SOORT REKENING. Een zaak bankiert al onder de vlag 'zaak:<code>'
   (het financiele hart); een entiteit bankiert onder 'entiteit:<id>'. Zelfde
   grootboek, zelfde bankregie (partner, hybride, eigen), zelfde vergunningsgrendel
   en dezelfde eigendomscontrole (./eigendom.js): de houder IS de vlag, en een lid
   wiens codenaam niet 'entiteit:<id>' is, komt er via de gewone bankroutes niet bij.

   DRIE GRENDELS:

   1. RTG ZET HET PRODUCT OPEN. Standaard DICHT: een rekening voor een
      rechtspersoon is een nieuw soort klant, met eigen KYC en een eigen
      vergunningsvraag, en die gaat bewust open en niet vanzelf.
   2. EEN PER ENTITEIT. Wie meer wil, heeft een tweede entiteit.
   3. ER GAAT ALLEEN GELD AF LANGS HET WERK OS. Er is hier geen route waarmee
      iemand van deze rekening betaalt; `betaal` wordt aangeroepen door een
      uitgave die rond is (../../bedrijf/entiteitbetaling.js), met de uitgave als
      idempotentiesleutel -- een tweede druk betaalt niet twee keer.

   Wie de entiteit mag vertegenwoordigen (eigenaar, bestuur, KYC-minimum) beslist
   de concernkant; de bank kent geen concern en importeert het ook niet. */
'use strict';

const VLAG = 'entiteit:';

module.exports = (ctx) => {
  const { db, save, rekeningen, rekMeta, saldoVan } = ctx;
  const eigen = require('../eigencollectie')({ db, domein: 'kern/bank/entiteit', bezit: { entiteitRekeningStand: 'kaart' } });
  const vlag = (id) => VLAG + String(id || '');

  function stand() {
    const k = eigen.kijk('entiteitRekeningStand') || {};
    return { open: k.open === true, door: k.door || null, at: k.at || null,
      uitleg: k.open === true ? 'Een entiteit uit de concerngraaf kan een zakelijke RTG-rekening openen.'
        : 'Dicht (standaard). Een rekening op naam van een entiteit kan nog niet worden geopend.' };
  }
  function zet({ open, wie }) {
    if (typeof open !== 'boolean') return { status: 400, error: 'Zet rekeningen voor entiteiten open (true) of dicht (false).' };
    const k = eigen.bak('entiteitRekeningStand');
    k.open = open; k.door = wie || null; k.at = new Date().toISOString();
    save();
    return Object.assign({ ok: true }, stand());
  }

  const vind = (id) => Object.values(rekeningen()).find(m => m.codenaam === vlag(id)) || null;
  const beeld = (m) => m && { iban: m.iban, naam: m.naam, saldoCenten: saldoVan(m.iban), bevroren: !!m.bevroren, geopend: m.geopend };

  async function open({ entiteitId, naam, idem }) {
    if (!entiteitId) return { status: 400, error: 'Voor welke entiteit?' };
    if (!stand().open) return { status: 409, error: 'RTG heeft rekeningen voor entiteiten nog niet opengezet.', uitleg: stand().uitleg };
    const al = vind(entiteitId);
    if (al) return { status: 409, error: 'Deze entiteit heeft al een rekening: ' + al.iban + '.', rekening: beeld(al) };
    return ctx.rekeningOpen({ codenaam: vlag(entiteitId), soort: 'zakelijk', naam: naam || 'Zakelijke rekening', wie: 'entiteit', idem });
  }

  /* Betalen vanaf de rekening van de entiteit. Naar een RTG-IBAN is het een
     interne overboeking, anders een SEPA-opdracht -- dezelfde twee wegen als een
     lid, met de vlag als houder zodat ./eigendom.js gewoon zijn werk doet. */
  async function betaal({ entiteitId, naarIban, begunstigde, centen, oms, sleutel }) {
    const m = vind(entiteitId);
    if (!m) return { status: 404, error: 'Deze entiteit heeft geen RTG-rekening.' };
    if (m.bevroren) return { status: 423, error: 'De rekening van de entiteit is bevroren.' };
    if (!sleutel) return { status: 400, error: 'Een betaling van een entiteit draagt altijd een sleutel.' };
    const idem = 'entiteit-' + String(sleutel);
    if (rekMeta(naarIban)) {
      return ctx.bankOverboek({ vanIban: m.iban, naarIban, centen, oms, codenaam: vlag(entiteitId), idem });
    }
    return ctx.bankSepaUit({ iban: m.iban, codenaam: vlag(entiteitId), centen, naarIban, begunstigde, oms, idem });
  }

  return { entiteitRekeningStand: stand, entiteitRekeningZet: zet, entiteitRekeningOpen: open,
    entiteitRekening: (id) => beeld(vind(id)), entiteitBetaal: betaal };
};
