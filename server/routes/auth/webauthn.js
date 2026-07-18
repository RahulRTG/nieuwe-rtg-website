/* Auth (deelmodule): passkeys (WebAuthn). Registreren en beheren achter de
   gewone leden-inlog (alleen echte accounts); inloggen met een passkey geeft
   dezelfde sessie als het wachtwoord, met dezelfde rem op de deur en
   dezelfde pas-app-controle. Krijgt de gedeelde context een keer bij het
   opstarten vanuit routes/auth.js. */
module.exports = (actx) => {
  const { app, auth, accounts, stateFor, pasAppOk, PAS_FOUT, tooManyTries, noteFailedTry, loginFails,
    webauthnRegOpties, webauthnRegMaak, webauthnLoginOpties, webauthnLoginMaak, webauthnLijst, webauthnWeg } = actx;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const eisAccount = (req, res) => {
    if (!req.session.account) { res.status(403).json({ error: 'Passkeys horen bij een eigen RTG-account.' }); return null; }
    return req.session.account;
  };
  // de oorsprong van het verzoek: hiertegen verifieert WebAuthn de ceremonie
  const oorsprong = req => String(req.get('origin') || (req.protocol + '://' + req.get('host')));
  const gastheer = req => { try { return new URL(oorsprong(req)).hostname; } catch (e) { return req.hostname; } };

  /* ---- registreren en beheren (ingelogd) ---- */
  app.post('/api/webauthn/registreer/opties', auth, async (req, res) => {
    const u = eisAccount(req, res); if (!u) return;
    stuur(res, await webauthnRegOpties(u, gastheer(req)));
  });
  app.post('/api/webauthn/registreer', auth, async (req, res) => {
    const u = eisAccount(req, res); if (!u) return;
    stuur(res, await webauthnRegMaak(u, req.body.antwoord, req.body.naam, oorsprong(req), gastheer(req)));
  });
  app.post('/api/webauthn/lijst', auth, (req, res) => {
    const u = eisAccount(req, res); if (!u) return;
    stuur(res, webauthnLijst(u));
  });
  app.post('/api/webauthn/weg', auth, (req, res) => {
    const u = eisAccount(req, res); if (!u) return;
    stuur(res, webauthnWeg(u, String(req.body.id || '')));
  });

  /* ---- inloggen met een passkey (zonder wachtwoord) ---- */
  app.post('/api/webauthn/opties', async (req, res) => {
    stuur(res, await webauthnLoginOpties(req.body.login, gastheer(req)));
  });
  app.post('/api/webauthn/login', async (req, res) => {
    const login = String(req.body.login || '');
    const bucket = 'webauthn:' + req.ip + ':' + login.toLowerCase().slice(0, 60);
    if (tooManyTries(res, bucket)) return;
    const r = await webauthnLoginMaak(login, req.body.antwoord, oorsprong(req), gastheer(req));
    if (r.error) { noteFailedTry(bucket); return stuur(res, r); }
    loginFails.delete(bucket);
    const user = r.user;
    if (!pasAppOk(String(req.body.pasApp || ''), user.tier)) return res.status(403).json({ error: PAS_FOUT });
    const token = accounts.issueToken(user.id);
    const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
    res.json({ token, state: stateFor(sess, req.body.lang) });
  });
};
