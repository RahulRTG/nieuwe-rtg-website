/* Routes "algpin": de algemene pin van het lid. Een pincode, overal dezelfde:
   hij beschermt de privacygevoelige apps op het RTG-OS en is het bewijs
   waarmee de werk-apps openen (het ene account levert de bevoegdheid, de pin
   het bewijs). Alles achter de leden-inlog van een echt account; het slot
   tegen raden zit in kern/algpin.js. */
module.exports = (kern) => {
  const { app, auth, accounts, appUrl, mail, pinInfo, pinZet, pinCheck, pinHerstelStart, pinHerstelZet } = kern;
  // buiten productie zonder SMTP geven we de link in het antwoord terug, net als
  // het wachtwoordherstel doet -- anders is de stroom lokaal niet te doorlopen
  const DEV_VELDEN = !process.env.RTG_PRODUCTION && !(mail && mail.configured);
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const echtAccount = (req, res) => {
    if (req.session.tier === 'guest' || !req.session.account) {
      res.status(403).json({ error: 'De algemene pin hoort bij een echt RTG-account.' });
      return false;
    }
    return true;
  };

  app.post('/api/pin/status', auth, (req, res) => {
    if (!echtAccount(req, res)) return;
    res.json(pinInfo(req.session.key));
  });
  app.post('/api/pin/zet', auth, async (req, res) => {
    if (!echtAccount(req, res)) return;
    stuur(res, await pinZet(req.session.key, req.body || {}));
  });
  app.post('/api/pin/check', auth, async (req, res) => {
    if (!echtAccount(req, res)) return;
    stuur(res, await pinCheck(req.session.key, (req.body || {}).pin));
  });

  /* Pin vergeten. Aanvragen kan alleen voor JEZELF, vanuit je eigen sessie: de
     sleutel komt uit kern/algpin.js en gaat hier de deur uit naar het adres dat
     WIJ van dit account hebben -- de aanvrager kiest dat adres niet. Zie de
     uitleg bij pinHerstelStart voor waarom dat veilig genoeg is. */
  app.post('/api/pin/vergeten', auth, (req, res) => {
    if (!echtAccount(req, res)) return;
    const r = pinHerstelStart(req.session.key);
    const adres = accounts.emailOf(req.session.account);
    if (!adres) return res.status(400).json({ error: 'Er staat geen e-mailadres bij dit account; herstellen kan dan niet per mail.' });
    const url = appUrl(req) + '/apps/app.html?pinherstel=' + r.sleutel;
    mail.send(adres, 'Uw algemene pincode herstellen bij Rahul Travel Group',
      'U vroeg aan om uw algemene pincode opnieuw in te stellen. Dat kan via deze link (1 uur geldig):\n' + url +
      '\n\nVroeg u dit niet aan? Dan hoeft u niets te doen; uw huidige pincode blijft gewoon staan.');
    /* Het antwoord noemt het adres NIET terug. Wie de sessie heeft weet het al,
       en wie hem gestolen heeft hoeft het niet van ons te horen. */
    res.json({ ok: true, verstuurd: true, ...(DEV_VELDEN ? { devPinUrl: url } : {}) });
  });

  app.post('/api/pin/herstel', async (req, res) => {
    const b = req.body || {};
    stuur(res, await pinHerstelZet(b.sleutel, b.pin));
  });
};
