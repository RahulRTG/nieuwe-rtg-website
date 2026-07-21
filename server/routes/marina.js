/* Domein "marina": het jachthaven-systeem voor partners met de marina-cap.
   De havenmeester stuurt vanuit de leverancier-app; de steiger, service en
   de marina-concierge werken met dezelfde endpoints vanaf de PDA. */
module.exports = (kern) => {
  const { app, db, supplierAuth, marina } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };
  const r = (pad, fn) => app.post('/api/supplier/marina' + pad, supplierAuth, (req, res) => {
    const caps = (db.data.supplierTypes[req.supplier.type] || {}).caps || [];
    if (!caps.includes('marina')) { res.status(403).json({ error: 'Deze zaak is geen jachthaven.' }); return; }
    stuur(res, fn(req.supplier.code, req.body || {}));
  });

  r('', (code) => marina.overzicht(code));
  r('/passant', (code, b) => marina.passantMeld(code, b));
  r('/vertrek', (code, b) => marina.vertrek(code, b.id));
  r('/brandstof', (code, b) => marina.brandstofVraag(code, b));
  r('/brandstof/klaar', (code, b) => marina.brandstofKlaar(code, b.id));
  r('/service', (code, b) => marina.serviceVraag(code, b));
  r('/service/status', (code, b) => marina.serviceStatus(code, b.id, b.status));
  r('/concierge', (code, b) => marina.conciergeVraag(code, b));
  r('/concierge/status', (code, b) => marina.conciergeStatus(code, b.id, b.status, b.notitie));
};
