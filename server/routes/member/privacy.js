/* Member-submodule: de AVG-rechten. Het volledige dossier downloaden
   (inzagerecht, onder de codenaam) en definitief verwijderen (vergetelheid):
   cv, chats, likes, live-locatie en account inclusief geupload document;
   sollicitaties worden geanonimiseerd en alle sessies uitgelogd.
   Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, db, save, stateFor, myApplications, ordersVanKlant, accounts,
    sessions, forgetSession, fs, path, UPLOAD_DIR, broadcastSync } = kern;

  app.post('/api/privacy/export', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const key = req.session.key;
    const chats = {};
    for (const [k, msgs] of Object.entries(db.data.guestChats || {})) {
      if (k.split('|')[1] === key) chats[k] = msgs;
    }
    const likes = db.data.posts.filter(p => p.likedBy && p.likedBy[key]).map(p => ({ postId: p.id, author: p.author }));
    const state = stateFor(req.session, req.body.lang);
    res.json({
      exportedAt: new Date().toISOString(),
      note: 'Alle gegevens die RTG over u bewaart, onder uw codenaam (pseudonimisering).',
      profile: state.user,
      cv: db.data.cvs[key] || null,
      applications: myApplications(key),
      invoices: state.invoices || [],
      trip: state.trip || null,
      live: db.data.live[key] || null,
      orders: ordersVanKlant(key),
      guestChats: chats,
      likedPosts: likes,
      notifications: db.data.notifications[key] || []
    });
  });

  app.post('/api/privacy/delete', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const key = req.session.key;
    // cv en live-locatie weg, chats weg, likes weg
    delete db.data.cvs[key];
    delete db.data.live[key];
    for (const k of Object.keys(db.data.guestChats || {})) if (k.split('|')[1] === key) delete db.data.guestChats[k];
    for (const p of db.data.posts) if (p.likedBy) delete p.likedBy[key];
    // sollicitaties anonimiseren: het bedrijf houdt zijn administratie,
    // maar zonder iets dat naar deze persoon herleidbaar is
    for (const list of Object.values(db.data.applications || {})) {
      for (const a of list) if (a.key === key) {
        a.name = '(op verzoek verwijderd)'; a.contact = ''; a.note = '';
        a.cv = null; a.codename = null; a.key = null;
      }
    }
    // meldingen weg (bij demo-profielen is dit de gedeelde demo-bel)
    if (db.data.notifications[key]) db.data.notifications[key] = [];
    // echt account: verwijder het account zelf, inclusief documentupload
    if (req.session.account) {
      const doc = accounts.deleteUser(req.session.account.id);
      if (doc) { try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(doc))); } catch (e) {} }
    }
    // alle sessies van dit lid uitloggen
    for (const [h, sess] of sessions) if (sess.key === key) forgetSession(h);
    save();
    broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
    res.json({ ok: true });
  });
};
