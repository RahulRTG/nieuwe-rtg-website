'use strict';
// Private kernel API. A release is a durable decision, not a public content route.
module.exports = ({ app, auth, library }) => {
  const send = (res, out) => res.status(out.status || 200).json(out);
  const command = action => async (req, res) => send(res,
    await library.execute(req.session.key, action, req.body, req.documentAuthority));
  const read = kind => (req, res) => send(res, library.query(req.session.key, kind, req.body, req.documentAuthority));
  app.post('/api/library/work/create', auth, command('work.create'));
  app.post('/api/library/context', auth, read('context'));
  app.post('/api/library/work/list', auth, read('work-list'));
  app.post('/api/library/work/get', auth, read('work'));
  app.post('/api/library/revision/add', auth, command('revision.add'));
  app.post('/api/library/structure/reorder', auth, command('structure.reorder'));
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
  app.post('/api/library/studio/workspace', auth, read('workspace'));
  app.post('/api/library/feedback/create', auth, command('feedback.create'));
  app.post('/api/library/feedback/list', auth, read('feedback'));
  app.post('/api/library/feedback/decide', auth, command('feedback.decide'));
  app.post('/api/library/feedback/resolve', auth, command('feedback.resolve'));
  app.post('/api/library/education/release', auth, command('education.release'));
  app.post('/api/library/education/withdraw', auth, command('education.withdraw'));
  app.post('/api/library/education/get', auth, read('education-release'));
  const readerCommand = action => async (req, res) => send(res,
    await library.reader.execute(req.session.key, action, req.body, req.documentAuthority));
  const readerRead = kind => (req, res) => send(res,
    library.reader.query(req.session.key, kind, req.body, req.documentAuthority));
  app.post('/api/library/reader/open', auth, readerRead('open'));
  app.post('/api/library/reader/state', auth, readerRead('state'));
  app.post('/api/library/reader/proof', auth, readerRead('proof'));
  app.post('/api/library/reader/search', auth, readerRead('search'));
  app.post('/api/library/reader/progress', auth, readerCommand('progress.set'));
  app.post('/api/library/reader/bookmark', auth, readerCommand('bookmark.put'));
  app.post('/api/library/reader/bookmark/remove', auth, readerCommand('bookmark.remove'));
  app.post('/api/library/reader/highlight', auth, readerCommand('highlight.put'));
  app.post('/api/library/reader/highlight/remove', auth, readerCommand('highlight.remove'));
  app.post('/api/library/reader/note', auth, readerCommand('note.put'));
  app.post('/api/library/reader/note/remove', auth, readerCommand('note.remove'));
  app.post('/api/library/proof', auth, read('proof'));
};
