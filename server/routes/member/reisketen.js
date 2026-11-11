'use strict';
const antwoord = require('../../lib/reisketen-antwoord');
module.exports = kern => {
  const { app, auth, reisbureau, liveCodename, gegevensStop } = kern;
  const reisketen = reisbureau.keten;
  const actor = req => req.session.tier === 'guest' ? { status: 403,
    error: 'De reiscontractketen vraagt een betalend lidmaatschap; een gratis RTG Community-account geeft hier geen toegang.' }
    : { actorRef: req.session.key };
  app.post('/api/reisbureau/keten', auth, (req, res) => antwoord(req, res, actor(req),
    a => reisketen.mijn(a, (req.body || {}).ref)));
  app.post('/api/reisbureau/keten/start', auth, (req, res) => {
    if (gegevensStop(req, res, 'reservering')) return;
    return antwoord(req, res, actor(req), a => reisketen.start(a, liveCodename(req.session), req.body || {}));
  });
  app.post('/api/reisbureau/keten/akkoord', auth, (req, res) => {
    if (gegevensStop(req, res, 'reservering')) return;
    return antwoord(req, res, actor(req), a => reisketen.akkoord(a, req.body || {}));
  });
  app.post('/api/reisbureau/keten/betaal', auth, (req, res) => antwoord(req, res, actor(req), a => {
    // payGate bewaart eerste gebruik. Dat gebeurt buiten de reiscollectie-
    // transactie; binnen de claim telt uitsluitend deze sessiegebonden uitslag.
    let g = null;
    try { g = kern.onboarding && kern.onboarding.payGate && kern.onboarding.payGate(req.session); } catch (_) { /* fail-closed */ }
    return reisketen.betaal(a, liveCodename(req.session), req.body || {}, () => g);
  }));
  app.post('/api/reisbureau/keten/nazorg', auth, (req, res) => antwoord(req, res, actor(req),
    a => reisketen.vraagNazorg(a, req.body || {})));
};
