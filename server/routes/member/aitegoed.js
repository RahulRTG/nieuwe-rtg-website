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
  const bundelprijs = require('../../kern/commercie/bundelprijs');
  /* De inkoopkosten komen LAAT uit de geld-regie: die is bij het mounten van
     deze routes misschien nog niet gebonden, en een prijs die op nul valt omdat
     de volgorde toevallig anders lag, is precies het soort fout dat deze hele
     ronde moest opruimen. */
  const inkoop = () => { try { return kern.geldAiInkoop ? kern.geldAiInkoop() : {}; } catch (e) { return {}; } };
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

  /* De prijs komt uit de berekening en niet uit een veld in het verzoek: een
     bundelprijs die de client meestuurt, is een bundelprijs die de client kiest. */
  app.post('/api/member/ai/bundel', auth, (req, res) => veilig(res, () => {
    const id = schoon((req.body || {}).bundel, 20);
    return tegoed.koopBundel(wie(req), pasVan(req), id, bundelprijs.prijsVan(id, inkoop()));
  }));

  // de bundels met hun prijs, zodat een scherm kan tonen wat iets kost
  app.post('/api/member/ai/bundels', auth, (req, res) => veilig(res, () =>
    ({ status: 200, ok: true, bundels: bundelprijs.lijst(inkoop()) })));

  // het kantoor kan de stand van een houder opvragen (op codenaam)
  app.post('/api/office/ai/tegoed', officeAuth, (req, res) => veilig(res, () => {
    const b = req.body || {};
    if (!b.houder) return { status: 400, error: 'Geef de codenaam van de houder.' };
    return { status: 200, ok: true, ...tegoed.stand(schoon(b.houder, 60), schoon(b.pas, 20)) };
  }));

  return { aiTegoed: tegoed };
};
