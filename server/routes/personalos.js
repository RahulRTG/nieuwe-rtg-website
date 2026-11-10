/* HTTP-laag voor de Personal Composition Engine. De preview is openbaar en
   beweert daarom nooit dat een capability bevoegd is; de eigen compositie
   wordt uitsluitend uit de server-side accountsessie opgebouwd. */
'use strict';

module.exports = (app, auth, personalOS, tooManyTries) => {
  const stuur = (res, r) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!r || r.error) return res.status((r && r.status) || 400).json({
      error: (r && r.error) || 'Onbekende fout.',
      ...(r && r.conflict ? { conflict: true, currentPreferences: r.currentPreferences } : {})
    });
    res.json(r);
  };
  const eigenAccount = (req, res, next) => req.session && req.session.account
    ? next() : res.status(403).json({ error: 'Een eigen account is vereist.' });

  app.post('/api/personalos/contract', (req, res) => stuur(res, { ok: true, contract: personalOS.contract() }));
  app.post('/api/personalos/preview', (req, res) => {
    if (tooManyTries && tooManyTries(res, 'personalos-preview:' + req.ip, 60, 60000)) return;
    stuur(res, personalOS.preview(req.body || {}));
  });
  app.post('/api/personalos/preferences', auth, eigenAccount, (req, res) =>
    stuur(res, { ok: true, preferences: personalOS.preferences(req.session.account.id) }));
  app.post('/api/personalos/complete', auth, eigenAccount, (req, res) =>
    stuur(res, personalOS.zet(req.session.account.id, req.body || {})));
  app.post('/api/personalos/composition', auth, eigenAccount, (req, res) =>
    stuur(res, personalOS.composition({ user: req.session.account, session: req.session })));
};
