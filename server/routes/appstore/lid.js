/* De winkelkant van de RTG App Store, gezien door een LID.

   Bladeren mag iedereen die is aangemeld; installeren is -- net als bij de
   bestaande App-Bibliotheek (routes/member/winkel-bieb.js) -- een pas-voordeel
   van betalende leden. Die regel staat hier en niet in de kern, want het is een
   toegangsregel en geen eigenschap van de winkel.

   /api/appstore/brug is de enige weg van een app van derden naar RTG. Hij staat
   met opzet in de LEDEN-routes en niet bij de uitgever: de aanroep gebeurt in de
   sessie van het lid, met wat het lid heeft verleend. */
module.exports = (kern) => {
  const { app, auth, appstore, appstoreWinkel, appstoreBrug, codenaamVan } = kern;

  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Apps van derden op je startscherm zetten is voor betalende leden. Bladeren mag je gewoon.' }); return true; }
    return false;
  };
  const antwoord = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);

  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/catalogus', auth, (req, res) => res.json(
    appstoreWinkel.catalogus(req.body || {}, req.session.key)));

  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/mijn', auth, (req, res) => res.json({
    apps: appstoreWinkel.mijn(req.session.key), berichten: appstoreBrug.bakjes(req.session.key) }));

  /* Installeren EN verlenen in een handeling, maar niet als een knop: het lid
     stuurt mee welke van de gevraagde machtigingen hij geeft. Stuurt hij er geen
     mee, dan krijgt de app er geen -- en dat is een geldige uitkomst. */
  /* mutatie: idempotent -- twee keer installeren laat dezelfde app op het startscherm */
  app.post('/api/appstore/installeer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    antwoord(res, appstoreWinkel.installeer(req.session.key, req.body.sleutel, req.body.machtigingen, req.body.tot));
  });
  /* mutatie: idempotent -- de verlening wordt GEZET en niet opgeteld */
  app.post('/api/appstore/verleen', auth, (req, res) => {
    if (geenGast(req, res)) return;
    antwoord(res, appstoreWinkel.verleen(req.session.key, req.body.sleutel, req.body.machtigingen));
  });
  app.post('/api/appstore/weg', auth, (req, res) => antwoord(res, appstoreWinkel.verwijder(req.session.key, req.body.sleutel)));   /* mutatie: idempotent -- twee keer verwijderen laat dezelfde stand achter */
  /* DE CONTEXTBRUG. Drie routes, en ze staan met opzet uit elkaar: klaarzetten
     doet een scherm van RTG, lezen doet het scherm van het LID voordat hij
     beslist, en doorgeven doet het lid zelf. Alle drie hangen aan de sessie van
     dat lid; er is geen weg waarlangs een app zijn eigen overdracht ophaalt. */
  app.post('/api/appstore/context/klaarzet', auth, (req, res) =>
    antwoord(res, appstore.context.klaarzet(req.session.key, req.body.sleutel, req.body.velden)));   /* mutatie: nietHerhaalbaar -- elke aanroep zet een nieuwe overdracht klaar */
  app.post('/api/appstore/context/lees', auth, (req, res) =>
    antwoord(res, appstore.context.lees(req.session.key, req.body.id)));
  app.post('/api/appstore/context/geef', auth, (req, res) =>
    antwoord(res, appstore.context.geef(req.session.key, req.body.id, req.body.sleutel)));   /* mutatie: nietHerhaalbaar -- een overdracht wordt EEN keer gelezen en is daarna weg */

  /* De cel vernietigen: de app weg EN alles wat hij voor dit lid bewaarde, in
     een handeling, met de opgave van wat er verdween. */
  app.post('/api/appstore/vernietig', auth, (req, res) => antwoord(res, appstoreWinkel.vernietig(req.session.key, req.body.sleutel)));   /* mutatie: idempotent -- twee keer vernietigen laat dezelfde lege stand achter */
  app.post('/api/appstore/wis-opslag', auth, (req, res) => antwoord(res, appstoreWinkel.wisOpslag(req.session.key, req.body.sleutel)));   /* mutatie: idempotent -- twee keer wissen laat dezelfde lege opslag */

  // wat de celpagina nodig heeft om een app te openen
  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/open', auth, (req, res) => {
    if (geenGast(req, res)) return;
    antwoord(res, appstoreWinkel.open(req.session.key, req.body.sleutel));
  });

  /* DE BRUG. De app noemt een methode en argumenten; wie hij is en wat hij mag,
     komt hier uit de sessie en uit de verlening -- nooit uit de body. Een app die
     een andere sleutel meestuurt dan de app die draait, spreekt daarmee alleen
     over zichzelf: de verlening wordt op die sleutel opgezocht. */
  /* GEEN mutatieklasse op deze route, en dat is met opzet. Wat een tweede
     aanroep doet, hangt hier niet aan de ROUTE maar aan de methode die erin
     zit: opslag.zet is idempotent, bericht.zet is nietHerhaalbaar. Een klasse
     op de route zou de ene of de andere helft van de waarheid zijn. De
     verklaring staat daarom per methode in kern/appstore/brug.js, waar
     kern/mutatie.js hem structureel afdwingt. */
  app.post('/api/appstore/brug', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const sleutel = String(req.body.sleutel || '');
    const open = appstoreWinkel.open(req.session.key, sleutel);
    if (open.error) return res.status(open.status || 400).json({ error: open.error });
    const r = appstoreBrug.roep({
      key: req.session.key, sleutel, methode: req.body.methode, args: req.body.args,
      codenaam: codenaamVan(req.session.key), taal: req.body.taal || 'nl', pas: req.session.tier,
      /* Wat het lid VERLEENDE bepaalt of het mag; wat het manifest VRAAGT gaat
         alleen mee zodat een weigering kan uitleggen welke van de twee ontbrak.
         Dat onderscheid is de hele reden dat een weigering hier bruikbaar is
         (kern/appstore/brug.js). */
      verleend: open.machtigingen, vraagt: (open.vraagt || []).map(m => m.id) });
    antwoord(res, r);
  });

  /* ---- de enterprise-kant, en die staat met opzet bij het LID en niet achter
     een kantoorpoort. Het inkoopdossier is de transparantie-akte van dit
     kanaal: wie de leverancier is, wat er draait, wat de app nooit krijgt, waar
     de gegevens blijven, en -- het belangrijkste -- wat wij NIET kunnen
     aantonen. Een document dat alleen een inkoper mag lezen, is een
     verkooppraatje; dit hoort iedereen te kunnen openen die de app overweegt. */
  app.post('/api/appstore/dossier', auth, (req, res) => antwoord(res, appstore.dossier(String(req.body.sleutel || ''))));   /* mutatie: idempotent -- lezen */
  // en wat voor het HELE kanaal geldt, los opvraagbaar: dat scheelt het per app lezen
  app.post('/api/appstore/kanaal', auth, (req, res) => res.json(appstore.kanaal()));   /* mutatie: idempotent -- lezen */

  /* De tijdlijn van het lid: wat gaf ik, wanneer, en wanneer nam ik het terug.
     Alleen de eigen tijdlijn -- de sleutel komt uit de sessie en nooit uit de
     body, want dan zou een lid die van een ander kunnen opvragen. */
  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/tijdlijn', auth, (req, res) => res.json({
    tijdlijn: appstore.tijdlijn(req.session.key, req.body.sleutel ? String(req.body.sleutel) : null, req.body.n),
    soorten: appstore.TIJDLIJN_SOORTEN,
    let: 'Dit is jouw geschiedenis met apps van derden. Hij groeit aan en wordt nooit herschreven -- ook niet als je een app verwijdert, want juist dan is hij het bewijs.' }));

  /* Het bakje van een app, gelezen door het lid. Loopt met opzet NIET over de
     brug: een app hoort niet te kunnen zien of zijn bericht is gelezen. */
  /* mutatie: idempotent -- lezen */
  app.post('/api/appstore/berichten', auth, (req, res) => res.json({
    berichten: appstoreBrug.bakje(req.session.key, String(req.body.sleutel || '')) }));
  /* mutatie: idempotent -- twee keer gelezen melden laat dezelfde stand */
  app.post('/api/appstore/berichten/gelezen', auth, (req, res) => res.json(
    appstoreBrug.bakjeGelezen(req.session.key, String(req.body.sleutel || ''))));
};
