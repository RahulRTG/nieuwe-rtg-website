/* Supplier-submodule "reserveringen": Reserveringen: bevestigen/weigeren, de tafelplanning, een tafel toewijzen,
   komst melden en de walk-in.
   Verbatim afgesplitst uit routes/supplier.js; alleen de routes, de helpers
   komen via het kern-object binnen. */
module.exports = (kern) => {
  const { app, beslisReservering, logActivity, supplierAuth, tafelplanning, reserveringTafel,
          reserveringKomst, walkIn } = kern;



app.post('/api/supplier/reservering/beslis', supplierAuth, (req, res) => {
  const action = req.body.action === 'bevestig' ? 'bevestig' : 'weiger';
  const r = beslisReservering(req.supplier, String(req.body.id || ''), action);
  if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, (action === 'bevestig' ? 'bevestigde' : 'weigerde') + ' de reservering van ' + r.reservering.customerCodename + ' (' + r.reservering.datum + ' ' + r.reservering.tijd + ')');
  res.json(r);
});

/* De tafelplanning: de hele dag in een oogopslag (aanvragen, bevestigd,
   toegewezen tafels, walk-ins), plus de vloerhandelingen: tafel toewijzen,
   komst melden en een walk-in plaatsen. Voor iedereen die op de vloer staat. */
app.post('/api/supplier/tafelplan', supplierAuth, (req, res) => {
  res.json(tafelplanning(req.supplier, req.body.datum));
});
app.post('/api/supplier/reservering/tafel', supplierAuth, (req, res) => {
  const r = reserveringTafel(req.supplier, String(req.body.id || ''), req.body.tafel);
  if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, 'wees tafel ' + r.reservering.tafel + ' toe aan ' + r.reservering.customerCodename + ' (' + r.reservering.datum + ' ' + r.reservering.tijd + ')');
  res.json(r);
});
app.post('/api/supplier/reservering/komst', supplierAuth, (req, res) => {
  const r = reserveringKomst(req.supplier, String(req.body.id || ''), String(req.body.actie || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, 'meldde de reservering van ' + r.reservering.customerCodename + ' als ' + r.reservering.status);
  res.json(r);
});
app.post('/api/supplier/walkin', supplierAuth, (req, res) => {
  const r = walkIn(req.supplier, req.body.tafel, req.body.personen, req.actor.name);
  if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, 'plaatste een walk-in (' + r.reservering.personen + 'p) aan tafel ' + r.reservering.tafel);
  res.json(r);
});

};
