/* HET AI-TEGOED, van buiten te zien en te zetten.

   Regel 6 zegt dat er nooit ongemerkt variabele kosten ontstaan. Een laag die
   dat afdwingt maar die niemand kan raadplegen, maakt die belofte niet waar: een
   klant hoort te kunnen zien hoe ver hij is en te kunnen kiezen wat er bij het
   plafond gebeurt. Zonder deze routes was het tegoed een grendel zonder deur.

   Wat hier NIET staat: een endpoint dat verbruik boekt. Dat gebeurt waar de AI
   wordt aangeroepen, na `mag()`; een losse boek-endpoint zou een pad geven om
   verbruik vast te leggen dat niemand heeft toegestaan. */
module.exports = (kern) => {
  const { app, db, save, auth, officeAuth, schoon } = kern;
  const tegoed = require('../../kern/commercie/tegoed').maakTegoed({ db, save, nu: () => Date.now() });
  const veilig = (res, werk) => {
    try { const r = werk(); res.status(r && r.status ? r.status : 200).json(r); }
    catch (e) { console.error('[aitegoed]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };
  const wie = req => (req.session && req.session.key) || null;
  const pasVan = req => (req.session && req.session.tier) || 'gratis';

  /* De stand: percentage vooraan, want dat is wat een mens leest. De rauwe
     getallen staan erachter voor wie ze nodig heeft -- nooit tokens. */
  app.post('/api/member/ai/tegoed', auth, (req, res) => veilig(res, () =>
    ({ status: 200, ok: true, ...tegoed.stand(wie(req), pasVan(req)) })));

  /* Het beleid bij het plafond. Automatisch aanvullen vraagt een bundel EN een
     maandmaximum; die eis staat in de kern en niet hier, zodat de app, de
     backoffice en een latere zelfbedieningspagina dezelfde zin geven. */
  app.post('/api/member/ai/beleid', auth, (req, res) => veilig(res, () =>
    tegoed.zetBeleid(wie(req), pasVan(req), req.body || {})));

  app.post('/api/member/ai/bundel', auth, (req, res) => veilig(res, () =>
    tegoed.koopBundel(wie(req), pasVan(req), schoon((req.body || {}).bundel, 20))));

  // het kantoor kan de stand van een houder opvragen (op codenaam)
  app.post('/api/office/ai/tegoed', officeAuth, (req, res) => veilig(res, () => {
    const b = req.body || {};
    if (!b.houder) return { status: 400, error: 'Geef de codenaam van de houder.' };
    return { status: 200, ok: true, ...tegoed.stand(schoon(b.houder, 60), schoon(b.pas, 20)) };
  }));

  return { aiTegoed: tegoed };
};
