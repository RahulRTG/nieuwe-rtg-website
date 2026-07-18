/* Routes "vonk": RTG Vonk (dating op codenaam). Achter de leden-inlog en
   alleen voor leden met een pas (geen anonieme gast); de kern bewaakt zelf
   18+ en het geverifieerde paspoort. De meldingen (blokkeer + meld) landen
   bij de backoffice, met dezelfde opvolging als De Salon. */
module.exports = (kern) => {
  const { app, auth, officeAuth,
    vonkProfielZet, vonkSelectie, vonkLike, vonkBetaal, vonkBericht, vonkMijn, vonkBlokkeer, vonkMeldingen } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const gast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Vonk is voor leden met een pas.' }); return true; }
    return false;
  };

  app.post('/api/vonk/profiel', auth, (req, res) => { if (gast(req, res)) return; stuur(res, vonkProfielZet(req.session.key, req.body || {})); });
  app.post('/api/vonk/selectie', auth, (req, res) => { if (gast(req, res)) return; stuur(res, vonkSelectie(req.session.key)); });
  app.post('/api/vonk/like', auth, async (req, res) => { if (gast(req, res)) return; stuur(res, await vonkLike(req.session.key, req.body.codenaam, req.body.aan)); });
  app.post('/api/vonk/betaal', auth, async (req, res) => { if (gast(req, res)) return; stuur(res, await vonkBetaal(req.session.key, String(req.body.id || ''))); });
  app.post('/api/vonk/bericht', auth, (req, res) => { if (gast(req, res)) return; stuur(res, vonkBericht(req.session.key, String(req.body.id || ''), req.body.tekst)); });
  app.post('/api/vonk/mijn', auth, (req, res) => { if (gast(req, res)) return; stuur(res, vonkMijn(req.session.key)); });
  app.post('/api/vonk/blokkeer', auth, async (req, res) => { if (gast(req, res)) return; stuur(res, await vonkBlokkeer(req.session.key, req.body.codenaam, req.body.meld)); });
  // de backoffice ziet de meldingen (Salon-niveau opvolging)
  app.post('/api/office/vonk/meldingen', officeAuth, (req, res) => stuur(res, vonkMeldingen()));
};
