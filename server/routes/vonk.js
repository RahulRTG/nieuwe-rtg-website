/* Routes "vonk": RTG Vonk (dating op codenaam). Achter de leden-inlog en
   alleen voor leden met een pas (geen anonieme gast); de kern bewaakt zelf
   18+ en het geverifieerde paspoort. De meldingen (blokkeer + meld) landen
   bij de backoffice, met dezelfde opvolging als De Salon. */
module.exports = (kern) => {
  const { app, auth, officeAuth,
    vonkProfielZet, vonkSelectie, vonkLike, vonkBetaal, vonkBericht, vonkMijn, vonkBlokkeer, vonkMeldingen,
    vonkHalfweg, vonkKies, vonkEdge, vonkStateGuard,
    vonkFotoUpload, vonkFotoPubliceer, vonkFotoVerwijder, vonkFotoOrden, vonkFotoLever,
    vonkCommStatus, vonkCommConsent, vonkCommText, vonkCommRemove, vonkCommReport, vonkCommMedia, vonkCommCallStart, vonkCommCallAnswer,
    vonkCommCallSignal, vonkCommCallPoll, vonkCommCallEnd, vonkCommMediaLever, express } = kern;
  const { stuurBuffer } = require('../media/bestand');
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
  app.post('/api/vonk/profile-photo', auth, express.raw({ type: () => true, limit: '8mb' }),
    lid('connection.profile.photo.manage', async (req, res) => {
      try {
        stuur(res, await vonkFotoUpload(req.session.key, req.body, req.get('Content-Type') || '', {
          visibility: req.get('X-RTG-Visibility'), alt: req.get('X-RTG-Alt'),
          idempotencyKey: req.get('Idempotency-Key')
        }));
      } catch (e) { res.status(500).json({ error: 'De foto kon niet veilig worden opgeslagen.' }); }
    }));
  app.post('/api/vonk/profile-photo/publish', auth, lid('connection.profile.photo.manage', (req, res) =>
    stuur(res, vonkFotoPubliceer(req.session.key, req.body && req.body.id,
      req.body && req.body.visibility, !(req.body && req.body.publish === false)))));
  app.post('/api/vonk/profile-photo/remove', auth, lid('connection.profile.photo.manage', (req, res) =>
    stuur(res, vonkFotoVerwijder(req.session.key, req.body && req.body.id))));
  app.post('/api/vonk/profile-photo/order', auth, lid('connection.profile.photo.manage', (req, res) =>
    stuur(res, vonkFotoOrden(req.session.key, req.body && req.body.ids))));
  app.get('/api/vonk/profile-photo/delivery/:ticket', async (req, res) => {
    try {
      const item = await vonkFotoLever(req.params.ticket);
      if (!item) return res.status(404).end();
      return stuurBuffer(req, res, item.bytes, item.mime, 'private, no-store');
    } catch (e) { if (!res.headersSent) res.status(404).end(); }
  });
  app.post('/api/connection/vonk/status', auth, lid('connection.message', (req, res) =>
    stuur(res, vonkCommStatus(req.session.key, req.body || {}))));
  app.post('/api/connection/vonk/consent', auth, lid('connection.communication.consent', (req, res) =>
    stuur(res, vonkCommConsent(req.session.key, req.body || {}, req.body && req.body.capability,
      !(req.body && req.body.active === false)))));
  app.post('/api/connection/vonk/text', auth, lid('connection.message', (req, res) =>
    stuur(res, vonkCommText(req.session.key, req.body || {}, req.body && req.body.text))));
  app.post('/api/connection/vonk/message/remove', auth, lid('connection.message', (req,res) =>
    stuur(res,vonkCommRemove(req.session.key,req.body||{},req.body&&req.body.messageId))));
  app.post('/api/connection/vonk/message/report', auth, lid('connection.safety.block', (req,res) =>
    stuur(res,vonkCommReport(req.session.key,req.body||{},req.body&&req.body.messageId,req.body&&req.body.reason))));
  app.post('/api/connection/vonk/message-media', auth, express.raw({ type: () => true, limit: '8mb' }),
    lid('connection.media', async (req, res) => {
      try { stuur(res, await vonkCommMedia(req.session.key, { id: req.get('X-RTG-Context') }, req.body,
        req.get('Content-Type') || '', req.get('X-RTG-Media-Kind'), req.get('Idempotency-Key'), req.get('X-RTG-Transcript'))); }
      catch (e) { res.status(500).json({ error: 'De media kon niet veilig worden verwerkt.' }); }
    }));
  app.get('/api/connection/vonk/message-media/delivery/:ticket', async (req, res) => {
    try { const item = await vonkCommMediaLever(req.params.ticket); return item
      ? stuurBuffer(req, res, item.bytes, item.mime, 'private, no-store') : res.status(404).end(); }
    catch (e) { if (!res.headersSent) res.status(404).end(); }
  });
  app.post('/api/connection/vonk/call/start', auth, (req, res) => {
    const cap = req.body && req.body.type === 'video' ? 'connection.video' : 'connection.voice';
    if (!eis(req, res, cap)) return;
    stuur(res, vonkCommCallStart(req.session.key, req.body || {}, req.body.type,
      req.get('Idempotency-Key') || req.body.idempotencyKey));
  });
  app.post('/api/connection/vonk/call/answer', auth, lid('connection.call.control', (req, res) =>
    stuur(res, vonkCommCallAnswer(req.session.key, req.body && req.body.callId, req.body && req.body.accept))));
  app.post('/api/connection/vonk/call/signal', auth, lid('connection.call.control', (req, res) =>
    stuur(res, vonkCommCallSignal(req.session.key, req.body && req.body.callId, req.body && req.body.kind,
      req.body && req.body.payload))));
  app.post('/api/connection/vonk/call/poll', auth, lid('connection.call.control', (req, res) =>
    stuur(res, vonkCommCallPoll(req.session.key, req.body && req.body.callId, req.body && req.body.after))));
  app.post('/api/connection/vonk/call/end', auth, lid('connection.call.control', (req, res) =>
    stuur(res, vonkCommCallEnd(req.session.key, req.body && req.body.callId, 'ENDED'))));
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
