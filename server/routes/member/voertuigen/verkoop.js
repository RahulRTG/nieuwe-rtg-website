/* Member-voertuigen (deelmodule): de autoshowroom: proefrit, koop, inruil en tekenen.
   Krijgt de gedeelde context een keer bij het opstarten vanuit
   routes/member/voertuigen.js. */
module.exports = (vctx) => {
  const { app, auth, crypto, db, eisAccount,
    express, findSupplier, geborenVan, leeftijdVan, liveCodename,
    notifySupplier, save, schoon, sseToOffice, sseToSupplier,
    salonZichtbaar, ontmoetZet, ontmoetPos, ontmoetKies, ontmoetTeken,
    ontmoetHier, ontmoetStop, ontmoetSos, ontmoetSignaalKantoor, ontmoetMijnState,
    avShowroom, avAanbevolen, avProefrit, avKoop, avInruil,
    avTeken, avMijnDeals, zorgVoor, zorgContact, media,
    boekingMetRef, boekingenVanZaak, boekingenVoegToe, openLijn } = vctx;
/* ================== autoverkoop: de exclusieve showroom ==================
   Leden bekijken de showroom, vragen een proefrit aan, doen een bod (optioneel
   met inruil en concierge-aflevering) en tekenen het digitale koopcontract. */
app.post('/api/verkoop/showroom', auth, (req, res) => {
  res.json({ autos: avShowroom({ zoek: req.body.zoek, brandstof: req.body.brandstof, maxPrijs: req.body.maxPrijs }),
    aanbevolen: avAanbevolen(req.session.key) });
});
app.post('/api/verkoop/proefrit', auth, (req, res) => {
  const r = avProefrit(req.session.key, liveCodename(req.session), String(req.body.supplierCode || ''), String(req.body.autoId || ''), req.body.wens);
  if (r.error) return res.status(r.status).json({ error: r.error });
  openLijn(findSupplier(req.body.supplierCode), req);
  res.json({ ok: true, deal: r.deal });
});
app.post('/api/verkoop/koop', auth, (req, res) => {
  const r = avKoop(req.session.key, liveCodename(req.session), String(req.body.supplierCode || ''), String(req.body.autoId || ''),
    { bod: req.body.bod, inruil: req.body.inruil, concierge: req.body.concierge === true, adres: req.body.adres });
  if (r.error) return res.status(r.status).json({ error: r.error });
  openLijn(findSupplier(req.body.supplierCode), req);
  res.json({ ok: true, deal: r.deal });
});
app.post('/api/verkoop/inruil', auth, (req, res) => {
  const r = avInruil(req.session.key, liveCodename(req.session), String(req.body.supplierCode || ''), String(req.body.autoId || ''), req.body.inruil);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, deal: r.deal });
});
app.post('/api/verkoop/teken', auth, (req, res) => {
  const r = avTeken(req.session.key, String(req.body.ref || ''), req.body.naam);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.status2 });
});
app.post('/api/verkoop/mijn', auth, (req, res) => {
  res.json({ deals: avMijnDeals(req.session.key) });
});
};
