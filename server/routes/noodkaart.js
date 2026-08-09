/* Routes "noodkaart": het kleinste beetje dat een vreemde over u moet weten als
   u het zelf niet kunt vertellen (kern/noodkaart.js).

   Er staan hier DRIE routes en ze zijn alle drie van het lid zelf. Er is met
   opzet geen vierde die een zaak, een kantoor of een hulpverlener de kaart van
   iemand anders laat ophalen: u toont hem zelf. */
module.exports = (kern) => {
  const { app, auth, noodkaartVan, noodkaartZet, noodkaartWeg } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };

  app.post('/api/noodkaart', auth, (req, res) => stuur(res, noodkaartVan(req.session.key)));
  app.post('/api/noodkaart/zet', auth, (req, res) => stuur(res, noodkaartZet(req.session.key, req.body || {})));
  app.post('/api/noodkaart/weg', auth, (req, res) => stuur(res, noodkaartWeg(req.session.key)));
};
