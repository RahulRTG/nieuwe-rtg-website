/* Een melding accepteren is een opslagbelofte. Daarom raw-body HMAC voor JSON,
   een duurzame unieke ontvangst, en nooit log.uitzondering: dat zou teruglussen. */
'use strict';
const path = require('node:path');
const protocol = require('../storingen/protocol');
const { geheimVrij } = require('../log-redactie');
function inhoudVan(raw) {
  let b;
  try { b = JSON.parse(raw.toString('utf8')); } catch (_) { return null; }
  if (!b || typeof b !== 'object' || Array.isArray(b) ||
      typeof b.app !== 'string' || !protocol.ID.test(b.app) ||
      !['fout', 'zelfproef'].includes(b.soort) || typeof b.fout !== 'string' || !b.fout || b.fout.length > 4000 ||
      typeof b.tijd !== 'string' || !Number.isFinite(Date.parse(b.tijd))) return null;
  // Geen vrije context of stack opslaan: die kunnen klantgegevens en credentials
  // bevatten. Bericht met centrale redactie, context alleen een technische bron.
  const bron = b.context && typeof b.context.p === 'string' ? b.context.p.split('?')[0].slice(0, 200) : '';
  return { app: b.app, soort: b.soort, tijd: b.tijd, fout: geheimVrij(b.fout), bron: geheimVrij(bron) };
}
module.exports = function hangStoringenOp({ app, express, log, env = process.env, opslagVan }) {
  let opslag;
  const sleutel = env.ERR_WEBHOOK_SECRET || '';
  const noteer = (uitkomst, req, extra = {}) => {
    try { log.info('storingen-webhook', Object.assign({ uitkomst, requestId: req.id }, extra)); } catch (_) {}
  };
  const rem = require('../rem')({ windowMs: 60000, limit: 60,
    handler: (req, res) => { noteer('rem', req); res.set('Retry-After', '60').status(429).json({ ok: false, error: 'Te veel meldingen.' }); } });
  const raw = express.raw({ type: '*/*', limit: protocol.MAX_BYTES });
  function leesMelding(req, res, next) {
    res.set('Cache-Control', 'no-store');
    // Een anoniem verzoek krijgt altijd een auth-weigering, ook wanneer de
    // ontvanger nog niet is ingesteld. Het onthult geen configuratiestand.
    if (!req.get('x-rtg-signature') || !req.get('x-rtg-event-id') || !req.get('x-rtg-timestamp')) {
      noteer('auth-geweigerd', req); return res.status(401).json({ ok: false, error: 'Handtekening vereist.' });
    }
    if (!protocol.sleutelGoed(sleutel)) return res.status(503).json({ ok: false, error: 'Ontvangst niet geconfigureerd.' });
    if (!/^application\/json(?:\s*;|$)/i.test(req.get('content-type') || '') || req.get('content-encoding'))
      return res.status(415).json({ ok: false, error: 'Ongecomprimeerde JSON vereist.' });
    raw(req, res, err => {
      if (err) { noteer('body-geweigerd', req); return res.status(err.status === 413 ? 413 : 400).json({ ok: false, error: 'Ongeldige of te grote melding.' }); }
      next();
    });
  }
  function storingenAuth(req, res, next) {
    if (!protocol.verifieer(sleutel, req.headers, req.body)) {
      noteer('auth-geweigerd', req); return res.status(401).json({ ok: false, error: 'Ongeldige of verlopen handtekening.' });
    }
    next();
  }
  app.post('/api/webhooks/storingen', rem, leesMelding, storingenAuth, (req, res) => {
    const inhoud = inhoudVan(req.body), id = req.get('x-rtg-event-id');
    if (!inhoud) { noteer('invoer-geweigerd', req); return res.status(400).json({ ok: false, error: 'Ongeldige melding.' }); }
    try {
      if (!opslag) opslag = opslagVan ? opslagVan() : require('../storingen/opslag').openOpslag(
        env.RTG_DATA_DIR || path.join(__dirname, '..', 'data'));
      const r = opslag.bewaar(id, req.body, inhoud);
      noteer(r.status < 300 ? (r.herhaald ? 'herhaald' : 'opgeslagen') : 'geweigerd', req, { eventId: id, status: r.status });
      if (r.status >= 400) {
        if ([429, 503].includes(r.status)) res.set('Retry-After', '60');
        return res.status(r.status).json({ ok: false, error: r.status === 409 ? 'Event-id heeft andere inhoud.' : 'Ontvangst tijdelijk niet mogelijk.' });
      }
      res.status(r.status).json(protocol.ontvangst(sleutel, id, r.digest, r.herhaald));
    } catch (_) {
      noteer('opslag-mislukt', req, { eventId: id });
      res.set('Retry-After', '60').status(503).json({ ok: false, error: 'Melding niet opgeslagen; probeer opnieuw.' });
    }
  });
};
module.exports.inhoudVan = inhoudVan;
