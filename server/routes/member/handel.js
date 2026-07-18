/* Domein "member", deelmodule handel & wonen: veilig laten bezorgen door
   een modewinkel, boodschappen bij de groothandel, digitale contracten
   en het vastgoed van het lid. Alleen routes; de logica woont in de
   kern-modules. */
module.exports = (kern) => {
  const { DOOR_RELOCK_MS, app, auth, betaal, crypto,
    db, express, findSupplier, liveCodename, logActivity,
    notifySupplier, optieAan, save, schoon, sseToSupplier,
    unlockDoor, reserveerTafel, mijnReserveringen, annuleerReservering, annuleerItem,
    plaatsReview, reviewsVoor, verblijfBoek, mijnVerblijven, verblijfAnnuleer,
    gastDeur, toggleFavoriet, favorietenVan, agendaVoor, maakSplits,
    mijnSplitsen, betaalSplits, zetOpWachtlijst, mijnWachtlijst, rsvpAnnuleer,
    puntenVan, verzilverPunten, salonZichtbaar, ghMarkt, ghPlaatsBestelling,
    ghMijnBestellingen, ghAnnuleer, mbAanvraag, mbMijn, zorgVoor, zorgContact } = kern;

  // koopt het lid echt? dan opent de chatlijn met de zaak (idempotent)
  const openLijn = (s, req) => {
    if (!s || req.session.tier === 'guest') return;
    try { zorgContact(s, req.session.key, liveCodename(req.session), req.session.tier); } catch (e) {}
  };

  /* De drie domeindelen draaien als submodules op de gedeelde kern plus
     openLijn, een keer gemount bij het opstarten. */
  const hctx = { kern, openLijn };
  require('./handel/winkel')(hctx);
  require('./handel/vastgoed')(hctx);
  require('./handel/uitjes')(hctx);
};
