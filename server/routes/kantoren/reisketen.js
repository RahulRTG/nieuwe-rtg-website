'use strict';
const antwoord = require('../../lib/reisketen-antwoord');
module.exports = kern => {
  const { app, officeAuth, reisbureau } = kern;
  const reisketen = reisbureau.keten;
  app.post('/api/office/reisbureau/keten', officeAuth, (req, res) =>
    antwoord(req, res, reisketen.toegang.kantoor(req), a => reisketen.zaken(a, (req.body || {}).ref)));
  app.post('/api/office/reisbureau/keten/offerte', officeAuth, (req, res) =>
    antwoord(req, res, reisketen.toegang.kantoor(req), a => reisketen.biedAan(a, req.body || {})));
  app.post('/api/office/reisbureau/keten/afronden', officeAuth, (req, res) =>
    antwoord(req, res, reisketen.toegang.kantoor(req), a => reisketen.afronden(a, req.body || {})));
  app.post('/api/office/reisbureau/keten/nazorg/antwoord', officeAuth, (req, res) =>
    antwoord(req, res, reisketen.toegang.kantoor(req), a => reisketen.antwoordNazorg(a, req.body || {})));
};
