/* Routes "vonk": RTG Vonk (dating op codenaam). Achter de leden-inlog en
   alleen voor leden met een pas (geen anonieme gast); de kern bewaakt zelf
   18+ en het geverifieerde paspoort. De meldingen (blokkeer + meld) landen
   bij de backoffice, met dezelfde opvolging als De Salon. */
module.exports = (kern) => {
  const { app, auth, officeAuth,
    vonkProfielZet, vonkSelectie, vonkLike, vonkBetaal, vonkBericht, vonkMijn, vonkBlokkeer, vonkMeldingen,
    vonkHalfweg, vonkKies, vonkEdge, vonkStateGuard } = kern;
  const State = require('../kern/connection-state-vonk');
  const { eis } = require('./connection-policy')({ product: 'vonk', identityAtCore: true });
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error, ...(r.code ? { code: r.code } : {}) }) : res.json(r);
  const lid = (capability, werk) => (req, res) => {
    if (!eis(req, res, capability)) return;
    return werk(req, res);
  };
  const overgang = (capability, event, context, werk) => lid(capability, (req, res) => {
    const b = req.body || {};
    const g = vonkStateGuard(req.session.key, { ...context(b), stateRevision: b.stateRevision }, capability, event);
    if (!g.ok) return stuur(res, g);
    return werk(req, res);
  });

  app.post('/api/vonk/profiel', auth, lid('connection.profile.manage', (req, res) => stuur(res, vonkProfielZet(req.session.key, req.body || {}))));
  app.post('/api/vonk/selectie', auth, lid('connection.discover', (req, res) => stuur(res, vonkSelectie(req.session.key))));
  app.post('/api/vonk/edge', auth, lid('connection.match.read', (req, res) => stuur(res, vonkEdge(req.session.key, req.body || {}))));
  app.post('/api/vonk/like', auth, overgang('connection.match.choose', State.EVENTS.CHOOSE_CANDIDATE,
    () => ({ context: 'discovery' }), async (req, res) => stuur(res, await vonkLike(req.session.key, req.body.codenaam, req.body.aan))));
  app.post('/api/vonk/betaal', auth, overgang('connection.payment.confirm', State.EVENTS.CONFIRM_PAYMENT,
    b => ({ id: String(b.id || '') }), async (req, res) => stuur(res, await vonkBetaal(req.session.key, String(req.body.id || '')))));
  app.post('/api/vonk/bericht', auth, overgang('connection.message', State.EVENTS.SEND_MESSAGE,
    b => ({ id: String(b.id || '') }), (req, res) => stuur(res, vonkBericht(req.session.key, String(req.body.id || ''), req.body.tekst))));
  app.post('/api/vonk/mijn', auth, lid('connection.match.read', (req, res) => stuur(res, vonkMijn(req.session.key))));
  app.post('/api/vonk/halfweg', auth, overgang('connection.meet.plan', State.EVENTS.PLAN_MEET,
    b => ({ id: String(b.id || '') }), (req, res) => stuur(res, vonkHalfweg(req.session.key, String(req.body.id || '')))));
  app.post('/api/vonk/kies', auth, overgang('connection.meet.choose', State.EVENTS.CHOOSE_PLACE,
    b => ({ id: String(b.id || '') }), (req, res) => stuur(res, vonkKies(req.session.key, String(req.body.id || ''), req.body.optie))));
  app.post('/api/vonk/blokkeer', auth, lid('connection.safety.block', async (req, res) => stuur(res, await vonkBlokkeer(req.session.key, req.body.codenaam, req.body.meld))));
  // de backoffice ziet de meldingen (Salon-niveau opvolging)
  app.post('/api/office/vonk/meldingen', officeAuth, (req, res) => {
    if (!eis(req, res, 'connection.safety.report.read', 'office')) return;
    stuur(res, vonkMeldingen());
  });
};
