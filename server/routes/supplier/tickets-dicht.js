/* Domein "supplier" (deelmodule): DE SLUITDAGEN van het activiteitenaanbod.
   Afgesplitst uit ./tickets.js op de 10 kB-grens; de regel zelf (wat "dicht"
   betekent, en waarom bestaande boekingen blijven staan) woont in
   kern/activiteitendicht.js en wordt hier alleen aangeroepen. */
module.exports = (kern, { heeftTickets }) => {
  const { app, db, logActivity, managerOnly, save, sseToSupplier, supplierAuth } = kern;

/* SLUITDAGEN (kern/activiteitendicht.js): een dag dichtzetten voor een
   activiteit of voor de hele zaak. Sluiten raakt bestaande boekingen NIET --
   het antwoord telt ze en zegt dat de zaak daar zelf iets mee moet; stil
   annuleren zou geld van gasten afpakken zonder dat iemand erop drukte. */
app.post('/api/supplier/activiteit/sluit', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!heeftTickets(s)) return res.status(409).json({ error: 'Deze sector verkoopt geen tickets.' });
  const datum = String(req.body.datum || '');
  const opDag = db.data.boekingen.filter(b => b.kind === 'ticket' && b.supplierCode === s.code &&
    b.datum === datum && b.paid && !['geannuleerd', 'geweigerd', 'terugbetaald'].includes(b.status) &&
    (!req.body.activiteitId || b.activiteitId === String(req.body.activiteitId)));
  const r = require('../../kern/activiteitendicht').sluit(s, req.body, opDag);
  if (r.error) return res.status(r.status).json({ error: r.error });
  save();
  logActivity(s.code, req.actor, 'sloot ' + datum + ' voor boekingen');
  sseToSupplier(s.code, 'sync', { scope: 'tickets' });
  res.json(r);
});
app.post('/api/supplier/activiteit/open', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const r = require('../../kern/activiteitendicht').open(req.supplier, req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  save();
  logActivity(req.supplier.code, req.actor, 'heropende ' + String(req.body.datum || '') + ' voor boekingen');
  sseToSupplier(req.supplier.code, 'sync', { scope: 'tickets' });
  res.json(r);
});
};
