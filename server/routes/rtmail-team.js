/* RTMAIL-routes voor teams: een adres dat meerdere mensen samen lezen
   (kern/rtmail-team.js). Staat los van routes/rtmail.js omdat het een eigen
   begrip is -- daar gaat het over JOUW postvak, hier over dat van een functie. */
module.exports = (kern) => {
  const { app, auth, rtmail, rtmailTeam, codenaamVan, db, keyVanCodenaam } = kern;
  const lidCodenaam = req => (req.session.account && req.session.account.codename) || (codenaamVan ? codenaamVan(req.session.key) : null);
  const lidSoort = (req) => rtmail.soortVoor({ tier: req.session.tier,
    rollen: ((db && db.data && db.data.accountRollen) || {})[req.session.key] || [] });

  /* ---- teams: een adres dat je samen leest (kern/rtmail-team.js) ----
     Een receptie, een keuken, een boekhouding. De sessie die de kern in gaat
     draagt alleen wat hij nodig heeft: de sleutel (intern), de codenaam (staat
     onder wat je namens het team schrijft) en de soort (bepaalt het domein).
     Nooit een echte naam -- die blijft in de kluis. */
  const teamSess = (req) => ({ key: req.session.key, codenaam: lidCodenaam(req) || '', soort: lidSoort(req) });
  const teamOp = (fn) => (req, res) => {
    if (!rtmailTeam) return res.status(503).json({ error: 'Teams staan niet aan.' });
    const r = fn(teamSess(req), req.body || {});
    if (r && r.error) return res.status(400).json({ error: r.error });
    res.json(r);
  };

  app.post('/api/member/rtmail/team/maak', auth, teamOp((s, b) => rtmailTeam.maak(s, b)));
  app.post('/api/member/rtmail/team/hef', auth, teamOp((s, b) => rtmailTeam.hef(s, String(b.id || ''))));
  app.post('/api/member/rtmail/team/mijn', auth, teamOp((s) => rtmailTeam.mijn(s)));
  app.post('/api/member/rtmail/team/postvak', auth, teamOp((s, b) => rtmailTeam.postvak(s, String(b.id || ''), { alles: !!b.alles })));
  app.post('/api/member/rtmail/team/pak', auth, teamOp((s, b) => rtmailTeam.pak(s, String(b.id || ''), b.bericht, b.aan !== false)));
  app.post('/api/member/rtmail/team/af', auth, teamOp((s, b) => rtmailTeam.afhandel(s, String(b.id || ''), b.bericht, b.aan !== false)));
  app.post('/api/member/rtmail/team/stuur', auth, teamOp((s, b) => rtmailTeam.stuur(s, String(b.id || ''), b)));
  app.post('/api/member/rtmail/team/verlaat', auth, teamOp((s, b) => rtmailTeam.verlaat(s, String(b.id || ''))));

  /* Iemand erbij of eruit gaat op CODENAAM, niet op sleutel: een sleutel is een
     intern gegeven dat nooit over de lijn hoort, en de codenaam is precies wat
     de eigenaar op zijn scherm ziet staan. De vertaling gebeurt hier. */
  app.post('/api/member/rtmail/team/lid', auth, async (req, res) => {
    if (!rtmailTeam) return res.status(503).json({ error: 'Teams staan niet aan.' });
    const b = req.body || {};
    const codenaam = String(b.codenaam || '').trim();
    if (!codenaam) return res.status(400).json({ error: 'Wie wil je erbij?' });
    let wie = null;
    try { wie = keyVanCodenaam ? await keyVanCodenaam(codenaam) : null; } catch (e) { wie = null; }
    if (!wie || !wie.key) return res.status(404).json({ error: 'Deze codenaam ken ik niet.' });
    const r = rtmailTeam.lidZet(teamSess(req), String(b.id || ''), wie.key, codenaam, b.erin !== false);
    if (r && r.error) return res.status(400).json({ error: r.error });
    res.json(r);
  });
};
