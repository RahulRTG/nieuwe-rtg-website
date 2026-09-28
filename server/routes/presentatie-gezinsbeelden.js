/* A chosen family profile owns its own presentation and private file vault. */
'use strict';
const { zet: zetEnvelop, wie: envelopWie } = require('../opzet/envelop');
module.exports = function (kern) {
  const { app, rtf, bestanden, save } = kern, preferences = require('../kern/presentatie-beelden');
  function gezinBeeldAuth(req, res, next) {
    const b = req.body || {}, s = rtf.verifieerProfiel(b.code, b.token);
    if (!s) return res.status(401).json({ error: 'Log in met uw eigen gezinsprofiel.' });
    req.beeldProfiel = s.p;
    zetEnvelop(req, { soort: 'gezinslid', id: s.handle, identiteit: 'bewezen',
      tenantSoort: 'gezin', tenantId: String(b.code).toUpperCase() });
    next();
  }
  function send(res, result) { res.status(result.status || 200).json(result); }
  app.post('/api/foundation/gezin/beelden', gezinBeeldAuth, (req, res) => {
    res.json({ ok: true, images: preferences.lees(req.beeldProfiel) });
  });
  app.post('/api/foundation/gezin/beelden/zet', gezinBeeldAuth, (req, res) => {
    const r = preferences.zet(req.beeldProfiel, req.body, bestanden.bestandenLijst(envelopWie(req)).items);
    if (!r.error) save(); send(res, r);
  });
  app.post('/api/foundation/gezin/beelden/mijn', gezinBeeldAuth, (req, res) => send(res, bestanden.bestandenLijst(envelopWie(req))));
  app.post('/api/foundation/gezin/beelden/haal', gezinBeeldAuth, (req, res) => {
    const id = req.body.id;
    if (!bestanden.bestandenLijst(envelopWie(req)).items.some(f => f.id === id && f.vanMij && !f.weg)) return res.status(404).json({ error: 'Deze foto staat niet in uw eigen bestanden.' });
    send(res, bestanden.bestandenHaal(envelopWie(req), id));
  });
  app.post('/api/foundation/gezin/beelden/upstart', gezinBeeldAuth, (req, res) => send(res, bestanden.bestandenUpStart(envelopWie(req), req.body)));
  app.post('/api/foundation/gezin/beelden/updeel', gezinBeeldAuth, (req, res) => send(res, bestanden.bestandenUpDeel(envelopWie(req), req.body.uploadId, req.body.stuk)));
  app.post('/api/foundation/gezin/beelden/upklaar', gezinBeeldAuth, async (req, res) => send(res, await bestanden.bestandenUpKlaar(envelopWie(req), req.body.uploadId)));
  app.post('/api/foundation/gezin/beelden/upload', gezinBeeldAuth, async (req, res) => send(res, await bestanden.bestandenUpload(envelopWie(req), req.body)));
};
