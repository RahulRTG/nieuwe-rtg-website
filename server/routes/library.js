'use strict';
// Private kernel API. A release is a durable decision, not a public content route.
module.exports = ({ app, auth, library }) => {
  const send = (res, out) => res.status(out.status || 200).json(out);
  const command = action => async (req, res) => send(res,
    await library.execute(req.session.key, action, req.body, req.documentAuthority));
  const read = kind => (req, res) => send(res, library.query(req.session.key, kind, req.body, req.documentAuthority));
  app.post('/api/library/work/create', auth, command('work.create'));
  app.post('/api/library/work/get', auth, read('work'));
  app.post('/api/library/revision/add', auth, command('revision.add'));
  app.post('/api/library/contribution/invite', auth, command('contribution.invite'));
  app.post('/api/library/contribution/accept', auth, command('contribution.accept'));
  app.post('/api/library/agreement/propose', auth, command('agreement.propose'));
  app.post('/api/library/agreement/accept', auth, command('agreement.accept'));
  app.post('/api/library/agreement/conflict', auth, command('agreement.conflict'));
  app.post('/api/library/rights/grant', auth, command('rights.grant'));
  app.post('/api/library/rights/revoke', auth, command('rights.revoke'));
  app.post('/api/library/edition/create', auth, command('edition.create'));
  app.post('/api/library/edition/freeze', auth, command('edition.freeze'));
  app.post('/api/library/edition/get', auth, read('edition'));
  app.post('/api/library/edition/withdraw', auth, command('edition.withdraw'));
  app.post('/api/library/edition/warn', auth, command('edition.warn'));
  app.post('/api/library/publication/preview', auth, read('preview'));
  app.post('/api/library/publication/consent', auth, command('publication.consent'));
  app.post('/api/library/publication/revoke-consent', auth, command('publication.revoke-consent'));
  app.post('/api/library/publication/confirm', auth, command('publication.confirm'));
  app.post('/api/library/proof', auth, read('proof'));
};
