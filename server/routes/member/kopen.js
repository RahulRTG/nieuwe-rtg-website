/* Domein "member", deelmodule kopen: rechtstreeks betalen aan een
   leverancier (Face ID), de ophaal/bezorgdienst, tickets voor
   activiteiten en de transfers daarbij. Alleen routes; de logica
   woont in de kern-modules. */
module.exports = (kern) => {
  const { PERSONAS, app, auth, betaal, centen,
    crypto, db, findPartner, findSupplier, magBezorgen,
    liveCodename, notifySupplier, pickupCode, publicPartner, save,
    schoon, sseToOffice, sseToSupplier, salonZichtbaar, zorgVoor,
    koopTicketVoor, dpBetaalDirect, dpMijnBetalingen, dpVerzoekenVoor, dpBetaalVerzoek,
    orderMetRef, ordersVoegToe } = kern;

/* ============ rechtstreeks betalen aan een leverancier (Face ID) ============
   Elk betalend lid rekent alles met Face ID af, via de AI en de Salon, en het
   geld gaat rechtstreeks naar de leverancier. Alleen leden (geen gasten). */
app.post('/api/betaal/direct', auth, async (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Rechtstreeks betalen is voor leden.' });
  const cent = req.body.centen != null ? Math.round(Number(req.body.centen)) : Math.round(Number(req.body.bedrag) * 100);
  const r = await dpBetaalDirect({ key: req.session.key, codename: liveCodename(req.session),
    supplierCode: String(req.body.supplierCode || ''), bedragCenten: cent,
    omschrijving: req.body.omschrijving, bron: req.body.bron, idem: req.body.idem });
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/betaal/verzoeken', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.json({ verzoeken: [] });
  res.json({ verzoeken: dpVerzoekenVoor(liveCodename(req.session)) });
});
app.post('/api/betaal/verzoek/pay', auth, async (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Betalen is voor leden.' });
  const r = await dpBetaalVerzoek({ key: req.session.key, codename: liveCodename(req.session), ref: String(req.body.ref || ''), idem: req.body.idem });
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/betaal/mijn', auth, (req, res) => {
  res.json({ betalingen: dpMijnBetalingen(req.session.key) });
});


/* De bezorg- en ticketlaag draaien als submodules op de gedeelde kern. */
require('./kopen/bezorg')(kern);
require('./kopen/tickets')(kern);
};
