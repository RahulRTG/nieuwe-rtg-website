/* De alleen-lezen montage van de bedrijfsmaten.

   De bronnen horen als een groep bij AUTONOMIE en vormen een zelfstandige
   grens in kernlaag4. De federatieve reisketen blijft buiten de gewone
   reisomzet: die kent een eigen afreken- en bewijscontract. */
'use strict';

module.exports = (kern, data) => {
  kern.bedrijfsmaat = require('../kern/bedrijfsmaat/stand')({
    lees: { ritten: () => data.rides, bestellingen: () => data.orders,
      betaalschemas: () => data.lidmaatschapBetalingen,
      reizen: () => (data.reisAanvragen || []).filter(a => !a.keten), loonruns: () => data.payrollRunsV2,
      casussen: () => (data.rtfos && data.rtfos.casussen) },
    pasgeschiedenis: kern.pasgeschiedenis, aanwezigheid: kern.aanwezigheid,
    kosten: () => kern.kosten, bank: kern.bankpositie, boek: kern.rtgBoek, kanalen: kern.aanmeldkanaalStand,
    ledentegoed: () => (kern.pay && kern.pay.ledentegoed ? kern.pay.ledentegoed() : null),
    later: { omzetPerPas: () => kern.ledenregister.omzetPerPas(),
      betalingen: () => (kern.betaalWaarheid ? kern.betaalWaarheid.openstaand() : null),
      zaken: () => data.suppliers || [], contracten: () => data.contracten || [], facturen: () => data.facturen || [],
      aanmeldingen: () => data.aanmeldingen || [], betaalschemas: () => data.lidmaatschapBetalingen || [] } });
};
