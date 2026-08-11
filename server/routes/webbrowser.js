/* Routes voor de RTG-browser: bladeren, zoeken en het formulier. Staat los
   van routes/webmaker.js (de maker) omdat dit de LEESKANT is: elk ingelogd
   lid mag bladeren, en het enige wat hier binnenkomt is een formulierbericht. */
module.exports = (kern) => {
  const { app, auth, db, webmaker, webplatform, webplatformTaal, findSupplier, addTicket, liveCodename,
          codenaamVan, connectieTussen, verbActief, sseToCustomer, notify, notifySupplier, save } = kern;
  /* Waar een formulier over gaat. De soort bepaalt hoe het bericht bij de
     ontvanger HEET -- een klacht hoort niet als "vraag" in een werklijst te
     belanden, want dan wordt hij ook als vraag behandeld. */
  const SOORTEN = { vraag: 'Vraag', offerte: 'Offerteaanvraag', sollicitatie: 'Sollicitatie',
                    reservering: 'Reserveringsverzoek', klacht: 'Klacht', feedback: 'Feedback' };
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/browser/gids', auth, (req, res) => { res.json({ lijst: webmaker.gids() }); });

  app.post('/api/browser/open', auth, async (req, res) => {
    const b0 = req.body || {};
    const r = webmaker.open(b0.adres, b0.pad, req.session.key);
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
    /* Heeft dit lid een vaste taal, dan leest hij de site in die taal --
       dezelfde afspraak als bij berichten. Het antwoord zegt erbij dat het
       machinevertaald is; een vertaling die zich voordoet als het origineel
       is een bewering die de maker niet heeft gedaan. */
    let vertaald = null;
    const mijnTaal = (db.data.memberTaal || {})[req.session.key];
    if (mijnTaal) {
      try {
        const v = await webplatformTaal.vertaalSite(r.site, mijnTaal);
        r.site = v.site; vertaald = v.vertaald;
      } catch (e) { /* onvertaald tonen is beter dan niet tonen */ }
    }
    res.json({ ok: true, site: r.site, zaak: s ? webplatform.zaakInfo(s) : null, persoon, vertaald });
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
    const soort = SOORTEN[b.soort] ? b.soort : 'vraag';
    const label = SOORTEN[soort];
    const code = webmaker.zaakVanAdres(b.adres);
    const s = code && findSupplier ? findSupplier(code) : null;
    if (s) {
      const van = liveCodename ? liveCodename(req.session) : 'lid';
      addTicket(s.code, { name: 'RTG-web · ' + van }, label + ' via de website: ' + tekst.slice(0, 140));
      /* Een klus in een lijst is nog geen bericht: zonder seintje kan een
         zaak dagen niet weten dat er iemand wacht. */
      if (notifySupplier) notifySupplier(s.code, { icon: 'berichten', title: label + ' via uw website', body: tekst.slice(0, 80) });
      /* En de inzender hoort te weten dat het is aangekomen -- anders stuurt
         hij het over een uur nog eens, of belt hij. */
      if (notify) notify(req.session.key, { icon: 'berichten', title: 'Verstuurd naar ' + s.name,
        body: 'Uw ' + label.toLowerCase() + ' staat in hun werklijst. Zij zien uw codenaam, niet uw naam.' });
      webmaker.telFormulier(webmaker.idVanAdres(b.adres));
      save();
      return res.json({ ok: true, via: 'werklijst', soort });
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
    const msg = kern.commDm.stuur(req.session.key, eigenaar, { tekst: 'Via jouw site (' + label.toLowerCase() + '): ' + tekst, lang: null });
    if (sseToCustomer) sseToCustomer(eigenaar, 'social', { kind: 'dm', from: req.session.key, codename: liveCodename(req.session), text: msg.text, at: msg.at });
    webmaker.telFormulier(webmaker.idVanAdres(b.adres));
    save();
    res.json({ ok: true, via: 'chat', soort });
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
