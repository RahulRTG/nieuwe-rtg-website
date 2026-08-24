/* De winkelkant van de RTG App Store, gezien door een LID.

   Bladeren mag iedereen die is aangemeld; installeren is -- net als bij de
   bestaande App-Bibliotheek (routes/member/winkel-bieb.js) -- een pas-voordeel
   van betalende leden. Die regel staat hier en niet in de kern, want het is een
   toegangsregel en geen eigenschap van de winkel.

   /api/appstore/brug is de enige weg van een app van derden naar RTG. Hij staat
   met opzet in de LEDEN-routes en niet bij de uitgever: de aanroep gebeurt in de
   sessie van het lid, met wat het lid heeft verleend. */
module.exports = (kern) => {
  const { app, auth, appstoreWinkel, appstoreBrug, codenaamVan } = kern;

  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Apps van derden op je startscherm zetten is voor betalende leden. Bladeren mag je gewoon.' }); return true; }
    return false;
  };
  const antwoord = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);

  app.post('/api/appstore/catalogus', auth, (req, res) => res.json(
    appstoreWinkel.catalogus(req.body || {}, req.session.key)));

  app.post('/api/appstore/mijn', auth, (req, res) => res.json({
    apps: appstoreWinkel.mijn(req.session.key), berichten: appstoreBrug.bakjes(req.session.key) }));

  /* Installeren EN verlenen in een handeling, maar niet als een knop: het lid
     stuurt mee welke van de gevraagde machtigingen hij geeft. Stuurt hij er geen
     mee, dan krijgt de app er geen -- en dat is een geldige uitkomst. */
  app.post('/api/appstore/installeer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    antwoord(res, appstoreWinkel.installeer(req.session.key, req.body.sleutel, req.body.machtigingen));
  });
  app.post('/api/appstore/verleen', auth, (req, res) => {
    if (geenGast(req, res)) return;
    antwoord(res, appstoreWinkel.verleen(req.session.key, req.body.sleutel, req.body.machtigingen));
  });
  app.post('/api/appstore/weg', auth, (req, res) => antwoord(res, appstoreWinkel.verwijder(req.session.key, req.body.sleutel)));
  app.post('/api/appstore/wis-opslag', auth, (req, res) => antwoord(res, appstoreWinkel.wisOpslag(req.session.key, req.body.sleutel)));

  // wat de celpagina nodig heeft om een app te openen
  app.post('/api/appstore/open', auth, (req, res) => {
    if (geenGast(req, res)) return;
    antwoord(res, appstoreWinkel.open(req.session.key, req.body.sleutel));
  });

  /* DE BRUG. De app noemt een methode en argumenten; wie hij is en wat hij mag,
     komt hier uit de sessie en uit de verlening -- nooit uit de body. Een app die
     een andere sleutel meestuurt dan de app die draait, spreekt daarmee alleen
     over zichzelf: de verlening wordt op die sleutel opgezocht. */
  app.post('/api/appstore/brug', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const sleutel = String(req.body.sleutel || '');
    const open = appstoreWinkel.open(req.session.key, sleutel);
    if (open.error) return res.status(open.status || 400).json({ error: open.error });
    const r = appstoreBrug.roep({
      key: req.session.key, sleutel, methode: req.body.methode, args: req.body.args,
      codenaam: codenaamVan(req.session.key), taal: req.body.taal || 'nl', pas: req.session.tier,
      verleend: open.machtigingen });
    antwoord(res, r);
  });

  /* Het bakje van een app, gelezen door het lid. Loopt met opzet NIET over de
     brug: een app hoort niet te kunnen zien of zijn bericht is gelezen. */
  app.post('/api/appstore/berichten', auth, (req, res) => res.json({
    berichten: appstoreBrug.bakje(req.session.key, String(req.body.sleutel || '')) }));
  app.post('/api/appstore/berichten/gelezen', auth, (req, res) => res.json(
    appstoreBrug.bakjeGelezen(req.session.key, String(req.body.sleutel || ''))));
};
