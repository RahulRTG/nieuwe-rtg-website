/* Auth (deelmodule): passkeys (WebAuthn). Registreren en beheren achter de
   gewone leden-inlog (alleen echte accounts); inloggen met een passkey geeft
   dezelfde sessie als het wachtwoord, met dezelfde rem op de deur en
   dezelfde pas-app-controle. Krijgt de gedeelde context een keer bij het
   opstarten vanuit routes/auth.js. */
const { sleutelUitCredential } = require('../../kern/isolatie/apparaatsleutel');

module.exports = (actx) => {
  const { app, appUrl, auth, accounts, crypto, stateFor, pasAppOk, PAS_FOUT, isBaas, tooManyTries, noteFailedTry, loginFails,
    webauthn } = actx;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const eisAccount = (req, res) => {
    if (!req.session.account) { res.status(403).json({ error: 'Passkeys horen bij een eigen RTG-account.' }); return null; }
    return req.session.account;
  };
  // In productie komt de WebAuthn-grens uit APP_URL/RTG_DOMAINS, nooit uit een
  // door de aanvrager te kiezen Origin- of Host-kop. Buiten productie laat
  // appUrl(req) bewust wisselende localhost-poorten toe.
  const oorsprong = req => { try { return new URL(appUrl(req)).origin; } catch (e) { return ''; } };
  const gastheer = req => { try { return new URL(oorsprong(req)).hostname; } catch (e) { return req.hostname; } };
  const vingerafdruk = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex').slice(0, 24);

  /* ---- registreren en beheren (ingelogd) ---- */
  app.post('/api/webauthn/registreer/opties', auth, async (req, res) => {
    const u = eisAccount(req, res); if (!u) return;
    stuur(res, await webauthn.registratie.opties(u, gastheer(req)));
  });
  app.post('/api/webauthn/registreer', auth, async (req, res) => {
    const u = eisAccount(req, res); if (!u) return;
    stuur(res, await webauthn.registratie.maak(u, req.body.antwoord, req.body.naam, oorsprong(req), gastheer(req)));
  });
  app.post('/api/webauthn/lijst', auth, (req, res) => {
    const u = eisAccount(req, res); if (!u) return;
    stuur(res, webauthn.lijst(u));
  });
  app.post('/api/webauthn/weg', auth, (req, res) => {
    const u = eisAccount(req, res); if (!u) return;
    stuur(res, webauthn.weg(u, String(req.body.id || '')));
  });

  /* ---- inloggen met een passkey (zonder wachtwoord) ---- */
  app.post('/api/webauthn/opties', async (req, res) => {
    // Een bron die al tien ongeldige assertions stuurde krijgt ook geen verse
    // ceremonies meer. Zo kan hij de sleutel-id niet blijven rouleren om de
    // misbruikrem te ontwijken.
    if (tooManyTries(res, 'webauthn:bron:' + req.ip)) return;
    stuur(res, await webauthn.login.opties(req.body.login, gastheer(req)));
  });
  app.post('/api/webauthn/login', async (req, res) => {
    const login = String(req.body.login || '');
    // Twee onafhankelijke remmen: per bron tegen roterende nep-id's en per doel
    // tegen een verspreide aanval. Doelen worden gehasht, zodat een e-mailadres
    // nooit in geheugen of een beveiligingsmelding belandt.
    const credential = String(req.body.antwoord && req.body.antwoord.id || 'onbekend');
    const bronBucket = 'webauthn:bron:' + req.ip;
    const doelBucket = 'webauthn:doel:' + vingerafdruk(login ? 'account:' + login.trim().toLowerCase() : 'sleutel:' + credential);
    if (tooManyTries(res, bronBucket) || tooManyTries(res, doelBucket)) return;
    const r = await webauthn.login.maak(login, req.body.ceremonie, req.body.antwoord, oorsprong(req), gastheer(req));
    if (r.error) { noteFailedTry(bronBucket, req.ip); noteFailedTry(doelBucket, req.ip); return stuur(res, r); }
    loginFails.delete(bronBucket); loginFails.delete(doelBucket);
    const user = r.user;
    if (!accounts.isActief(user)) return res.status(403).json({ error: 'Dit account is door uw organisatie op non-actief gezet. Neem contact op met uw beheerder.' });
    if (!isBaas(user) && !pasAppOk(String(req.body.pasApp || ''), user.tier)) return res.status(403).json({ error: PAS_FOUT });
    /* DE APPARAATSLEUTEL, en dit is de enige plek in het huis waar hij bestaat.
       Een passkey-inlog bewijst met echte cryptografie dat dit dezelfde
       authenticator is als de vorige keer; een wachtwoordinlog bewijst dat niet,
       en dan blijft de drager `apparaat` leeg MET de reden
       (kern/isolatie/dragers.js). Wat er in het token komt is een afgeleide en
       niet het credential-id: dat id is over accounts heen te herkennen. */
    /* `sleutelVoor` komt van de GEVEL van de identiteitskluis (accounts) en niet
       uit server/accounts/kluis.js: een route gaat nooit langs de gevel heen naar
       het binnenwerk. Dat is niet alleen huisstijl -- de codenaam-scheiding uit
       CLAUDE.md hangt eraan. */
    const apparaat = sleutelUitCredential(r.credentialId, accounts.sleutelVoor);
    const token = accounts.issueToken(user.id, 30, apparaat);
    const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
    res.json({ token, state: stateFor(sess, req.body.lang) });
  });
};
