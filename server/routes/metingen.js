/* Routes "metingen": de dagmetingen (kern/metingen.js). Slaap, beweging en
   water, door het lid zelf ingevuld en alleen voor het lid zelf. Ze staan op de
   sessiesleutel en gaan nergens heen: geen partner, geen zaak, geen coach. */
module.exports = (kern) => {
  const { app, auth, metingenVan, metingZet, metingWeg } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };

  app.post('/api/metingen', auth, (req, res) => stuur(res, metingenVan(req.session.key)));
  app.post('/api/metingen/zet', auth, (req, res) => stuur(res, metingZet(req.session.key, req.body || {})));
  app.post('/api/metingen/weg', auth, (req, res) => stuur(res, metingWeg(req.session.key, req.body || {})));
};
