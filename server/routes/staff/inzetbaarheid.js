/* De inzetbaarheid van een medewerker: apart bestand omdat dienst.js met de
   verzuimkoppeling naar Payroll OS over de 10 KB-lat kwam (keuringsregel 13).
   De naad ligt hier vanzelf: hierboven staat de dienst van vandaag (pauze,
   rooster, verlof, ziekmelden), hier wat iemand structureel aankan. */
module.exports = (actx) => {
  const { app, supplierAuth, db, save, schoon, findStaffPartner } = actx;
app.post('/api/staff/inzetbaarheid', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  if (!payrollOS || !payrollOS.verzuim)
    return res.status(503).json({ error: 'De verzuimlaag draait niet in dit proces.' });
  const b = req.body || {};
  const stand = String(b.inzetbaarheid || '');
  if (!payrollOS.verzuim.INZETBAARHEID.includes(stand))
    return res.status(400).json({ error: 'Kies wat je nog kunt: ' + payrollOS.verzuim.INZETBAARHEID.join(', ') + '.' });
  if (schoon(b.toelichting, 200))
    return res.status(422).json({ error: 'Ook hier geen omschrijving. Wat je hebt hoort bij de arbodienst; hier staat alleen wat je nog kunt.' });
  const r = payrollOS.verzuim.zetInzetbaarheid(req.supplier.code, req.actor.staffId,
    String(b.van || '').slice(0, 10), stand, req.actor.name);
  if (r.error) return res.status(r.status || 400).json(r);
  sseToSupplier(req.supplier.code, 'sync', { scope: 'verlof' });
  res.json(r);
});
/* DE VERTROUWENSPERSOON staat in ./dienst-vertrouwen.js. Een eigen onderwerp
   met een eigen belofte -- wat daar wordt gezegd komt niet bij de werkgever --
   en dit bestand ging over de 10 KB. */
require('./dienst-vertrouwen')(actx);
};
