'use strict';
const antwoord = require('../../lib/reisketen-antwoord');
module.exports = kern => {
  const { app, officeAuth, reisketen, reisketenToegang } = kern;
  app.post('/api/office/reisbureau/keten', officeAuth, (req, res) =>
    antwoord(req, res, reisketenToegang.kantoor(req), a => reisketen.zaken(a, (req.body || {}).ref)));
  app.post('/api/office/reisbureau/keten/offerte', officeAuth, (req, res) =>
    antwoord(req, res, reisketenToegang.kantoor(req), a => reisketen.biedAan(a, req.body || {})));
  app.post('/api/office/reisbureau/keten/afronden', officeAuth, (req, res) =>
    antwoord(req, res, reisketenToegang.kantoor(req), a => reisketen.afronden(a, req.body || {})));
  app.post('/api/office/reisbureau/keten/nazorg/antwoord', officeAuth, (req, res) =>
    antwoord(req, res, reisketenToegang.kantoor(req), a => reisketen.antwoordNazorg(a, req.body || {})));
};
