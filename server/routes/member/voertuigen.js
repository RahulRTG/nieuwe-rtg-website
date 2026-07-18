/* Domein "member", deelmodule voertuigen & ontmoeten: autoverhuur en charters (eerlijk
   huren met fotostaat en SOS), de Salon-ontmoetingen en de autoshowroom.
   Alleen routes; de logica woont in de kern-modules. */
module.exports = (kern) => {
  const { app, auth, crypto, db, eisAccount,
    express, findSupplier, geborenVan, leeftijdVan, liveCodename,
    notifySupplier, save, schoon, sseToOffice, sseToSupplier,
    salonZichtbaar, ontmoetZet, ontmoetPos, ontmoetKies, ontmoetTeken,
    ontmoetHier, ontmoetStop, ontmoetSos, ontmoetSignaalKantoor, ontmoetMijnState,
    avShowroom, avAanbevolen, avProefrit, avKoop, avInruil,
    avTeken, avMijnDeals, zorgVoor, zorgContact, media,
    boekingMetRef, boekingenVanZaak, boekingenVoegToe } = kern;

  // koopt of huurt het lid echt? dan opent de chatlijn met de zaak: geen
  // vreemden meer (idempotent en stil voor gasten)
  const openLijn = (s, req) => {
    if (!s || req.session.tier === 'guest') return;
    try { zorgContact(s, req.session.key, liveCodename(req.session), req.session.tier); } catch (e) {}
  };

  /* De vier domeindelen draaien als submodules op een gedeelde context,
     een keer opgebouwd bij het opstarten. */
  const vctx = { app, auth, crypto, db, eisAccount,
    express, findSupplier, geborenVan, leeftijdVan, liveCodename,
    notifySupplier, save, schoon, sseToOffice, sseToSupplier,
    salonZichtbaar, ontmoetZet, ontmoetPos, ontmoetKies, ontmoetTeken,
    ontmoetHier, ontmoetStop, ontmoetSos, ontmoetSignaalKantoor, ontmoetMijnState,
    avShowroom, avAanbevolen, avProefrit, avKoop, avInruil,
    avTeken, avMijnDeals, zorgVoor, zorgContact, media,
    boekingMetRef, boekingenVanZaak, boekingenVoegToe, openLijn };
  require('./voertuigen/huur')(vctx);
  require('./voertuigen/charter')(vctx);
  require('./voertuigen/ontmoeten')(vctx);
  require('./voertuigen/verkoop')(vctx);
};
