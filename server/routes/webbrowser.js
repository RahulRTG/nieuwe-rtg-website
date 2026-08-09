/* Routes voor de RTG-browser: bladeren, zoeken en het formulier. Staat los
   van routes/webmaker.js (de maker) omdat dit de LEESKANT is: elk ingelogd
   lid mag bladeren, en het enige wat hier binnenkomt is een formulierbericht. */
module.exports = (kern) => {
  const { app, auth, webmaker, webplatform, findSupplier, addTicket, liveCodename,
          codenaamVan, connectieTussen, verbActief, sseToCustomer, save } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/browser/gids', auth, (req, res) => { res.json({ lijst: webmaker.gids() }); });

  app.post('/api/browser/open', auth, (req, res) => {
    const r = webmaker.open((req.body || {}).adres);
    if (r.error) return stuur(res, r);
    /* hoort de site bij een zaak, dan worden de live blokken nu uit het
       zaakprofiel opgelost en krijgt de browser de acties mee -- zo weet het
       scherm dat dit een bedrijf is en niet zomaar een pagina. */
    const s = (r.site.zaakCode && findSupplier) ? findSupplier(r.site.zaakCode) : null;
    /* het formulier mag overal blijven staan: een zaak ontvangt in zijn
       werklijst, een lid in zijn gesprekken */
    r.site = webplatform.losSite(r.site, s, true);
    /* geen zaak? Dan is dit iemands eigen plek: de browser krijgt de
       CODENAAM mee (nooit de echte naam) zodat hij "verbind & chat" kan
       aanbieden -- de browser begrijpt ook personen. */
    let persoon = null;
    if (!s && codenaamVan) {
      const cn = codenaamVan(r.site.eigenaar || '');
      if (cn) persoon = { codenaam: cn };
    }
    res.json({ ok: true, site: r.site, zaak: s ? webplatform.zaakInfo(s) : null, persoon });
  });

  /* het formulier: bij een zaak landt het bericht als klus (ticket) in de
     werklijst die de zaak al heeft; bij een lid wordt het een gesprek in de
     leden-app -- steeds op de codenaam van de schrijver. */
  app.post('/api/browser/bericht', auth, (req, res) => {
    const b = req.body || {};
    const tekst = String(b.tekst || '').trim().slice(0, 500);
    if (tekst.length < 3) return res.status(400).json({ error: 'Schrijf eerst een bericht.' });
    // dezelfde 9+-poort als de vriendenchat: dit is tekst van lid naar mens
    const keur = require('../kern/veilig').keur(tekst);
    if (!keur.ok) return res.status(400).json({ error: keur.reden });
    const code = webmaker.zaakVanAdres(b.adres);
    const s = code && findSupplier ? findSupplier(code) : null;
    if (s) {
      addTicket(s.code, { name: 'RTG-web · ' + (liveCodename ? liveCodename(req.session) : 'lid') }, 'Websitebericht: ' + tekst.slice(0, 140));
      save();
      return res.json({ ok: true, via: 'werklijst' });
    }
    /* iemands eigen plek: alleen tussen verbonden leden, precies zoals de
       vriendenchat zelf. Een formulier is geen achterdeur om vreemden te
       bereiken. */
    const eigenaar = webmaker.eigenaarVanAdres(b.adres);
    if (!eigenaar) return res.status(404).json({ error: 'Geen RTG-site op dit adres.' });
    if (eigenaar === req.session.key) return res.status(400).json({ error: 'Dit is je eigen site.' });
    if (!verbActief(connectieTussen(req.session.key, eigenaar))) {
      return res.status(403).json({ error: 'Jullie zijn nog niet verbonden. Verbind eerst via de leden-app; daarna landt je bericht hier als gesprek.' });
    }
    if (!kern.commDm) return res.status(503).json({ error: 'De berichten draaien hier even niet.' });
    const msg = kern.commDm.stuur(req.session.key, eigenaar, { tekst: 'Via jouw site: ' + tekst, lang: null });
    if (sseToCustomer) sseToCustomer(eigenaar, 'social', { kind: 'dm', from: req.session.key, codename: liveCodename(req.session), text: msg.text, at: msg.at });
    res.json({ ok: true, via: 'chat' });
  });

  /* universeel zoeken: sites en bedrijven in een adem. Een bedrijf met een
     eigen online site krijgt het adres mee, zodat zoeken direct het RTG-web in
     leidt. */
  app.post('/api/browser/zoek', auth, (req, res) => {
    const q = (req.body || {}).q;
    const zaken = webplatform.zoekZaken(q).map(z => Object.assign(z, { adres: webmaker.adresVanZaak(z.code) || '' }));
    res.json({ sites: webmaker.zoek(q), zaken });
  });
};
