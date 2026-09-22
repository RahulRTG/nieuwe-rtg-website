/* Routes "vonk": RTG Vonk (dating op codenaam). Achter de leden-inlog en
   alleen voor leden met een pas (geen anonieme gast); de kern bewaakt zelf
   18+ en het geverifieerde paspoort. De meldingen (blokkeer + meld) landen
   bij de backoffice, met dezelfde opvolging als De Salon. */
module.exports = (kern) => {
  const { app, auth, officeAuth,
    vonkProfielZet, vonkSelectie, vonkLike, vonkBetaal, vonkBericht, vonkMijn, vonkBlokkeer, vonkMeldingen,
    vonkHalfweg, vonkKies } = kern;
  const { eis } = require('./connection-policy')({ product: 'vonk', identityAtCore: true });
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error, ...(r.code ? { code: r.code } : {}) }) : res.json(r);
  const lid = (capability, werk) => (req, res) => {
    if (!eis(req, res, capability)) return;
    return werk(req, res);
  };

  app.post('/api/vonk/profiel', auth, lid('connection.profile.manage', (req, res) => stuur(res, vonkProfielZet(req.session.key, req.body || {}))));
  app.post('/api/vonk/selectie', auth, lid('connection.discover', (req, res) => stuur(res, vonkSelectie(req.session.key))));
  app.post('/api/vonk/like', auth, lid('connection.match.choose', async (req, res) => stuur(res, await vonkLike(req.session.key, req.body.codenaam, req.body.aan))));
  app.post('/api/vonk/betaal', auth, lid('connection.payment.confirm', async (req, res) => stuur(res, await vonkBetaal(req.session.key, String(req.body.id || '')))));
  app.post('/api/vonk/bericht', auth, lid('connection.message', (req, res) => stuur(res, vonkBericht(req.session.key, String(req.body.id || ''), req.body.tekst))));
  app.post('/api/vonk/mijn', auth, lid('connection.match.read', (req, res) => stuur(res, vonkMijn(req.session.key))));
  app.post('/api/vonk/halfweg', auth, lid('connection.meet.plan', (req, res) => stuur(res, vonkHalfweg(req.session.key, String(req.body.id || '')))));
  app.post('/api/vonk/kies', auth, lid('connection.meet.choose', (req, res) => stuur(res, vonkKies(req.session.key, String(req.body.id || ''), req.body.optie))));
  app.post('/api/vonk/blokkeer', auth, lid('connection.safety.block', async (req, res) => stuur(res, await vonkBlokkeer(req.session.key, req.body.codenaam, req.body.meld))));
  // de backoffice ziet de meldingen (Salon-niveau opvolging)
  app.post('/api/office/vonk/meldingen', officeAuth, (req, res) => {
    if (!eis(req, res, 'connection.safety.report.read', 'office')) return;
    stuur(res, vonkMeldingen());
  });
};
