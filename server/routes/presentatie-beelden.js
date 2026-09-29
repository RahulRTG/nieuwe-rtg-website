/* Uses the member boundary and the existing private file vault. */
'use strict';
const { wie: envelopWie } = require('../opzet/envelop');
module.exports = function (kern) {
  require('./presentatie-gezinsbeelden')(kern);
  const { app, auth, accounts, bestanden } = kern, preferences = require('../kern/presentatie-beelden');
  function member(req, res) {
    const id = req.session && req.session.account && req.session.account.id;
    if (id == null) res.status(403).json({ error: 'Log in met uw eigen RTG-account om persoonlijke beelden te bewaren.' });
    return id;
  }
  app.post('/api/ik/beelden', auth, (req, res) => {
    const id = member(req, res); if (id == null) return;
    res.json({ ok: true, images: preferences.lees(accounts.getMemberState(id) || {}) });
  });
  app.post('/api/ik/beelden/zet', auth, (req, res) => {
    const id = member(req, res); if (id == null) return;
    const md = accounts.getMemberState(id) || {};
    const r = preferences.zet(md, req.body, bestanden.bestandenLijst(envelopWie(req) || req.session.key).items);
    if (r.error) return res.status(r.status).json({ error: r.error });
    accounts.saveMemberState(id, md); res.json(r);
  });
};
