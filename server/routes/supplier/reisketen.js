'use strict';
const antwoord = require('../../lib/reisketen-antwoord');
module.exports = kern => {
  const { app, supplierAuth, reisbureau } = kern;
  const reisketen = reisbureau.keten;
  const lezen = (req, res, actor, gewoon, exporteer) => {
    const vorm = (req.body || {}).vorm;
    return antwoord(req, res, actor, a => {
      if (vorm === 'uitvoer' || vorm === 'leesbaar') return exporteer(a);
      if (vorm != null) return { status: 400, error: 'Kies uitvoer of leesbaar voor een reisarchief.' };
      return gewoon(a);
    }, r => {
      if (vorm === 'leesbaar') return res.type('text/markdown; charset=utf-8').send(reisketen.export.leesbaar(r.uitvoer));
      return res.json(vorm === 'uitvoer' ? { ok: true, ...r.uitvoer } : r);
    });
  };
  app.post('/api/supplier/reisbureau/keten', supplierAuth, (req, res) =>
    lezen(req, res, reisketen.toegang.partner(req), a => reisketen.zaken(a, (req.body || {}).ref),
      a => reisketen.export.zaken(a)));
  app.post('/api/supplier/reisbureau/keten/offerte', supplierAuth, (req, res) =>
    antwoord(req, res, reisketen.toegang.partner(req), a => reisketen.biedAan(a, req.body || {})));
  app.post('/api/supplier/reisbureau/keten/afronden', supplierAuth, (req, res) =>
    antwoord(req, res, reisketen.toegang.partner(req), a => reisketen.afronden(a, req.body || {})));
  app.post('/api/supplier/reisbureau/keten/nazorg/antwoord', supplierAuth, (req, res) =>
    antwoord(req, res, reisketen.toegang.partner(req), a => reisketen.antwoordNazorg(a, req.body || {})));
  app.post('/api/supplier/reisbureau/opdrachten', supplierAuth, (req, res) =>
    lezen(req, res, reisketen.toegang.aanbieder(req), a => reisketen.opdrachten(a),
      a => reisketen.export.opdrachten(a)));
  app.post('/api/supplier/reisbureau/opdracht/besluit', supplierAuth, (req, res) =>
    antwoord(req, res, reisketen.toegang.aanbieder(req), a => reisketen.opdracht(a, req.body || {})));
};
