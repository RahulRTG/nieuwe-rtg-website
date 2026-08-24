/* Auth (deelmodule): het e-mailadres bevestigen, en de link opnieuw sturen.

   STAAT LOS VAN ./account.js, en de naad is echt: registreren en bevestigen zijn
   twee momenten. Het eerste is een formulier met een wachtwoord erin; het tweede
   is een klik op een link, vaak dagen later, vaak op een ander apparaat, met een
   eigen sleutel (een actietoken van drie dagen) die met de sessie niets te maken
   heeft. Ze deelden alleen een bestand.

   Dat account.js daarmee ook onder de 10 kB van keuringsregel 13 komt, is de
   aanleiding en niet de reden. Een knip om een getal is geen knip. */
'use strict';

module.exports = (actx) => {
  const { accounts, app, appUrl, auth, mail, pasAppVan, DEV_VELDEN } = actx;

  app.post('/api/auth/verify-email', (req, res) => {
    const u = accounts.verifyActionToken(req.body.token, 'verify-email');
    if (!u) return res.status(400).json({ error: 'Ongeldige of verlopen bevestigingslink.' });
    accounts.setEmailVerified(u.id);
    res.json({ ok: true });
  });

  app.post('/api/auth/resend', auth, (req, res) => {
    if (!req.session.account) return res.status(403).json({ error: 'Alleen voor accounts.' });
    const u = req.session.account;
    const vtok = accounts.issueActionToken(u.id, 'verify-email', 3 * 86400000);
    const url = appUrl(req) + '/apps/app.html?pas=' + pasAppVan(u.tier) + '&verify=' + vtok;
    mail.send(accounts.emailOf(u), 'Bevestig uw e-mailadres', 'Bevestig uw e-mailadres via deze link:\n' + url);
    res.json({ ok: true, ...(DEV_VELDEN(req) ? { devVerifyUrl: url } : {}) });
  });
};
